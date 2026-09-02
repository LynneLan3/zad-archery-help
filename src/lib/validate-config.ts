import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { GUIDE_STATUSES } from './status';
import {
	canonicalizePath,
	expectedHubSlug,
	normalizeHubPath,
	pageHref,
	PathConfigError,
} from './paths';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ASSETS_DIR = path.join(ROOT, 'src/assets');
const DOCS_DIR = path.join(ROOT, 'src/content/docs');
const INDEX_MDX = path.join(DOCS_DIR, 'index.mdx');

export type ValidateMode = 'template' | 'generated-site';

export const RELEASE_STATUSES = [
	'announced',
	'pre-release',
	'early-access',
	'released',
	'unknown',
] as const;

export class SiteValidationError extends Error {
	constructor(
		message: string,
		readonly field: string,
		readonly value: unknown,
		readonly location: string,
		readonly hint: string,
	) {
		super(
			[
				message,
				`  field: ${field}`,
				`  value: ${stringifyValue(value)}`,
				`  location: ${location}`,
				`  fix: ${hint}`,
			].join('\n'),
		);
		this.name = 'SiteValidationError';
	}
}

function stringifyValue(value: unknown): string {
	if (typeof value === 'string') return JSON.stringify(value);
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

const absoluteUrl = z
	.string()
	.url()
	.refine((value) => /^https?:\/\//i.test(value), {
		message: 'siteUrl must be an absolute http(s) URL',
	});

const accentColor = z
	.string()
	.regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, {
		message: 'accentColor must be a hex color like #0f9b8e',
	});

const isoDate = z.string().refine((value) => {
	if (value === 'TBD' || value === 'unknown' || value === '未定') return true;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}, 'releaseDate must be YYYY-MM-DD, or one of TBD / unknown / 未定');

const categorySchema = z.object({
	id: z
		.string()
		.min(1)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'category id must be kebab-case'),
	label: z.string().min(1),
	description: z.string().min(1),
	icon: z.string().min(1),
	order: z.number().int().positive(),
	image: z.string().min(1).optional(),
});

const hrefSchema = z.string().min(1);

const portalSchema = z
	.object({
		popularQuestions: z
			.array(
				z.object({
					label: z.string().min(1),
					href: hrefSchema,
					context: z.string().min(1).optional(),
				}),
			)
			.optional(),
		showRecentlyUpdated: z.boolean().optional(),
		maxRecent: z.number().int().positive().optional(),
		showAbout: z.boolean().optional(),
		heroBadge: z.string().optional(),
		primaryCta: z.object({ label: z.string().min(1), href: hrefSchema }).optional(),
		secondaryCta: z.object({ label: z.string().min(1), href: hrefSchema }).optional(),
		statusItems: z
			.array(z.object({ label: z.string().min(1), value: z.string().min(1) }))
			.max(4)
			.optional(),
		startHere: z
			.array(
				z.object({
					title: z.string().min(1),
					description: z.string().min(1),
					href: hrefSchema,
					image: z.string().min(1).optional(),
					label: z.string().optional(),
					badge: z.string().optional(),
				}),
			)
			.optional(),
		evidence: z
			.object({
				title: z.string().optional(),
				description: z.string().optional(),
				items: z.array(
					z.object({
						image: z.string().min(1),
						alt: z.string().min(1),
						caption: z.string().optional(),
						href: hrefSchema.optional(),
					}),
				),
			})
			.optional(),
		recentUpdates: z
			.array(
				z.object({
					title: z.string().min(1),
					href: hrefSchema,
					date: isoDate,
					changeSummary: z.string().optional(),
					tag: z.string().optional(),
				}),
			)
			.optional(),
	})
	.optional();

export const routeFastAnswerSchema = z.object({
	question: z.string().min(1),
	answer: z.string().min(1),
	pageId: z
		.string()
		.min(1)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'fastAnswer pageId must be kebab-case'),
	href: hrefSchema,
});

export const routePageSchema = z.object({
	pageId: z
		.string()
		.min(1)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'route pageId must be kebab-case'),
	href: hrefSchema,
	title: z.string().min(1),
	description: z.string().min(1),
	eyebrow: z.string().optional(),
	image: z.string().min(1).optional(),
});

export const routeSchema = z.object({
	id: z
		.string()
		.min(1)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'route id must be kebab-case'),
	eyebrow: z.string().optional(),
	title: z.string().min(1),
	description: z.string().min(1),
	href: hrefSchema,
	visual: z.string().min(1).optional(),
	pages: z.array(routePageSchema).min(1),
	fastAnswers: z.array(routeFastAnswerSchema).max(3).optional(),
});

export const gameConfigSchema = z.object({
	name: z.string().min(1),
	shortName: z.string().min(1),
	title: z.string().min(1).optional(),
	description: z.string().min(1),
	tagline: z.string().min(1),
	siteUrl: absoluteUrl,
	siteMode: z.enum(['standalone', 'hub']).default('standalone'),
	hubPath: z.string().min(1),
	hubTitle: z.string().optional(),
	locale: z.enum(['en', 'zh-CN']).default('en'),
	releaseStatus: z.enum(RELEASE_STATUSES),
	releaseDate: isoDate,
	developer: z.string().min(1),
	publisher: z.string().min(1),
	platforms: z.array(z.string().min(1)).min(1),
	accentColor,
	accentForeground: accentColor.optional(),
	heroImage: z.string().min(1).optional(),
	heroAlt: z.string().optional(),
	heroPosition: z.string().optional(),
	logoImage: z.string().min(1).optional(),
	disclaimer: z.string().min(1).optional(),
	categories: z.array(categorySchema).min(1),
	portal: portalSchema,
	pages: z
		.array(
			z.object({
				id: z
					.string()
					.min(1)
					.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'page id must be kebab-case'),
				slug: z.string().min(1),
				role: z.enum(['core', 'supporting']),
				intents: z.array(
					z
						.string()
						.min(1)
						.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'intent must be kebab-case'),
				),
				relations: z.array(
					z.object({
						pageId: z
							.string()
							.min(1)
							.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'relation pageId must be kebab-case'),
						type: z.enum(['related', 'next-step']),
					}),
				),
				assetType: z.enum(['article', 'reference', 'checklist', 'comparison']),
				sources: z.array(
					z.object({
						type: z.enum(['official', 'steam', 'reddit', 'youtube', 'other']),
						title: z.string().min(1),
						url: z.string().url(),
					}),
				),
				evidence: z.array(
					z.object({
						asset: z.string().min(1),
						alt: z.string().min(1),
						caption: z.string().optional(),
						sourceType: z.enum(['firsthand', 'official', 'community']),
						sourceUrl: z.string().url().optional(),
					}),
				),
				socialImage: z
					.object({
						asset: z.string().min(1),
						alt: z.string().min(1),
					})
					.optional(),
			}),
		)
		.optional(),
	routes: z.array(routeSchema).optional(),
	trust: z
		.object({
			enabled: z.boolean(),
			pages: z.record(
				z.object({
					enabled: z.literal(true),
					slug: z.string().min(1),
					path: z.string().min(1),
					title: z.string().min(1),
					robots: z.enum(['index,follow', 'noindex,follow']),
				}),
			),
		})
		.optional(),
	analytics: z
		.union([
			z.object({
				enabled: z.literal(true),
				siteId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'siteId must be kebab-case'),
				gameSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'gameSlug must be kebab-case'),
				templateVersion: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'templateVersion is invalid'),
				launchDate: z.string().refine((value) => {
					if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
					const date = new Date(`${value}T00:00:00Z`);
					return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
				}, 'launchDate must be YYYY-MM-DD'),
				ga4: z.object({ enabled: z.boolean() }),
				vercelAnalytics: z.object({ enabled: z.boolean() }),
			}),
			z.object({
				enabled: z.literal(true),
				ga4: z.object({ enabled: z.boolean() }),
			}),
			z.object({
				enabled: z.literal(true),
				vercelAnalytics: z.object({ enabled: z.boolean() }),
			}),
			z.object({
				enabled: z.literal(true),
				provider: z.literal('ga4'),
				measurementId: z.string().regex(/^G-[A-Z0-9]+$/, 'measurementId must be a GA4 ID such as G-XXXXXXXXXX'),
				trackOutbound: z.boolean(),
			}),
		])
		.optional(),
	social: z
		.object({
			defaultImage: z
				.object({
					asset: z.string().min(1),
					alt: z.string().min(1),
				})
				.optional(),
		})
		.optional(),
	monetization: z
		.object({
			enabled: z.literal(true),
			affiliate: z.object({
				enabled: z.boolean(),
				disclosure: z.boolean(),
			}),
			ads: z.object({
				enabled: z.boolean(),
			}),
		})
		.optional(),
});

export type ParsedGameConfig = z.infer<typeof gameConfigSchema>;

interface DocPage {
	filePath: string;
	slug: string;
	title: string;
	category?: string;
	status?: string;
	related: string[];
	template?: string;
	href: string;
}

function walkFiles(dir: string, extensions: Set<string>, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			walkFiles(full, extensions, out);
			continue;
		}
		if (extensions.has(path.extname(entry).toLowerCase())) out.push(full);
	}
	return out;
}

function parseFrontmatter(raw: string): Record<string, unknown> {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return {};
	const block = match[1] ?? '';
	const result: Record<string, unknown> = {};
	const lines = block.split(/\r?\n/);
	let i = 0;
	while (i < lines.length) {
		const line = lines[i] ?? '';
		const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
		if (!kv) {
			i += 1;
			continue;
		}
		const key = kv[1]!;
		let value = kv[2] ?? '';
		if (value === '>' || value === '|') {
			const chunk: string[] = [];
			i += 1;
			while (i < lines.length && /^\s+/.test(lines[i] ?? '')) {
				chunk.push((lines[i] ?? '').replace(/^\s+/, ''));
				i += 1;
			}
			result[key] = chunk.join(' ').trim();
			continue;
		}
		if (value === '') {
			const items: string[] = [];
			i += 1;
			while (i < lines.length && /^\s*-\s+/.test(lines[i] ?? '')) {
				items.push((lines[i] ?? '').replace(/^\s*-\s+/, '').replace(/^['"]|['"]$/g, ''));
				i += 1;
			}
			if (items.length > 0) {
				result[key] = items;
				continue;
			}
		}
		value = value.replace(/^['"]|['"]$/g, '');
		if (value === 'true') result[key] = true;
		else if (value === 'false') result[key] = false;
		else result[key] = value;
		i += 1;
	}
	return result;
}

function slugFromFile(filePath: string, fm: Record<string, unknown>): string {
	if (typeof fm.slug === 'string' && fm.slug.trim()) {
		return fm.slug.replace(/^\/+|\/+$/g, '');
	}
	const rel = path.relative(DOCS_DIR, filePath).replace(/\\/g, '/');
	return rel.replace(/\.(md|mdx)$/i, '').replace(/\/index$/i, '');
}

function hrefFromSlug(slug: string): string {
	if (!slug || slug === 'index') return '/';
	return `/${slug}/`;
}

function loadDocs(): DocPage[] {
	const files = walkFiles(DOCS_DIR, new Set(['.md', '.mdx']));
	return files.map((filePath) => {
		const raw = readFileSync(filePath, 'utf8');
		const fm = parseFrontmatter(raw);
		const slug = slugFromFile(filePath, fm);
		return {
			filePath: path.relative(ROOT, filePath),
			slug,
			title: typeof fm.title === 'string' ? fm.title : slug,
			category: typeof fm.category === 'string' ? fm.category : undefined,
			status: typeof fm.status === 'string' ? fm.status : undefined,
			related: Array.isArray(fm.related) ? fm.related.map(String) : [],
			template: typeof fm.template === 'string' ? fm.template : undefined,
			href: hrefFromSlug(slug),
		};
	});
}

function assetExists(relativePath: string): boolean {
	const full = path.join(ASSETS_DIR, relativePath.replace(/^\/+/, ''));
	return existsSync(full) && statSync(full).isFile();
}

function assertAsset(relativePath: string | undefined, field: string, location: string) {
	if (relativePath === undefined || relativePath === '') return;
	if (!assetExists(relativePath)) {
		throw new SiteValidationError(
			`Configured image does not exist under src/assets/.`,
			field,
			relativePath,
			location,
			`Add the file at src/assets/${relativePath.replace(/^\/+/, '')} or fix the path (subfolders allowed).`,
		);
	}
}

function collectConfiguredHrefs(config: ParsedGameConfig): Array<{ field: string; href: string }> {
	const out: Array<{ field: string; href: string }> = [];
	const portal = config.portal;
	if (!portal) return out;

	if (portal.primaryCta) out.push({ field: 'portal.primaryCta.href', href: portal.primaryCta.href });
	if (portal.secondaryCta) out.push({ field: 'portal.secondaryCta.href', href: portal.secondaryCta.href });
	portal.popularQuestions?.forEach((item, index) => {
		out.push({ field: `portal.popularQuestions[${index}].href`, href: item.href });
	});
	portal.startHere?.forEach((item, index) => {
		out.push({ field: `portal.startHere[${index}].href`, href: item.href });
	});
	portal.evidence?.items.forEach((item, index) => {
		if (item.href) out.push({ field: `portal.evidence.items[${index}].href`, href: item.href });
	});
	portal.recentUpdates?.forEach((item, index) => {
		out.push({ field: `portal.recentUpdates[${index}].href`, href: item.href });
	});
	return out;
}

function isInternalPath(href: string): boolean {
	if (href.startsWith('#')) return false;
	if (/^https?:\/\//i.test(href)) return false;
	if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
	return href.startsWith('/');
}

function readIndexSlug(): string | undefined {
	if (!existsSync(INDEX_MDX)) {
		throw new SiteValidationError(
			'Hub index MDX is missing.',
			'src/content/docs/index.mdx',
			undefined,
			'src/content/docs/index.mdx',
			'Restore the Hub splash page at src/content/docs/index.mdx.',
		);
	}
	const fm = parseFrontmatter(readFileSync(INDEX_MDX, 'utf8'));
	return typeof fm.slug === 'string' && fm.slug.trim() ? fm.slug.replace(/^\/+|\/+$/g, '') : undefined;
}

function assertHubSlugMatch(config: ParsedGameConfig) {
	let expected: string | undefined;
	try {
		expected = expectedHubSlug(config.hubPath);
	} catch (error) {
		if (error instanceof PathConfigError) {
			throw new SiteValidationError(error.message, error.field, error.value, 'src/config/game.ts', error.hint);
		}
		throw error;
	}
	if (config.siteMode === 'standalone' && normalizeHubPath(config.hubPath) !== '/') {
		throw new SiteValidationError(
			'standalone sites must use the root hubPath `/`.',
			'siteMode / hubPath',
			{ siteMode: config.siteMode, hubPath: config.hubPath },
			'src/config/site.generated.ts',
			'Set hubPath to `/` for standalone deployments, or use siteMode: hub for a path-prefixed hub.',
		);
	}
	const actual = readIndexSlug();
	if (expected === undefined) {
		if (actual !== undefined) {
			throw new SiteValidationError(
				'Hub slug must be omitted when hubPath is `/`.',
				'src/content/docs/index.mdx#slug',
				actual,
				'src/content/docs/index.mdx',
				'Remove the frontmatter `slug` so the Hub publishes at `/`, matching game.hubPath.',
			);
		}
		return;
	}
	if (actual !== expected) {
		throw new SiteValidationError(
			'Hub splash slug must match game.hubPath.',
			'src/content/docs/index.mdx#slug',
			actual,
			'src/content/docs/index.mdx',
			`Set frontmatter slug to "${expected}" (from hubPath ${normalizeHubPath(config.hubPath)}) or change game.hubPath.`,
		);
	}
}

function assertNoTemplateResidue(config: ParsedGameConfig, docs: DocPage[]) {
	const haystacks: Array<{ field: string; value: string; location: string }> = [
		{ field: 'name', value: config.name, location: 'src/config/game.ts' },
		{ field: 'shortName', value: config.shortName, location: 'src/config/game.ts' },
		{ field: 'siteUrl', value: config.siteUrl, location: 'src/config/game.ts' },
		{ field: 'description', value: config.description, location: 'src/config/game.ts' },
		{ field: 'tagline', value: config.tagline, location: 'src/config/game.ts' },
		{ field: 'hubTitle', value: config.hubTitle ?? '', location: 'src/config/game.ts' },
	];

	for (const item of haystacks) {
		if (/example game/i.test(item.value)) {
			throw new SiteValidationError(
				'generated-site mode forbids Example Game residue.',
				item.field,
				item.value,
				item.location,
				'Replace demo identity fields with the real game name before shipping.',
			);
		}
		if (/example\.com|example-game\.example/i.test(item.value)) {
			throw new SiteValidationError(
				'generated-site mode forbids example placeholder domains.',
				item.field,
				item.value,
				item.location,
				'Set siteUrl / copy to the real production domain.',
			);
		}
	}

	for (const doc of docs) {
		if (/example-/i.test(doc.slug) || /example game/i.test(doc.title)) {
			throw new SiteValidationError(
				'generated-site mode forbids demo guide slugs/titles.',
				'slug/title',
				`${doc.slug} / ${doc.title}`,
				doc.filePath,
				'Delete or rewrite Example Game demo pages before shipping a generated site.',
			);
		}
	}
}

export function validateGameConfig(raw: unknown, mode: ValidateMode = 'template'): ParsedGameConfig {
	const parsed = gameConfigSchema.safeParse(raw);
	if (!parsed.success) {
		const issue = parsed.error.issues[0]!;
		const field = issue.path.length > 0 ? issue.path.join('.') : 'game';
		throw new SiteValidationError(
			issue.message,
			field,
			issue.path.reduce<unknown>((acc, key) => {
				if (acc && typeof acc === 'object' && key in (acc as object)) {
					return (acc as Record<string | number, unknown>)[key as string];
				}
				return undefined;
			}, raw),
			'src/config/site.generated.ts',
			'Fix the listed field in site-spec.yaml (or src/config/site.generated.ts for template mode) and re-run npm run validate:site.',
		);
	}

	const config = parsed.data;

	if (config.analytics?.enabled && (('provider' in config.analytics && config.analytics.provider === 'ga4') || ('ga4' in config.analytics && config.analytics.ga4.enabled))) {
		if (!config.trust?.enabled || !config.trust.pages.privacy?.enabled) {
			const analyticsProvider = 'provider' in config.analytics ? config.analytics.provider : 'ga4';
			throw new SiteValidationError(
				'GA4 analytics requires an enabled Privacy page.',
				'analytics',
				analyticsProvider,
				'src/config/site.generated.ts',
				'Enable trust.privacy before turning on GA4. Do not auto-generate a Privacy page.',
			);
		}
	}

	if (
		config.monetization?.enabled &&
		config.monetization.affiliate.enabled &&
		config.monetization.affiliate.disclosure
	) {
		if (!config.trust?.enabled || !config.trust.pages.affiliateDisclosure?.enabled) {
			throw new SiteValidationError(
				'Affiliate disclosure requires a generated Affiliate Disclosure page.',
				'monetization.affiliate.disclosure',
				true,
				'src/config/site.generated.ts',
				'Enable monetization.affiliate with a disclosure source in site-spec.yaml and regenerate.',
			);
		}
	}

	if (
		config.releaseStatus === 'released' &&
		(config.releaseDate === 'TBD' || config.releaseDate === 'unknown' || config.releaseDate === '未定')
	) {
		throw new SiteValidationError(
			'released status requires a concrete YYYY-MM-DD releaseDate.',
			'releaseDate',
			config.releaseDate,
			'src/config/site.generated.ts',
			'Provide the confirmed date, or set releaseStatus to unknown / announced / pre-release.',
		);
	}

	try {
		normalizeHubPath(config.hubPath);
	} catch (error) {
		if (error instanceof PathConfigError) {
			throw new SiteValidationError(error.message, error.field, error.value, 'src/config/game.ts', error.hint);
		}
		throw error;
	}

	const ids = new Set<string>();
	const orders = new Set<number>();
	for (const category of config.categories) {
		if (ids.has(category.id)) {
			throw new SiteValidationError(
				'Duplicate category id.',
				'categories[].id',
				category.id,
				'src/config/game.ts',
				'Each category.id must be unique.',
			);
		}
		ids.add(category.id);
		if (orders.has(category.order)) {
			throw new SiteValidationError(
				'Duplicate category order.',
				'categories[].order',
				category.order,
				'src/config/game.ts',
				'Use unique positive integers for category.order.',
			);
		}
		orders.add(category.order);
		assertAsset(category.image, `categories[${category.id}].image`, 'src/config/game.ts');
	}

	assertAsset(config.heroImage, 'heroImage', 'src/config/game.ts');
	assertAsset(config.logoImage, 'logoImage', 'src/config/game.ts');
	config.portal?.startHere?.forEach((item, index) => {
		assertAsset(item.image, `portal.startHere[${index}].image`, 'src/config/game.ts');
	});
	config.portal?.evidence?.items.forEach((item, index) => {
		assertAsset(item.image, `portal.evidence.items[${index}].image`, 'src/config/game.ts');
	});
	assertAsset(config.social?.defaultImage?.asset, 'social.defaultImage.asset', 'src/config/game.ts');
	config.pages?.forEach((page) => {
		assertAsset(page.socialImage?.asset, `pages[id=${page.id}].socialImage.asset`, 'src/config/game.ts');
	});
	config.routes?.forEach((route) => {
		assertAsset(route.visual, `routes[id=${route.id}].visual`, 'src/config/game.ts');
		route.pages.forEach((page, index) => {
			assertAsset(page.image, `routes[id=${route.id}].pages[${index}].image`, 'src/config/game.ts');
		});
	});

	assertHubSlugMatch(config);

	const docs = loadDocs();
	const slugCounts = new Map<string, string[]>();
	for (const doc of docs) {
		const list = slugCounts.get(doc.slug) ?? [];
		list.push(doc.filePath);
		slugCounts.set(doc.slug, list);
	}
	for (const [slug, files] of slugCounts) {
		if (files.length > 1) {
			throw new SiteValidationError(
				'Duplicate content slug.',
				'slug',
				slug,
				files.join(', '),
				'Give each page a unique frontmatter slug (or unique file path).',
			);
		}
	}

	const knownHrefs = new Set(docs.map((doc) => canonicalizePath(doc.href)));
	for (const category of config.categories) {
		knownHrefs.add(canonicalizePath(pageHref(config.hubPath, category.id).replace(/\/$/, '') + '/'));
		// category landings use categoryHref semantics
		const hub = normalizeHubPath(config.hubPath);
		const categoryHref = hub === '/' ? `/${category.id}/` : `${hub}${category.id}/`;
		knownHrefs.add(canonicalizePath(categoryHref));
	}
	knownHrefs.add(canonicalizePath(normalizeHubPath(config.hubPath)));

	if (config.trust?.enabled) {
		for (const page of Object.values(config.trust.pages)) {
			if (!page?.enabled) continue;
			knownHrefs.add(canonicalizePath(page.path));
		}
	}

	for (const { field, href } of collectConfiguredHrefs(config)) {
		if (!isInternalPath(href)) continue;
		const canonical = canonicalizePath(href);
		if (!knownHrefs.has(canonical)) {
			throw new SiteValidationError(
				'Internal CTA/link does not point at a known page or category landing.',
				field,
				href,
				'src/config/game.ts',
				'Point the href at an existing guide slug or category id under the current hubPath, or use a hash like #browse-guides or #start-here.',
			);
		}
	}

	for (const doc of docs) {
		if (doc.category && !ids.has(doc.category)) {
			throw new SiteValidationError(
				'Guide references an unknown category id.',
				'frontmatter.category',
				doc.category,
				doc.filePath,
				`Add "${doc.category}" to game.categories or fix the frontmatter category.`,
			);
		}
		if (doc.status && !GUIDE_STATUSES.includes(doc.status as (typeof GUIDE_STATUSES)[number])) {
			throw new SiteValidationError(
				'Guide has an invalid status.',
				'frontmatter.status',
				doc.status,
				doc.filePath,
				`Use one of: ${GUIDE_STATUSES.join(', ')}.`,
			);
		}
		for (const related of doc.related) {
			const slug = related.replace(/^\/+|\/+$/g, '');
			const exists = docs.some((entry) => entry.slug === slug);
			if (!exists) {
				throw new SiteValidationError(
					'related[] points at a missing guide slug.',
					'frontmatter.related',
					related,
					doc.filePath,
					'Use the public slug of an existing guide (not the source directory path).',
				);
			}
		}
	}

	if (mode === 'generated-site') {
		assertNoTemplateResidue(config, docs);
	}

	return config;
}

export function resolveValidateMode(argv = process.argv.slice(2), env = process.env): ValidateMode {
	const fromArg = argv.find((arg) => arg.startsWith('--mode='))?.slice('--mode='.length);
	const fromEnv = env.VALIDATE_MODE;
	const value = fromArg || fromEnv || 'template';
	if (value === 'generated-site' || value === 'template') return value;
	throw new SiteValidationError(
		'Unknown validate mode.',
		'VALIDATE_MODE',
		value,
		'CLI / env',
		'Use --mode=template (default) or --mode=generated-site.',
	);
}
