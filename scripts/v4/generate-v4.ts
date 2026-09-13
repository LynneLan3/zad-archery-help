import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createPageData, type PageDataInput } from '../../src/v4/page-data-contract';
import { composePage } from '../../src/v4/page-composer';
import { resolveIntent } from '../../src/v4/intent-resolver';
import { bindTaskMedia } from '../../src/v4/media-binding';
import type { PageFact, PageEvidence, PageFreshness, PageBody, LegacyPrimitivePayload, PrimitiveInstance, PageAssetCandidate } from '../../src/v4/page-data-contract';
import type { PlayerTask, ResolverEvidence } from '../../src/v4/intent-contract';
import { createV4Theme, type V4Theme } from '../../src/v4/visual-system';
import type { V4Navigation } from '../../src/v4/navigation';
import { normalizePagePackage, type ApimartPagePackage } from '../../src/v4/page-package';

export interface V4InputPage {
	id: string;
	title: string;
	href: string;
	query: string;
	playerProblem: string;
	primaryTask?: PlayerTask;
	resolverEvidence?: ResolverEvidence;
	primitiveSupport?: Readonly<Record<string, 'available'|'unresolved'|'unsupported'>>;
	priority?: number;
	facts?: readonly PageFact[];
	evidence?: readonly PageEvidence[];
	freshness?: PageFreshness;
	assets?: readonly PageAssetCandidate[];
	primitiveData?: readonly (PrimitiveInstance|LegacyPrimitivePayload)[];
	pagePackage?: ApimartPagePackage;
	body?: PageBody;
}

export interface V4GameIdentity {
	logo?: string;
	hero?: string;
	palette?: Readonly<Record<string, string>>;
	background?: string;
	texture?: string;
	typography?: 'serif' | 'sans';
}

export interface V4SiteInput {
	game: { name: string; slug: string; accent?: string; accentForeground?: string; identity?: V4GameIdentity };
	navigation?: V4Navigation;
	pages: readonly V4InputPage[];
}

export interface V4GeneratedPage {
	id: string;
	title: string;
	href: string;
	pageData: ReturnType<typeof createPageData>;
	composition: ReturnType<typeof composePage>;
}

export interface V4GeneratedSite {
	game: V4SiteInput['game'];
	theme: V4Theme;
	navigation: V4Navigation;
	homepage: { pageIds: readonly string[]; assets: readonly PageAssetCandidate[]; surfaces: readonly { id: string; label: string; pageIds: readonly string[] }[] };
	pages: readonly V4GeneratedPage[];
}

function buildHomepageSurfaces(pages: readonly V4GeneratedPage[]) {
	const ranked = [...pages].sort((a, b) => b.pageData.intent.priority - a.pageData.intent.priority || a.id.localeCompare(b.id));
	const used = new Set<string>();
	const candidates = [
		{ id: 'hot-now', label: 'Hot Now', pages: ranked.slice(0, 1) },
		{ id: 'primary-task', label: 'Primary Task', pages: ranked.filter((page) => !['P2', 'P9'].includes(page.pageData.intent.prototype)).slice(0, 2) },
		{ id: 'primary-tool', label: 'Primary Tool', pages: ranked.filter((page) => page.pageData.intent.prototype === 'P9').slice(0, 2) },
		{ id: 'primary-catalog', label: 'Primary Catalog', pages: ranked.filter((page) => page.pageData.intent.prototype === 'P2').slice(0, 2) },
		{ id: 'popular-questions', label: 'Popular Questions', pages: ranked.filter((page) => page.pageData.body.faq.length > 0).slice(0, 3) },
		{ id: 'recently-updated', label: 'Recently Updated', pages: ranked.filter((page) => Boolean(page.pageData.freshness?.dataWindow || page.pageData.freshness?.version)).slice(0, 3) },
	];
	return candidates.map((candidate) => {
		const selected = candidate.pages.filter((page) => !used.has(page.id));
		selected.forEach((page) => used.add(page.id));
		return { ...candidate, pages: selected, score: selected.length ? Math.max(...selected.map((page) => page.pageData.intent.priority)) : -1 };
	}).filter((candidate) => candidate.pages.length > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map(({ id, label, pages: selected }) => ({ id, label, pageIds: selected.map((page) => page.id) }));
}

const canonicalHref = (href: string): string => {
	if (href === '/v4-preview/' || href === '/v4-preview') return '/';
	if (href.startsWith('/v4-preview/')) return href.slice('/v4-preview'.length) || '/';
	return href;
};

function canonicalizeValue<T>(value: T): T {
	if (typeof value === 'string') return canonicalHref(value) as T;
	if (Array.isArray(value)) return value.map((item) => canonicalizeValue(item)) as T;
	if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, canonicalizeValue(item)])) as T;
	return value;
}

function toCanonicalSite(site: V4GeneratedSite): V4GeneratedSite {
	return {
		...site,
		navigation: {
			...site.navigation,
			primary: site.navigation.primary.map((category) => ({
				...category,
				href: canonicalHref(category.href),
				groups: category.groups?.map((group) => ({ ...group, items: group.items.map((item) => ({ ...item, href: canonicalHref(item.href) })) })),
			})),
			utilities: site.navigation.utilities?.map((item) => ({ ...item, href: canonicalHref(item.href) })),
		},
		pages: site.pages.map((page) => canonicalizeValue({ ...page, href: canonicalHref(page.href) })),
	};
}

export function generateV4(input: V4SiteInput): V4GeneratedSite {
	const homepageAssets: PageAssetCandidate[] = [];
	const pages = input.pages.map((page) => {
		const packageData = normalizePagePackage(page.pagePackage);
		const sourceEvidence = page.evidence?.length ? page.evidence : packageData.evidence;
		const resolvedIntent = resolveIntent({
			query: page.query,
			playerProblem: page.playerProblem,
			primaryTask: page.primaryTask,
			evidence: page.resolverEvidence,
			priority: page.priority,
		});
		const sourceFacts = page.facts?.length
			? page.facts
			: packageData.facts.length ? packageData.facts
			: sourceEvidence.map((item, index) => ({
				id: item.evidenceId ?? `evidence-fact-${index + 1}`,
				label: item.label ?? item.sourceType ?? 'Evidence',
				value: item.finding ?? item.quote ?? item.sourceRef ?? item.url ?? 'Verified source evidence',
				verified: true,
			}));
		const intent = sourceFacts.length && !resolvedIntent.primitiveRecipe.some((item) => item.primitiveId === 'E01')
			? { ...resolvedIntent, primitiveRecipe: [...resolvedIntent.primitiveRecipe, { primitiveId: 'E01', status: 'include' as const, reason: 'Verified facts require a rendered fact card.' }] }
			: resolvedIntent;
		const evidenceRefs = sourceEvidence.map((item, index) => item.evidenceId ?? `evidence-${index + 1}`);
		const fallbackPrimitiveData: PrimitiveInstance[] = [
			{ instanceId: 'answer-header', primitiveId: 'A01', payload: { title: page.title, task: page.playerProblem, subject: input.game.name }, evidenceRefs, mediaRefs: [] },
			...(sourceFacts.length ? [{ instanceId: 'verified-facts', primitiveId: 'E01' as const, payload: { facts: sourceFacts.map((fact) => ({ label: fact.label, value: fact.value })) }, evidenceRefs, mediaRefs: [] }] : []),
		];
		const pageAssets = [...(page.assets ?? []), ...packageData.assets].filter((asset) => {
			// Hero media is homepage media by default. A content page may retain
			// it only when its input explicitly references media from its own
			// primitive data; an empty mediaRefs list is not an opt-in.
			if (asset.role !== 'hero') return true;
			const explicitlyBound = (page.primitiveData ?? []).some((raw) => (raw.mediaRefs ?? []).length > 0);
			if (explicitlyBound) return true;
			homepageAssets.push(asset);
			return false;
		});
		const media = bindTaskMedia(intent.primaryTask, pageAssets);
		const pageDataInput: PageDataInput = {
			intent,
			page: { id: page.id, title: page.title, href: page.href },
			body: page.body ?? packageData.body,
			facts: sourceFacts,
			evidence: sourceEvidence,
			freshness: page.freshness ?? packageData.freshness,
			assets: media.assets,
			primitiveData: page.primitiveData?.length ? page.primitiveData : fallbackPrimitiveData,
				primitiveSupport: { ...media.primitiveSupport, ...page.primitiveSupport },
		};
		const pageData = createPageData(pageDataInput);
		return { id: page.id, title: page.title, href: page.href, related: (page as V4InputPage & { related?: readonly { href: string; label?: string }[] }).related ?? [], pageData, composition: composePage(pageData) };
	});
	const pageIds = [...pages].sort((a, b) => b.pageData.intent.priority - a.pageData.intent.priority || a.id.localeCompare(b.id)).map((page) => page.id);
	return {
		game: input.game,
		theme: createV4Theme(input.game.accent, input.game.accentForeground),
		navigation: input.navigation ?? { primary: [] },
		homepage: { pageIds, assets: homepageAssets, surfaces: buildHomepageSurfaces(pages) },
		pages,
	};
}

export function generateV4File(inputPath: string, outputPath: string): V4GeneratedSite {
	const input = JSON.parse(readFileSync(inputPath, 'utf8')) as V4SiteInput;
	const output = generateV4(input);
	mkdirSync(path.dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
	// Preview artifacts retain their mounted /v4-preview/ routes; callers that
	// consume the generator result receive the canonical site contract.
	return toCanonicalSite(output);
}

export function generateV4Standalone(inputPath: string, destination: string): V4GeneratedSite {
	if (existsSync(destination) && readdirSync(destination).length > 0) {
		throw new Error(`Standalone destination must be empty: ${destination}`);
	}
	const root = path.resolve(new URL('.', import.meta.url).pathname, '../..');
	const generated = toCanonicalSite(generateV4(JSON.parse(readFileSync(inputPath, 'utf8')) as V4SiteInput));
	mkdirSync(path.join(destination, 'src'), { recursive: true });
	for (const directory of ['components/v4', 'v4']) cpSync(path.join(root, 'src', directory), path.join(destination, 'src', directory), { recursive: true });
	cpSync(path.join(root, 'public/v4'), path.join(destination, 'public/v4'), { recursive: true });
	cpSync(path.join(root, 'scripts/v4/standalone/astro.config.mjs'), path.join(destination, 'astro.config.mjs'));
	cpSync(path.join(root, 'scripts/v4/standalone/package.json'), path.join(destination, 'package.json'));
	if (existsSync(path.join(root, 'scripts/v4/standalone/package-lock.json'))) cpSync(path.join(root, 'scripts/v4/standalone/package-lock.json'), path.join(destination, 'package-lock.json'));
	cpSync(path.join(root, 'scripts/v4/standalone/tsconfig.json'), path.join(destination, 'tsconfig.json'));
	cpSync(path.join(root, 'scripts/v4/standalone/validate-generated-site.ts'), path.join(destination, 'scripts/v4/standalone/validate-generated-site.ts'));
	for (const file of readdirSync(path.join(root, 'scripts/v4/standalone/pages'))) cpSync(path.join(root, 'scripts/v4/standalone/pages', file), path.join(destination, 'src/pages', file), { recursive: true });
	writeFileSync(path.join(destination, 'src/v4/generated/example-site.json'), `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
	return generated;
}

if (process.argv[1]?.endsWith('generate-v4.ts')) {
	const [, , inputPath, outputPath] = process.argv;
	if (!inputPath || !outputPath) throw new Error('Usage: tsx scripts/v4/generate-v4.ts <input.json> <output.json>');
	generateV4File(inputPath, outputPath);
}
