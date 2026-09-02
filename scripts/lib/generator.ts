import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { expectedHubSlug, normalizeHubPath, pageHref } from '../../src/lib/paths';
import { routeHref } from '../../src/lib/routes';
import { readIndexNowKey, indexnowKeyFileRel, ensureKeyFile, resolveIndexNowKey, INDEXNOW_KEY_REL } from '../../src/lib/indexnow';
import type { GameAnalyticsConfig, GameConfig, GameMonetizationConfig, GameSocialConfig, GameTrustConfig } from '../../src/config/game-types';
import { buildAssetManifest } from './asset-contract';
import { RUNTIME_COMPATIBILITY, RUNTIME_COMPATIBILITY_FINGERPRINT } from '../../src/lib/runtime-compatibility';
import {
	CORE_TRUST_PAGE_KINDS,
	TRUST_PAGE_KINDS,
	TRUST_PAGE_SLUGS,
	trustDescriptionForLocale,
	trustRobotsForKind,
	trustTitleForLocale,
	type TrustPageKind,
} from '../../src/lib/trust';
import {
	buildManifest,
	isPathManaged,
	manifestPath,
	readManifest,
	serializeManifest,
	type ManagedAssetEntry,
	type ManagedFileEntry,
	type SiteGeneratorManifest,
} from './managed-files';
import {
	loadSiteSpec,
	mapReleaseDate,
	publicHrefForPage,
	publicSlugForPage,
	resolveInputPath,
	resolveLinkTarget,
	resolvePlaceholders,
	sha256File,
	isAffiliateDisclosureEnabled,
	sha256Text,
	SpecValidationError,
	type LoadedSiteSpec,
	type SiteSpec,
} from './site-spec';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const DEMO_MANIFEST_PATH = path.resolve(SCRIPT_DIR, '../template-demo-manifest.json');

export type PlanAction = 'create' | 'update' | 'delete' | 'skip' | 'copy';

export interface PlanItem {
	action: PlanAction;
	path: string;
	reason: string;
}

export interface GeneratorPlan {
	rootDir: string;
	specRelativePath: string;
	items: PlanItem[];
	expectedFiles: Map<string, { content?: string; copyFrom?: string; kind: ManagedFileEntry['kind']; assetId?: string }>;
	deletes: string[];
	warnings: string[];
}

export interface GeneratorResult {
	ok: boolean;
	dryRun: boolean;
	check: boolean;
	plan: GeneratorPlan;
	written: string[];
	deleted: string[];
	skipped: string[];
	drift: string[];
	manifest?: SiteGeneratorManifest;
}

interface DemoManifest {
	schemaVersion: number;
	files: Array<{ path: string; sha256: string }>;
}

function loadDemoManifest(): DemoManifest {
	return JSON.parse(readFileSync(DEMO_MANIFEST_PATH, 'utf8')) as DemoManifest;
}

function toPosix(rel: string): string {
	return rel.replace(/\\/g, '/');
}

function ensureInsideRoot(rootDir: string, absolutePath: string, field: string): void {
	const rel = path.relative(rootDir, absolutePath);
	if (rel.startsWith('..') || path.isAbsolute(rel)) {
		throw new SpecValidationError(
			'Refusing to write outside the project root.',
			field,
			absolutePath,
			field,
			'Keep generated paths inside the repository.',
		);
	}
}

function yamlQuote(value: string): string {
	const legacyPlain = /^[A-Za-z0-9 _./:-]+$/.test(value) && !/^[-?]/.test(value) && value !== '';
	if (legacyPlain && !/:\s/.test(value)) return value;
	if (!legacyPlain) return JSON.stringify(value);
	return stringifyYaml(value).trimEnd();
}

function yamlScalar(value: unknown): string {
	if (typeof value === 'boolean' || typeof value === 'number') return String(value);
	return yamlQuote(String(value));
}

function appendYamlMapping(lines: string[], indent: number, value: Record<string, unknown>): void {
	const prefix = ' '.repeat(indent);
	const entries = Object.entries(value).filter(([, childValue]) => childValue !== undefined && childValue !== null);
	if (entries.length === 0) {
		lines.push(`${prefix}{}`);
		return;
	}
	for (const [childKey, childValue] of entries) {
		if (typeof childValue === 'string' && childValue.includes('\n')) {
			lines.push(`${prefix}${childKey}: |-`);
			for (const part of childValue.split(/\r?\n/)) lines.push(`${prefix}  ${part}`);
			continue;
		}
		if (typeof childValue !== 'object' || childValue === null) {
			const scalar = childKey === 'lastVerified' && typeof childValue === 'string' ? JSON.stringify(childValue) : yamlScalar(childValue);
			lines.push(`${prefix}${childKey}: ${scalar}`);
			continue;
		}
		if (!Array.isArray(childValue) && Object.keys(childValue).length === 0) {
			lines.push(`${prefix}${childKey}: {}`);
			continue;
		}
		lines.push(`${prefix}${childKey}:`);
		appendYamlValue(lines, indent + 2, childValue);
	}
}

function appendYamlValue(lines: string[], indent: number, value: unknown): void {
	const prefix = ' '.repeat(indent);
	if (Array.isArray(value)) {
		for (const item of value) {
			if (item && typeof item === 'object' && !Array.isArray(item)) {
				lines.push(`${prefix}-`);
				appendYamlMapping(lines, indent + 2, item as Record<string, unknown>);
			} else if (typeof item === 'string' && item.includes('\n')) {
				lines.push(`${prefix}- |-`);
				for (const part of item.split(/\r?\n/)) lines.push(`${prefix}  ${part}`);
			} else {
				lines.push(`${prefix}- ${yamlScalar(item)}`);
			}
		}
		return;
	}
	if (value && typeof value === 'object') {
		appendYamlMapping(lines, indent, value as Record<string, unknown>);
		return;
	}
	lines.push(`${prefix}${yamlScalar(value)}`);
}

function renderFrontmatter(fields: Array<[string, unknown]>): string {
	const lines: string[] = ['---'];
	for (const [key, value] of fields) {
		if (value === undefined || value === null) continue;
		if (typeof value === 'boolean') {
			lines.push(`${key}: ${value}`);
			continue;
		}
		if (typeof value === 'number') {
			lines.push(`${key}: ${value}`);
			continue;
		}
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			lines.push(`${key}:`);
			appendYamlValue(lines, 2, value);
			continue;
		}
		if (typeof value === 'object') {
			lines.push(`${key}:`);
			appendYamlValue(lines, 2, value);
			continue;
		}
		const text = String(value);
		if (text.includes('\n')) {
			lines.push(`${key}: >`);
			for (const part of text.split(/\r?\n/)) {
				lines.push(`  ${part}`);
			}
			continue;
		}
		lines.push(`${key}: ${yamlQuote(text)}`);
	}
	lines.push('---', '');
	return lines.join('\n');
}

function tsString(value: string): string {
	return JSON.stringify(value);
}

function renderSiteGeneratedTs(config: GameConfig): string {
	const lines: string[] = [
		'/**',
		' * This file is generated from site-spec.yaml.',
		' * Do not edit directly.',
		' * Run npm run site:generate instead.',
		' */',
		"import type { GameConfig } from './game-types';",
		'',
		'export const siteConfig: GameConfig = {',
		...(config.presentationVersion ? [`\tpresentationVersion: ${config.presentationVersion},`] : []),
		`\tname: ${tsString(config.name)},`,
		`\tshortName: ${tsString(config.shortName)},`,
	];
	if (config.title) lines.push(`\ttitle: ${tsString(config.title)},`);
	lines.push(
		`\tdescription: ${tsString(config.description)},`,
		`\ttagline: ${tsString(config.tagline)},`,
		`\tsiteUrl: ${tsString(config.siteUrl)},`,
		`\tsiteMode: ${tsString(config.siteMode)},`,
		`\thubPath: ${tsString(config.hubPath)},`,
	);
	if (config.hubTitle) lines.push(`\thubTitle: ${tsString(config.hubTitle)},`);
	if (config.locale) lines.push(`\tlocale: ${tsString(config.locale)},`);
	lines.push(`\treleaseStatus: ${tsString(config.releaseStatus)},`);
	lines.push(`\treleaseDate: ${tsString(config.releaseDate)},`);
	lines.push(`\tdeveloper: ${tsString(config.developer)},`);
	lines.push(`\tpublisher: ${tsString(config.publisher)},`);
	lines.push(`\tplatforms: [${config.platforms.map((p) => tsString(p)).join(', ')}],`);
	if (config.assets?.length) {
		lines.push('\tassets: [');
		for (const asset of config.assets) {
			lines.push('\t\t{');
			lines.push(`\t\t\tassetId: ${tsString(asset.assetId)},`);
			lines.push(`\t\t\tsource: ${tsString(asset.source)},`);
			lines.push(`\t\t\tlocalPath: ${tsString(asset.localPath)},`);
			lines.push(`\t\t\twidth: ${asset.width},`);
			lines.push(`\t\t\theight: ${asset.height},`);
			lines.push(`\t\t\taspectRatio: ${asset.aspectRatio},`);
			lines.push(`\t\t\tfileSize: ${asset.fileSize},`);
			lines.push(`\t\t\tusage: [${asset.usage.map((usage) => tsString(usage)).join(', ')}],`);
			lines.push('\t\t},');
		}
		lines.push('\t],');
	}
	if (config.runtimeCompatibility) {
		lines.push('\truntimeCompatibility: {');
		for (const [key, value] of Object.entries(config.runtimeCompatibility)) lines.push(`\t\t${key}: ${tsString(value)},`);
		lines.push('\t},');
	}
	lines.push(`\taccentColor: ${tsString(config.accentColor)},`);
	if (config.accentForeground) lines.push(`\taccentForeground: ${tsString(config.accentForeground)},`);
	if (config.heroImage) lines.push(`\theroImage: ${tsString(config.heroImage)},`);
	if (config.heroAlt) lines.push(`\theroAlt: ${tsString(config.heroAlt)},`);
	if (config.heroPosition) lines.push(`\theroPosition: ${tsString(config.heroPosition)},`);
	if (config.logoImage) lines.push(`\tlogoImage: ${tsString(config.logoImage)},`);
	if (config.disclaimer) lines.push(`\tdisclaimer: ${tsString(config.disclaimer)},`);

	if (config.portal) {
		lines.push('\tportal: {');
		const portal = config.portal;
		if (portal.heroBadge) lines.push(`\t\theroBadge: ${tsString(portal.heroBadge)},`);
		if (portal.primaryCta) {
			lines.push('\t\tprimaryCta: {');
			lines.push(`\t\t\tlabel: ${tsString(portal.primaryCta.label)},`);
			lines.push(`\t\t\thref: ${tsString(portal.primaryCta.href)},`);
			lines.push('\t\t},');
		}
		if (portal.secondaryCta) {
			lines.push('\t\tsecondaryCta: {');
			lines.push(`\t\t\tlabel: ${tsString(portal.secondaryCta.label)},`);
			lines.push(`\t\t\thref: ${tsString(portal.secondaryCta.href)},`);
			lines.push('\t\t},');
		}
		if (portal.statusItems?.length) {
			lines.push('\t\tstatusItems: [');
			for (const item of portal.statusItems.slice(0, 4)) {
				lines.push('\t\t\t{');
				lines.push(`\t\t\t\tlabel: ${tsString(item.label)},`);
				lines.push(`\t\t\t\tvalue: ${tsString(item.value)},`);
				lines.push('\t\t\t},');
			}
			lines.push('\t\t],');
		}
		if (portal.popularQuestions) {
			lines.push('\t\tpopularQuestions: [');
			for (const item of portal.popularQuestions) {
				lines.push('\t\t\t{');
				lines.push(`\t\t\t\tlabel: ${tsString(item.label)},`);
				lines.push(`\t\t\t\thref: ${tsString(item.href)},`);
				if (item.context) lines.push(`\t\t\t\tcontext: ${tsString(item.context)},`);
				lines.push('\t\t\t},');
			}
			lines.push('\t\t],');
		}
		if (portal.startHere) {
			lines.push('\t\tstartHere: [');
			for (const item of portal.startHere) {
				lines.push('\t\t\t{');
				lines.push(`\t\t\t\ttitle: ${tsString(item.title)},`);
				lines.push(`\t\t\t\tdescription: ${tsString(item.description)},`);
				lines.push(`\t\t\t\thref: ${tsString(item.href)},`);
				if (item.image) lines.push(`\t\t\t\timage: ${tsString(item.image)},`);
				if (item.label) lines.push(`\t\t\t\tlabel: ${tsString(item.label)},`);
				if (item.badge) lines.push(`\t\t\t\tbadge: ${tsString(item.badge)},`);
				lines.push('\t\t\t},');
			}
			lines.push('\t\t],');
		}
		if (portal.evidence) {
			lines.push('\t\tevidence: {');
			if (portal.evidence.title) lines.push(`\t\t\ttitle: ${tsString(portal.evidence.title)},`);
			if (portal.evidence.description) {
				lines.push(`\t\t\tdescription: ${tsString(portal.evidence.description)},`);
			}
			lines.push('\t\t\titems: [');
			for (const item of portal.evidence.items) {
				lines.push('\t\t\t\t{');
				lines.push(`\t\t\t\t\timage: ${tsString(item.image)},`);
				lines.push(`\t\t\t\t\talt: ${tsString(item.alt)},`);
				if (item.caption) lines.push(`\t\t\t\t\tcaption: ${tsString(item.caption)},`);
				if (item.href) lines.push(`\t\t\t\t\thref: ${tsString(item.href)},`);
				lines.push('\t\t\t\t},');
			}
			lines.push('\t\t\t],');
			lines.push('\t\t},');
		}
		if (portal.primaryNav && portal.primaryNav.length > 0) {
			lines.push('\t\tprimaryNav: [');
			for (const item of portal.primaryNav) {
				lines.push(`\t\t\t{ label: ${tsString(item.label)}, href: ${tsString(item.href)} },`);
			}
			lines.push('\t\t],');
		}
		if (portal.showRecentlyUpdated !== undefined) {
			lines.push(`\t\tshowRecentlyUpdated: ${portal.showRecentlyUpdated},`);
		}
		if (portal.maxRecent !== undefined) lines.push(`\t\tmaxRecent: ${portal.maxRecent},`);
		if (portal.showAbout !== undefined) lines.push(`\t\tshowAbout: ${portal.showAbout},`);
		lines.push('\t},');
	}

	lines.push('\tcategories: [');
	for (const category of config.categories) {
		lines.push('\t\t{');
		lines.push(`\t\t\tid: ${tsString(category.id)},`);
		lines.push(`\t\t\tlabel: ${tsString(category.label)},`);
		lines.push(`\t\t\tdescription: ${tsString(category.description)},`);
		lines.push(`\t\t\ticon: ${tsString(category.icon)},`);
		lines.push(`\t\t\torder: ${category.order},`);
		if (category.image) lines.push(`\t\t\timage: ${tsString(category.image)},`);
		lines.push('\t\t},');
	}
	lines.push('\t],');
	if (config.pages && config.pages.length > 0) {
		lines.push('\tpages: [');
		for (const page of config.pages) {
			lines.push('\t\t{');
			lines.push(`\t\t\tid: ${tsString(page.id)},`);
			lines.push(`\t\t\tpageType: ${tsString(page.pageType ?? 'how-to')},`);
			if (page.homepagePriority !== undefined) lines.push(`\t\t\thomepagePriority: ${page.homepagePriority},`);
			lines.push('\t\t\tsections: [');
			for (const section of page.sections ?? []) lines.push(`\t\t\t\t{ id: ${tsString(section.id)}, title: ${tsString(section.title)} },`);
			lines.push('\t\t\t],');
			lines.push(`\t\t\tslug: ${tsString(page.slug)},`);
			lines.push(`\t\t\trole: ${tsString(page.role)},`);
			lines.push(`\t\t\tassetType: ${tsString(page.assetType)},`);
			lines.push(`\t\t\tintents: [${page.intents.map((intent) => tsString(intent)).join(', ')}],`);
			lines.push('\t\t\trelations: [');
			for (const relation of page.relations) {
				lines.push('\t\t\t\t{');
				lines.push(`\t\t\t\t\tpageId: ${tsString(relation.pageId)},`);
				lines.push(`\t\t\t\t\ttype: ${tsString(relation.type)},`);
				lines.push('\t\t\t\t},');
			}
			lines.push('\t\t\t],');
			lines.push('\t\t\tsources: [');
			for (const source of page.sources) {
				lines.push('\t\t\t\t{');
				lines.push(`\t\t\t\t\ttype: ${tsString(source.type)},`);
				lines.push(`\t\t\t\t\ttitle: ${tsString(source.title)},`);
				lines.push(`\t\t\t\t\turl: ${tsString(source.url)},`);
				lines.push('\t\t\t\t},');
			}
			lines.push('\t\t\t],');
			lines.push('\t\t\tevidence: [');
			for (const item of page.evidence) {
				lines.push('\t\t\t\t{');
				lines.push(`\t\t\t\t\tasset: ${tsString(item.asset)},`);
				lines.push(`\t\t\t\t\talt: ${tsString(item.alt)},`);
				if (item.caption) lines.push(`\t\t\t\t\tcaption: ${tsString(item.caption)},`);
				if (item.sourceLabel) lines.push(`\t\t\t\t\tsourceLabel: ${tsString(item.sourceLabel)},`);
				if (item.sourceType) lines.push(`\t\t\t\t\tsourceType: ${tsString(item.sourceType)},`);
				if (item.sourceUrl) lines.push(`\t\t\t\t\tsourceUrl: ${tsString(item.sourceUrl)},`);
				lines.push('\t\t\t\t},');
			}
			lines.push('\t\t\t],');
			if (page.socialImage) {
				lines.push('\t\t\tsocialImage: {');
				lines.push(`\t\t\t\tasset: ${tsString(page.socialImage.asset)},`);
				lines.push(`\t\t\t\talt: ${tsString(page.socialImage.alt)},`);
				lines.push('\t\t\t},');
			}
			lines.push('\t\t},');
		}
		lines.push('\t],');
	}
	if (config.routes && config.routes.length > 0) {
		lines.push('\troutes: [');
		for (const route of config.routes) {
			lines.push('\t\t{');
			lines.push(`\t\t\tid: ${tsString(route.id)},`);
			if (route.eyebrow) lines.push(`\t\t\teyebrow: ${tsString(route.eyebrow)},`);
			lines.push(`\t\t\ttitle: ${tsString(route.title)},`);
			lines.push(`\t\t\tdescription: ${tsString(route.description)},`);
			lines.push(`\t\t\thref: ${tsString(route.href)},`);
			if (route.visual) lines.push(`\t\t\tvisual: ${tsString(route.visual)},`);
			lines.push('\t\t\tpages: [');
			for (const page of route.pages) {
				lines.push('\t\t\t\t{');
				lines.push(`\t\t\t\t\tpageId: ${tsString(page.pageId)},`);
				lines.push(`\t\t\t\t\thref: ${tsString(page.href)},`);
				lines.push(`\t\t\t\t\ttitle: ${tsString(page.title)},`);
				lines.push(`\t\t\t\t\tdescription: ${tsString(page.description)},`);
				if (page.eyebrow) lines.push(`\t\t\t\t\teyebrow: ${tsString(page.eyebrow)},`);
				if (page.image) lines.push(`\t\t\t\t\timage: ${tsString(page.image)},`);
				lines.push('\t\t\t\t},');
			}
			lines.push('\t\t\t],');
			if (route.fastAnswers && route.fastAnswers.length > 0) {
				lines.push('\t\t\tfastAnswers: [');
				for (const answer of route.fastAnswers) {
					lines.push('\t\t\t\t{');
					lines.push(`\t\t\t\t\tquestion: ${tsString(answer.question)},`);
					lines.push(`\t\t\t\t\tanswer: ${tsString(answer.answer)},`);
					lines.push(`\t\t\t\t\tpageId: ${tsString(answer.pageId)},`);
					lines.push(`\t\t\t\t\thref: ${tsString(answer.href)},`);
					lines.push('\t\t\t\t},');
				}
				lines.push('\t\t\t],');
			}
			lines.push('\t\t},');
		}
		lines.push('\t],');
	}
	if (config.trust) {
		lines.push('\ttrust: {');
		lines.push(`\t\tenabled: ${config.trust.enabled},`);
		lines.push('\t\tpages: {');
		for (const kind of TRUST_PAGE_KINDS) {
			const page = config.trust.pages[kind];
			if (!page?.enabled) continue;
			lines.push(`\t\t\t${kind}: {`);
			lines.push('\t\t\t\tenabled: true,');
			lines.push(`\t\t\t\tslug: ${tsString(page.slug)},`);
			lines.push(`\t\t\t\tpath: ${tsString(page.path)},`);
			lines.push(`\t\t\t\ttitle: ${tsString(page.title)},`);
			lines.push(`\t\t\t\trobots: ${tsString(page.robots)},`);
			lines.push('\t\t\t},');
		}
		lines.push('\t\t},');
		lines.push('\t},');
	}
	if (config.analytics) {
		lines.push('\tanalytics: {');
		lines.push('\t\tenabled: true,');
		if (config.analytics.siteId) lines.push(`\t\tsiteId: ${tsString(config.analytics.siteId)},`);
		if (config.analytics.gameSlug) lines.push(`\t\tgameSlug: ${tsString(config.analytics.gameSlug)},`);
		if (config.analytics.templateVersion) lines.push(`\t\ttemplateVersion: ${tsString(config.analytics.templateVersion)},`);
		if (config.analytics.launchDate) lines.push(`\t\tlaunchDate: ${tsString(config.analytics.launchDate)},`);
		if (config.analytics.ga4) lines.push(`\t\tga4: { enabled: ${config.analytics.ga4.enabled} },`);
		if (config.analytics.vercelAnalytics) lines.push(`\t\tvercelAnalytics: { enabled: ${config.analytics.vercelAnalytics.enabled} },`);
		if (config.analytics.provider) lines.push(`\t\tprovider: ${tsString(config.analytics.provider)},`);
		if (config.analytics.measurementId) lines.push(`\t\tmeasurementId: ${tsString(config.analytics.measurementId)},`);
		if (config.analytics.trackOutbound !== undefined) lines.push(`\t\ttrackOutbound: ${config.analytics.trackOutbound},`);
		lines.push('\t},');
	}
	if (config.monetization) {
		lines.push('\tmonetization: {');
		lines.push('\t\tenabled: true,');
		lines.push('\t\taffiliate: {');
		lines.push(`\t\t\tenabled: ${config.monetization.affiliate.enabled},`);
		lines.push(`\t\t\tdisclosure: ${config.monetization.affiliate.disclosure},`);
		lines.push('\t\t},');
		lines.push('\t\tads: {');
		lines.push(`\t\t\tenabled: ${config.monetization.ads.enabled},`);
		lines.push('\t\t},');
		lines.push('\t},');
	}
	if (config.social?.defaultImage) {
		lines.push('\tsocial: {');
		lines.push('\t\tdefaultImage: {');
		lines.push(`\t\t\tasset: ${tsString(config.social.defaultImage.asset)},`);
		lines.push(`\t\t\talt: ${tsString(config.social.defaultImage.alt)},`);
		lines.push('\t\t},');
		lines.push('\t},');
	}
	lines.push('};', '');
	return lines.join('\n');
}

function assetById(spec: SiteSpec, id: string | null | undefined) {
	if (!id) return undefined;
	return spec.assets.find((asset) => asset.id === id);
}

function buildTrustConfig(spec: SiteSpec): GameTrustConfig | undefined {
	const hub = normalizeHubPath(spec.site.hubPath);
	const locale = spec.site.locale;
	const pages: GameTrustConfig['pages'] = {};
	let anyEnabled = false;
	if (spec.trust?.enabled) {
		for (const kind of CORE_TRUST_PAGE_KINDS) {
			const entry = spec.trust[kind];
			if (!entry?.enabled) continue;
			anyEnabled = true;
			const slug = TRUST_PAGE_SLUGS[kind];
			pages[kind] = {
				enabled: true,
				slug,
				path: pageHref(hub, slug),
				title: trustTitleForLocale(kind, locale),
				robots: trustRobotsForKind(kind),
			};
		}
	}
	if (isAffiliateDisclosureEnabled(spec)) {
		anyEnabled = true;
		const slug = TRUST_PAGE_SLUGS.affiliateDisclosure;
		pages.affiliateDisclosure = {
			enabled: true,
			slug,
			path: pageHref(hub, slug),
			title: trustTitleForLocale('affiliateDisclosure', locale),
			robots: trustRobotsForKind('affiliateDisclosure'),
		};
	}
	if (!anyEnabled) return undefined;
	return { enabled: true, pages };
}

function trustSourceFor(spec: SiteSpec, kind: TrustPageKind): string {
	if (kind === 'affiliateDisclosure') {
		return spec.monetization!.affiliate.source!;
	}
	return spec.trust![kind as Exclude<TrustPageKind, 'affiliateDisclosure'>]!.source;
}

function buildTrustMarkdown(
	spec: SiteSpec,
	kind: TrustPageKind,
	rootDir: string,
	specDir: string,
): string {
	const source = trustSourceFor(spec, kind);
	const sourceAbs = resolveInputPath(rootDir, specDir, source);
	const rawBody = readFileSync(sourceAbs, 'utf8');
	// The Experience article renderer owns H1. Writer/source H1 lines are
	// removed at the generation boundary so content cannot create a second H1.
	const body = rawBody
		.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '')
		.replace(/^#\s+.+\r?\n?/gm, '');
	const locale = spec.site.locale;
	const fields: Array<[string, unknown]> = [
		['title', trustTitleForLocale(kind, locale)],
		['description', trustDescriptionForLocale(kind, locale, spec.game.name)],
		['trustType', kind],
		['robots', trustRobotsForKind(kind)],
	];
	const banner = [
		'<!--',
		'  This file is generated from site-spec.yaml.',
		'  Do not edit directly.',
		'  Run npm run site:generate instead.',
		`  Source: ${toPosix(source)}`,
		'-->',
		'',
	].join('\n');
	return `${renderFrontmatter(fields)}${banner}${body.replace(/\s*$/, '\n')}`;
}

function trustOutputPath(kind: TrustPageKind): string {
	return toPosix(path.join('src/content/trust', `${TRUST_PAGE_SLUGS[kind]}.md`));
}

function buildSocialConfig(spec: SiteSpec): GameSocialConfig | undefined {
	if (!spec.social?.defaultImage) return undefined;
	return {
		defaultImage: {
			asset: spec.social.defaultImage.asset,
			alt: spec.social.defaultImage.alt,
		},
	};
}

function buildAnalyticsConfig(spec: SiteSpec): GameAnalyticsConfig | undefined {
	if (!spec.analytics?.enabled) return undefined;
	if (spec.analytics.siteId) {
		return {
			enabled: true,
			siteId: spec.analytics.siteId,
			gameSlug: spec.analytics.gameSlug,
			templateVersion: spec.analytics.templateVersion,
			launchDate: spec.analytics.launchDate,
			ga4: spec.analytics.ga4,
			vercelAnalytics: spec.analytics.vercelAnalytics,
		};
	}
	return {
		enabled: true,
		ga4: spec.analytics.ga4,
		vercelAnalytics: spec.analytics.vercelAnalytics,
		provider: spec.analytics.provider,
		measurementId: spec.analytics.measurementId,
		trackOutbound: spec.analytics.trackOutbound,
	};
}

function buildMonetizationConfig(spec: SiteSpec): GameMonetizationConfig | undefined {
	if (!spec.monetization?.enabled) return undefined;
	return {
		enabled: true,
		affiliate: {
			enabled: spec.monetization.affiliate.enabled,
			disclosure: spec.monetization.affiliate.disclosure,
		},
		ads: {
			enabled: spec.monetization.ads.enabled,
		},
	};
}

function buildGameConfig(spec: SiteSpec, rootDir: string, specDir: string): GameConfig {
	// Deployment identity stays in site-spec.yaml only. Never emit it into site.generated.ts.
	const hero = assetById(spec, spec.theme.heroAssetId);
	const portal = spec.homepage;
	const config: GameConfig = {
		presentationVersion: spec.presentationVersion,
		name: spec.game.name,
		shortName: spec.site.shortName,
		title: spec.site.title,
		description: spec.site.description,
		tagline: spec.game.tagline,
		siteUrl: spec.site.siteUrl,
		siteMode: spec.site.mode,
		hubPath: normalizeHubPath(spec.site.hubPath),
		hubTitle: spec.game.hubTitle,
		locale: spec.site.locale,
		releaseStatus: spec.game.releaseStatus,
		releaseDate: mapReleaseDate(spec.game),
		developer: spec.game.developer,
		publisher: spec.game.publisher,
		platforms: [...spec.game.platforms],
		assets: buildAssetManifest(spec, rootDir, specDir),
		runtimeCompatibility: { ...RUNTIME_COMPATIBILITY, fingerprint: RUNTIME_COMPATIBILITY_FINGERPRINT },
		accentColor: spec.theme.accentColor,
		accentForeground: spec.theme.accentForeground,
		heroImage: hero?.target,
		heroAlt: hero?.alt ?? spec.game.name,
		heroPosition: spec.theme.heroPosition ?? 'center',
		disclaimer: spec.site.disclaimer,
		categories: spec.categories.map((category) => ({
			id: category.id,
			label: category.label,
			description: category.description,
			icon: category.icon,
			order: category.order,
			image: assetById(spec, category.imageAssetId ?? undefined)?.target,
		})),
		pages: spec.pages.map((page) => ({
			id: page.id,
			pageType: page.pageType,
			homepagePriority: page.homepagePriority,
			sections: page.sections.map((section) => ({ ...section })),
			slug: publicSlugForPage(spec.site.hubPath, page.slug),
			role: page.role,
			intents: [...page.intents],
			relations: page.relations.map((relation) => ({ ...relation })),
			assetType: page.assetType,
			sources: page.sources.map((source) => ({ ...source })),
			evidence: page.evidence.map((item) => ({ ...item })),
			socialImage: page.socialImage ? { ...page.socialImage } : undefined,
		})),
		routes: spec.routes?.map((route) => ({
			id: route.id,
			eyebrow: route.eyebrow,
			title: route.title,
			description: route.description,
			href: routeHref(spec.site.hubPath, route.id),
			visual: route.visualAssetId ? assetById(spec, route.visualAssetId)?.target : undefined,
			pages: route.pages.map((pageId) => {
				const page = spec.pages.find((entry) => entry.id === pageId)!;
				const cover = assetById(spec, page.coverAssetId ?? undefined);
				return {
					pageId: page.id,
					href: publicHrefForPage(spec.site.hubPath, page.slug),
					title: page.title,
					label: page.sidebarLabel ?? page.title,
					description: page.description,
					eyebrow: page.eyebrow,
					image: cover?.target,
				};
			}),
			fastAnswers: route.fastAnswers?.map((answer) => {
				const page = spec.pages.find((entry) => entry.id === answer.pageId)!;
				return {
					question: answer.question,
					answer: answer.answer,
					pageId: answer.pageId,
					href: publicHrefForPage(spec.site.hubPath, page.slug),
				};
			}),
		})),
		portal: {
			primaryNav: portal.primaryNav?.map((item) => ({
				label: item.label,
				href: resolveLinkTarget(item, spec),
			})),
			heroBadge: portal.heroBadge,
			primaryCta: portal.primaryCta
				? { label: portal.primaryCta.label, href: resolveLinkTarget(portal.primaryCta, spec) }
				: undefined,
			secondaryCta: portal.secondaryCta
				? { label: portal.secondaryCta.label, href: resolveLinkTarget(portal.secondaryCta, spec) }
				: undefined,
			statusItems: portal.statusItems?.length ? portal.statusItems.slice(0, 4) : undefined,
		popularQuestions: portal.popularQuestions?.map((item) => {
			const page = spec.pages.find((entry) => entry.id === item.pageId)!;
			return {
				label: item.label,
				href: publicHrefForPage(spec.site.hubPath, page.slug),
				context: item.context,
			};
		}),
			startHere: portal.startHere?.map((item) => {
				const page = spec.pages.find((entry) => entry.id === item.pageId)!;
				return {
					title: page.title,
					description: page.description,
					href: publicHrefForPage(spec.site.hubPath, page.slug),
					label: item.label,
					badge: item.badge,
					image: assetById(spec, page.coverAssetId ?? undefined)?.target,
				};
			}),
			evidence: portal.evidence
				? {
						title: portal.evidence.title,
						description: portal.evidence.description,
						items: portal.evidence.items.map((item) => {
							const asset = assetById(spec, item.assetId)!;
							const page = item.pageId
								? spec.pages.find((entry) => entry.id === item.pageId)
								: undefined;
							return {
					image: asset.target,
					alt: asset.alt,
					caption: item.caption,
					href: page ? publicHrefForPage(spec.site.hubPath, page.slug) : undefined,
							};
						}),
					}
				: undefined,
			showRecentlyUpdated: true,
			maxRecent: 3,
		},
		trust: buildTrustConfig(spec),
		analytics: buildAnalyticsConfig(spec),
		social: buildSocialConfig(spec),
		monetization: buildMonetizationConfig(spec),
	};
	return config;
}

function buildHubMdx(spec: SiteSpec): string {
	const hubSlug = expectedHubSlug(spec.site.hubPath);
	const fields: Array<[string, unknown]> = [
		['title', spec.game.hubTitle],
		['description', spec.site.description],
		['template', 'splash'],
	];
	if (hubSlug) fields.push(['slug', hubSlug]);
	return `${renderFrontmatter(fields)}\n`;
}

function normalizeTypedSections(markdown: string, sections: SiteSpec['pages'][number]['sections']): string {
	const lines = markdown.split(/\r?\n/);
	const chunks: string[][] = [];
	let current: string[] = [];
	let fenced = false;
	for (const line of lines) {
		if (/^\s*```/.test(line)) fenced = !fenced;
		if (!fenced && /^##\s+/.test(line)) {
			chunks.push(current);
			current = [];
			continue;
		}
		current.push(line);
	}
	chunks.push(current);
	if (sections.length === 0) return lines.filter((line) => !/^##\s+/.test(line)).join('\n');
	const headingBodies = chunks.length > 1 ? chunks.slice(1) : chunks;
	const bodies = sections.map((_, index) => index === 0 && chunks.length > 1
		? [...(chunks[0] ?? []), ...(headingBodies[0] ?? [])]
		: headingBodies[index] ?? []);
	if (chunks.length > sections.length + 1) {
		bodies[bodies.length - 1] = [...(bodies[bodies.length - 1] ?? []), ...chunks.slice(sections.length + 1).flat()];
	}
	return sections
		.map((section, index) => `## ${section.title}\n\n${(bodies[index] ?? []).join('\n').trim()}`)
		.join('\n\n')
		.trim();
}

function buildPageMarkdown(spec: SiteSpec, pageId: string, rootDir: string, specDir: string): string {
	const page = spec.pages.find((entry) => entry.id === pageId)!;
	const sourceAbs = resolveInputPath(rootDir, specDir, page.source);
	const rawBody = readFileSync(sourceAbs, 'utf8');
	// Strip accidental frontmatter and Writer H1s; the article renderer owns both.
	const body = rawBody
		.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '')
		.replace(/^#\s+.+\r?\n?/gm, '');
	const resolved = normalizeTypedSections(resolvePlaceholders(body, spec, page.id), page.sections);
	const publicSlug = publicSlugForPage(spec.site.hubPath, page.slug);
	const relatedSlugs = page.related.map((relatedId) => {
		const related = spec.pages.find((entry) => entry.id === relatedId)!;
		return publicSlugForPage(spec.site.hubPath, related.slug);
	});
	const relationViews = page.relations.map((relation) => {
		const target = spec.pages.find((entry) => entry.id === relation.pageId)!;
		return {
			slug: publicSlugForPage(spec.site.hubPath, target.slug),
			type: relation.type,
		};
	});
	const cover = assetById(spec, page.coverAssetId ?? undefined);
	const cardImage = assetById(spec, page.cardImageAssetId ?? undefined);
	const sidebar = {
		label: page.sidebarLabel,
		order: page.sidebarOrder,
		badge: page.sidebarBadge,
	};
	const fields: Array<[string, unknown]> = [
		['title', page.title],
		['description', page.description],
		['category', page.category],
		['slug', publicSlug],
		['pageType', page.pageType],
		['sections', page.sections],
		['homepagePriority', page.homepagePriority],
		['status', page.status],
		['featured', page.featured],
		['role', page.role],
		['assetType', page.assetType],
		['sidebar', sidebar],
	];
	if (page.lastUpdated) fields.push(['lastUpdated', page.lastUpdated]);
	if (page.trust) fields.push(['trust', page.trust]);
	if (page.head && page.head.length > 0) fields.push(['head', page.head]);
	if (page.intents.length > 0) fields.push(['intents', page.intents]);
	if (page.quickAnswer) fields.push(['quickAnswer', page.quickAnswer]);
	if (relatedSlugs.length > 0) fields.push(['related', relatedSlugs]);
	if (relationViews.length > 0) fields.push(['relations', relationViews]);
	if (page.sources.length > 0) fields.push(['sources', page.sources]);
	if (page.evidence.length > 0) fields.push(['evidence', page.evidence]);
	if (page.socialImage) fields.push(['socialImage', page.socialImage]);
	if (cover) {
		fields.push(['cover', `../../../assets/${cover.target}`]);
		fields.push(['coverMedia', {
			alt: cover.alt,
			kind: cover.kind ?? 'cover',
			aspectRatio: cover.aspectRatio ?? '16:9',
			objectPosition: cover.objectPosition,
			sourceLabel: cover.sourceType === 'official' ? 'Official' : undefined,
			sourceUrl: cover.sourceUrl,
		}]);
	}
	if (cardImage) fields.push(['cardImage', `../../../assets/${cardImage.target}`]);
	if (page.changeSummary) fields.push(['changeSummary', page.changeSummary]);
	if (page.eyebrow) fields.push(['eyebrow', page.eyebrow]);
	if (page.facts && page.facts.length > 0) fields.push(['facts', page.facts]);

	const banner = [
		'<!--',
		'  This file is generated from site-spec.yaml.',
		'  Do not edit directly.',
		'  Run npm run site:generate instead.',
		`  Source: ${toPosix(page.source)}`,
		'-->',
		'',
	].join('\n');

	return `${renderFrontmatter(fields)}${banner}${resolved.replace(/\s*$/, '\n')}`;
}

function pageOutputPath(spec: SiteSpec, pageId: string): string {
	const page = spec.pages.find((entry) => entry.id === pageId)!;
	return toPosix(path.join('src/content/docs', page.category, `${page.slug}.md`));
}

function planDemoDeletes(rootDir: string, existingManifest: SiteGeneratorManifest | null): PlanItem[] {
	const demo = loadDemoManifest();
	const items: PlanItem[] = [];
	for (const file of demo.files) {
		const abs = path.join(rootDir, file.path);
		if (!existsSync(abs)) continue;
		if (existingManifest && isPathManaged(existingManifest, file.path)) {
			// Already replaced by a previous generation cycle; generator manages lifecycle via expected set.
			continue;
		}
		const currentHash = sha256File(abs);
		if (currentHash !== file.sha256) {
			items.push({
				action: 'skip',
				path: file.path,
				reason: 'Template demo file hash changed; refusing to delete a modified file.',
			});
			continue;
		}
		items.push({
			action: 'delete',
			path: file.path,
			reason: 'Remove unmodified Example Game demo page listed in template-demo-manifest.json.',
		});
	}
	return items;
}

function assertNoCollision(
	rootDir: string,
	relativePath: string,
	existingManifest: SiteGeneratorManifest | null,
	expectedManaged: Set<string>,
): void {
	const abs = path.join(rootDir, relativePath);
	if (!existsSync(abs)) return;
	if (isPathManaged(existingManifest, relativePath)) return;
	if (expectedManaged.has(relativePath) && existingManifest === null) {
		// First generation onto template files that we intentionally overwrite (site.generated / index.mdx).
		const overwriteAllowlist = new Set([
			'src/config/site.generated.ts',
			'src/content/docs/index.mdx',
			MANIFEST_REL,
		]);
		if (overwriteAllowlist.has(relativePath)) return;
	}
	// Demo files scheduled for delete are fine.
	const demoPaths = new Set(loadDemoManifest().files.map((file) => file.path));
	if (demoPaths.has(relativePath)) return;

	throw new SpecValidationError(
		'Refusing to overwrite a non-managed file.',
		relativePath,
		relativePath,
		relativePath,
		'Move or rename the existing file, or add it to the generator managed manifest via a prior generate run. No --force is provided.',
	);
}

const MANIFEST_REL = '.site-generator-manifest.json';

export function buildPlan(loaded: LoadedSiteSpec): GeneratorPlan {
	const { spec, rootDir, specPath } = loaded;
	const specDir = path.dirname(specPath);
	const existingManifest = readManifest(rootDir);
	const specRelativePath = toPosix(path.relative(rootDir, specPath) || path.basename(specPath));
	const warnings: string[] = [];
	for (const asset of spec.assets) {
		if (asset.usageStatus !== 'approved') {
			warnings.push(
				`Asset "${asset.id}" has usageStatus=${asset.usageStatus}; do not treat copyright clearance as complete.`,
			);
		}
	}

	const expectedFiles = new Map<
		string,
		{ content?: string; copyFrom?: string; kind: ManagedFileEntry['kind']; assetId?: string }
	>();

	const gameConfig = buildGameConfig(spec, loaded.rootDir, path.dirname(loaded.specPath));
	expectedFiles.set('src/config/site.generated.ts', {
		content: renderSiteGeneratedTs(gameConfig),
		kind: 'config',
	});
	expectedFiles.set('src/content/docs/index.mdx', {
		content: buildHubMdx(spec),
		kind: 'hub',
	});

	for (const page of spec.pages) {
		const rel = pageOutputPath(spec, page.id);
		expectedFiles.set(rel, {
			content: buildPageMarkdown(spec, page.id, rootDir, specDir),
			kind: 'page',
		});
	}

	if (spec.trust?.enabled) {
		for (const kind of CORE_TRUST_PAGE_KINDS) {
			const entry = spec.trust[kind];
			if (!entry?.enabled) continue;
			expectedFiles.set(trustOutputPath(kind), {
				content: buildTrustMarkdown(spec, kind, rootDir, specDir),
				kind: 'trust',
			});
		}
	}
	if (isAffiliateDisclosureEnabled(spec)) {
		expectedFiles.set(trustOutputPath('affiliateDisclosure'), {
			content: buildTrustMarkdown(spec, 'affiliateDisclosure', rootDir, specDir),
			kind: 'trust',
		});
	}

	for (const asset of spec.assets) {
		const rel = toPosix(path.join('src/assets', asset.target));
		const sourceAbs = resolveInputPath(rootDir, specDir, asset.source);
		expectedFiles.set(rel, {
			copyFrom: toPosix(path.relative(rootDir, sourceAbs)),
			kind: 'asset',
			assetId: asset.id,
		});
	}

	// IndexNow key: if the key already exists on disk, track both the
	// metadata file and the public verification file so manifest cleanup
	// won't delete them. Key *creation* is handled by generateSite(),
	// not buildPlan().
	const existingKey = readIndexNowKey(rootDir);
	if (existingKey) {
		expectedFiles.set(INDEXNOW_KEY_REL, {
			content: JSON.stringify(existingKey, null, '\t') + '\n',
			kind: 'config',
		});
		const keyFileRel = indexnowKeyFileRel(existingKey.key);
		expectedFiles.set(keyFileRel, {
			content: existingKey.key,
			kind: 'other',
		});
	}

	const expectedManaged = new Set(expectedFiles.keys());
	expectedManaged.add(MANIFEST_REL);

	const items: PlanItem[] = [];
	const deletes: string[] = [];

	for (const demoItem of planDemoDeletes(rootDir, existingManifest)) {
		items.push(demoItem);
		if (demoItem.action === 'delete') deletes.push(demoItem.path);
		if (demoItem.action === 'skip' && demoItem.reason.includes('hash changed')) {
			warnings.push(demoItem.reason + ` (${demoItem.path})`);
		}
	}

	// Remove previously managed pages/assets that are no longer expected.
	if (existingManifest) {
		for (const entry of existingManifest.managedFiles) {
			if (expectedManaged.has(entry.path)) continue;
			if (entry.path === MANIFEST_REL) continue;
			if (entry.kind === 'spec') continue;
			if (!existsSync(path.join(rootDir, entry.path))) continue;
			deletes.push(entry.path);
			items.push({
				action: 'delete',
				path: entry.path,
				reason: 'Previously managed file is no longer produced by the current site-spec.',
			});
		}
	}

	for (const [rel, expected] of expectedFiles) {
		assertNoCollision(rootDir, rel, existingManifest, expectedManaged);
		const abs = path.join(rootDir, rel);
		if (!existsSync(abs)) {
			items.push({
				action: expected.copyFrom ? 'copy' : 'create',
				path: rel,
				reason: expected.copyFrom ? `Copy asset from ${expected.copyFrom}` : 'Create generated file from site-spec.',
			});
			continue;
		}
		if (expected.copyFrom) {
			const current = sha256File(abs);
			const incoming = sha256File(path.resolve(rootDir, expected.copyFrom));
			items.push({
				action: current === incoming ? 'skip' : 'update',
				path: rel,
				reason:
					current === incoming
						? 'Asset already matches source.'
						: `Update asset from ${expected.copyFrom}`,
			});
			continue;
		}
		const current = readFileSync(abs, 'utf8');
		items.push({
			action: current === expected.content ? 'skip' : 'update',
			path: rel,
			reason: current === expected.content ? 'Generated file already up to date.' : 'Update generated file from site-spec.',
		});
	}

	items.push({
		action: existsSync(manifestPath(rootDir)) ? 'update' : 'create',
		path: MANIFEST_REL,
		reason: 'Write managed-files manifest.',
	});

	items.sort((a, b) => a.path.localeCompare(b.path) || a.action.localeCompare(b.action));

	return {
		rootDir,
		specRelativePath,
		items,
		expectedFiles,
		deletes: [...new Set(deletes)].sort(),
		warnings,
	};
}

function materializeManifest(plan: GeneratorPlan, loaded: LoadedSiteSpec): {
	manifest: SiteGeneratorManifest;
	body: string;
} {
	const managedFiles: ManagedFileEntry[] = [];
	const managedAssets: ManagedAssetEntry[] = [];

	for (const [rel, expected] of [...plan.expectedFiles.entries()].sort((a, b) =>
		a[0].localeCompare(b[0]),
	)) {
		if (expected.copyFrom) {
			const sourceAbs = path.resolve(plan.rootDir, expected.copyFrom);
			const hash = sha256File(sourceAbs);
			managedFiles.push({ path: rel, sha256: hash, kind: 'asset' });
			const asset = loaded.spec.assets.find((entry) => entry.id === expected.assetId)!;
			managedAssets.push({
				id: expected.assetId!,
				target: rel.replace(/^src\/assets\//, ''),
				source: toPosix(expected.copyFrom),
				sha256: hash,
				usageStatus: asset.usageStatus,
				sourceType: asset.sourceType,
			});
			continue;
		}
		managedFiles.push({
			path: rel,
			sha256: sha256Text(expected.content!),
			kind: expected.kind,
		});
	}

	// Manifest path is tracked for collision protection but omitted from self-hashed entries
	// to keep serialization idempotent.
	const manifest = buildManifest({
		spec: loaded.spec,
		specHash: loaded.specHash,
		specRelativePath: plan.specRelativePath,
		managedFiles,
		managedAssets,
	});
	return { manifest, body: serializeManifest(manifest) };
}

function writeTextFile(rootDir: string, relativePath: string, content: string) {
	const abs = path.join(rootDir, relativePath);
	ensureInsideRoot(rootDir, abs, relativePath);
	mkdirSync(path.dirname(abs), { recursive: true });
	writeFileSync(abs, content, 'utf8');
}

function copyAsset(rootDir: string, relativeTarget: string, relativeSource: string) {
	const absTarget = path.join(rootDir, relativeTarget);
	const absSource = path.resolve(rootDir, relativeSource);
	ensureInsideRoot(rootDir, absTarget, relativeTarget);
	ensureInsideRoot(rootDir, absSource, relativeSource);
	mkdirSync(path.dirname(absTarget), { recursive: true });
	copyFileSync(absSource, absTarget);
}

export function applyPlan(loaded: LoadedSiteSpec, plan: GeneratorPlan): GeneratorResult {
	const written: string[] = [];
	const deleted: string[] = [];
	const skipped: string[] = [];

	for (const rel of plan.deletes) {
		const abs = path.join(plan.rootDir, rel);
		if (existsSync(abs)) {
			rmSync(abs);
			deleted.push(rel);
		}
	}

	for (const [rel, expected] of plan.expectedFiles) {
		const abs = path.join(plan.rootDir, rel);
		if (expected.copyFrom) {
			const needsWrite =
				!existsSync(abs) || sha256File(abs) !== sha256File(path.resolve(plan.rootDir, expected.copyFrom));
			if (needsWrite) {
				copyAsset(plan.rootDir, rel, expected.copyFrom);
				written.push(rel);
			} else {
				skipped.push(rel);
			}
			continue;
		}
		if (existsSync(abs) && readFileSync(abs, 'utf8') === expected.content) {
			skipped.push(rel);
			continue;
		}
		writeTextFile(plan.rootDir, rel, expected.content!);
		written.push(rel);
	}

	const { manifest, body } = materializeManifest(plan, loaded);
	const manifestAbs = path.join(plan.rootDir, MANIFEST_REL);
	if (existsSync(manifestAbs) && readFileSync(manifestAbs, 'utf8') === body) {
		skipped.push(MANIFEST_REL);
	} else {
		writeTextFile(plan.rootDir, MANIFEST_REL, body);
		written.push(MANIFEST_REL);
	}

	return {
		ok: true,
		dryRun: false,
		check: false,
		plan,
		written: [...new Set(written)].sort(),
		deleted: [...new Set(deleted)].sort(),
		skipped: [...new Set(skipped)].sort(),
		drift: [],
		manifest,
	};
}

export function checkPlan(loaded: LoadedSiteSpec, plan: GeneratorPlan): GeneratorResult {
	const drift: string[] = [];
	const { manifest, body } = materializeManifest(plan, loaded);

	for (const [rel, expected] of plan.expectedFiles) {
		const abs = path.join(plan.rootDir, rel);
		if (!existsSync(abs) || !statSync(abs).isFile()) {
			drift.push(rel);
			continue;
		}
		if (expected.copyFrom) {
			const current = sha256File(abs);
			const wanted = sha256File(path.resolve(plan.rootDir, expected.copyFrom));
			if (current !== wanted) drift.push(rel);
			continue;
		}
		if (readFileSync(abs, 'utf8') !== expected.content) drift.push(rel);
	}

	const manifestAbs = path.join(plan.rootDir, MANIFEST_REL);
	if (!existsSync(manifestAbs) || readFileSync(manifestAbs, 'utf8') !== body) {
		drift.push(MANIFEST_REL);
	}

	for (const rel of plan.deletes) {
		if (existsSync(path.join(plan.rootDir, rel))) {
			drift.push(rel);
		}
	}

	return {
		ok: drift.length === 0,
		dryRun: false,
		check: true,
		plan,
		written: [],
		deleted: [],
		skipped: [],
		drift: [...new Set(drift)].sort(),
		manifest,
	};
}

export interface GenerateOptions {
	specPath: string;
	rootDir?: string;
	dryRun?: boolean;
	check?: boolean;
}

export function generateSite(options: GenerateOptions): GeneratorResult {
	const rootDir = path.resolve(options.rootDir ?? DEFAULT_ROOT);
	const loaded = loadSiteSpec(path.resolve(options.specPath), rootDir);
	const plan = buildPlan(loaded);

	// --- IndexNow key handling -------------------------------------------
	// Key creation is intentionally separated from buildPlan() so that
	// --check and --dry-run never touch the filesystem for the key.
	const existingKeyData = readIndexNowKey(rootDir);
	const keyExists = existingKeyData !== null;
	const keyNeedsCreation = loaded.spec.site.siteUrl && (!keyExists || existingKeyData!.siteUrl !== loaded.spec.site.siteUrl);

	if (keyNeedsCreation) {
		plan.items.push({
			action: 'create',
			path: INDEXNOW_KEY_REL,
			reason: 'Create IndexNow key for this site.',
		});
	}

	if (options.check) {
		if (keyNeedsCreation) {
			// Key doesn't exist yet — that's drift in check mode.
			return { ok: false, dryRun: false, check: true, plan, written: [], deleted: [], skipped: [], drift: [INDEXNOW_KEY_REL], manifest: undefined };
		}
		return checkPlan(loaded, plan);
	}
	if (options.dryRun) {
		return {
			ok: true,
			dryRun: true,
			check: false,
			plan,
			written: [],
			deleted: [],
			skipped: plan.items.filter((item) => item.action === 'skip').map((item) => item.path),
			drift: [],
		};
	}

	// Normal generate: create key if needed, then apply the plan.
	if (keyNeedsCreation) {
		const result = resolveIndexNowKey(rootDir, loaded.spec.site.siteUrl, true);
		if (result) {
			ensureKeyFile(rootDir, result.keyData.key);
			// Add both files to expectedFiles so manifest tracks them.
			plan.expectedFiles.set(INDEXNOW_KEY_REL, {
				content: JSON.stringify(result.keyData, null, '\t') + '\n',
				kind: 'config',
			});
			plan.expectedFiles.set(indexnowKeyFileRel(result.keyData.key), {
				content: result.keyData.key,
				kind: 'other',
			});
		}
	} else if (keyExists) {
		const keyData = readIndexNowKey(rootDir)!;
		ensureKeyFile(rootDir, keyData.key);
	}
	return applyPlan(loaded, plan);
}

export function printPlan(plan: GeneratorPlan): void {
	console.log(`site:generate plan — root=${plan.rootDir}`);
	console.log(`  spec: ${plan.specRelativePath}`);
	for (const warning of plan.warnings) {
		console.warn(`  warning: ${warning}`);
	}
	for (const item of plan.items) {
		console.log(`  ${item.action.padEnd(6)} ${item.path} — ${item.reason}`);
	}
}

export { DEFAULT_ROOT, SpecValidationError };
