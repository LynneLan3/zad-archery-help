import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { normalizeHubPath, normalizePageSlug, pageHref, PathConfigError } from '../../src/lib/paths';
import { CORE_TRUST_PAGE_KINDS, TRUST_PAGE_SLUGS, type TrustPageKind } from '../../src/lib/trust';
import { GA4_MEASUREMENT_ID } from '../../src/lib/outbound';
import { TRUST_SOURCE_TYPES, TRUST_STATUSES, type ContentTrust, type TrustSourceType, type TrustStatus } from '../../src/lib/content-trust';
import { PAGE_TYPES, isPageType, type PageSection, type PageType } from '../../src/lib/page-types';

export const SITE_SPEC_SCHEMA_VERSION = 1;
export const GENERATOR_VERSION = '1.0.0';
export const MANIFEST_FILENAME = '.site-generator-manifest.json';
export const ALLOWED_LOCALES = ['en', 'zh-CN'] as const;
export const ALLOWED_RELEASE_STATUSES = [
	'announced',
	'pre-release',
	'early-access',
	'released',
	'unknown',
] as const;
export const ALLOWED_SOURCE_TYPES = [
	'official',
	'store',
	'press-kit',
	'user-provided',
	'unknown',
] as const;
export const ALLOWED_USAGE_STATUSES = ['approved', 'review-required', 'unknown'] as const;
export const ALLOWED_PAGE_STATUSES = [
	'pre-release',
	'confirmed',
	'verified',
	'needs-verification',
] as const;
export const ALLOWED_PAGE_ROLES = ['core', 'supporting'] as const;
export const ALLOWED_RELATION_TYPES = ['related', 'next-step'] as const;
export const ALLOWED_PAGE_ASSET_TYPES = ['article', 'reference', 'checklist', 'comparison'] as const;
export const ALLOWED_PAGE_SOURCE_TYPES = ['official', 'steam', 'reddit', 'youtube', 'other'] as const;
export const ALLOWED_EVIDENCE_SOURCE_TYPES = ['firsthand', 'official', 'community'] as const;
export const ALLOWED_MEDIA_KINDS = ['cover', 'screenshot', 'evidence', 'illustration'] as const;
export const ALLOWED_MEDIA_ASPECT_RATIOS = ['16:9', '4:3', '1:1', 'portrait', 'auto'] as const;
export const ALLOWED_ANCHORS = new Set(['browse-guides', 'start-here']);
const ALLOWED_HEAD_TAGS = [
	'title',
	'base',
	'link',
	'style',
	'meta',
	'script',
	'noscript',
	'template',
] as const;

export type SiteLocale = (typeof ALLOWED_LOCALES)[number];
export type ReleaseStatus = (typeof ALLOWED_RELEASE_STATUSES)[number];
export type AssetSourceType = (typeof ALLOWED_SOURCE_TYPES)[number];
export type AssetUsageStatus = (typeof ALLOWED_USAGE_STATUSES)[number];
export type PageStatus = (typeof ALLOWED_PAGE_STATUSES)[number];
export type PageRole = (typeof ALLOWED_PAGE_ROLES)[number];
export type RelationType = (typeof ALLOWED_RELATION_TYPES)[number];
export type PageAssetType = (typeof ALLOWED_PAGE_ASSET_TYPES)[number];
export type PageSourceType = (typeof ALLOWED_PAGE_SOURCE_TYPES)[number];
export type EvidenceSourceType = (typeof ALLOWED_EVIDENCE_SOURCE_TYPES)[number];
export type MediaKind = (typeof ALLOWED_MEDIA_KINDS)[number];
export type MediaAspectRatio = (typeof ALLOWED_MEDIA_ASPECT_RATIOS)[number];
export type SiteSpecHeadTag = (typeof ALLOWED_HEAD_TAGS)[number];
export type SiteMode = 'standalone' | 'hub';

export class SpecValidationError extends Error {
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
		this.name = 'SpecValidationError';
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

function fail(
	message: string,
	field: string,
	value: unknown,
	location: string,
	hint: string,
): never {
	throw new SpecValidationError(message, field, value, location, hint);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(
	obj: Record<string, unknown>,
	key: string,
	location: string,
	opts: { optional?: boolean; min?: number } = {},
): string | undefined {
	const value = obj[key];
	if (value === undefined || value === null) {
		if (opts.optional) return undefined;
		fail(`Missing required string field "${key}".`, key, value, location, `Set ${key} in site-spec.yaml.`);
	}
	if (typeof value !== 'string') {
		fail(`Field "${key}" must be a string.`, key, value, location, `Use a YAML string for ${key}.`);
	}
	const trimmed = value.trim();
	if ((opts.min ?? 1) > 0 && trimmed.length < (opts.min ?? 1)) {
		fail(`Field "${key}" must not be empty.`, key, value, location, `Provide a non-empty ${key}.`);
	}
	return trimmed;
}

function requireNumber(
	obj: Record<string, unknown>,
	key: string,
	location: string,
	opts: { optional?: boolean; positive?: boolean } = {},
): number | undefined {
	const value = obj[key];
	if (value === undefined || value === null) {
		if (opts.optional) return undefined;
		fail(`Missing required number field "${key}".`, key, value, location, `Set ${key} in site-spec.yaml.`);
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		fail(`Field "${key}" must be a number.`, key, value, location, `Use a YAML number for ${key}.`);
	}
	if (opts.positive && (!Number.isInteger(value) || value < 1)) {
		fail(
			`Field "${key}" must be a positive integer.`,
			key,
			value,
			location,
			`Use a positive integer for ${key}.`,
		);
	}
	return value;
}

function requireBoolean(
	obj: Record<string, unknown>,
	key: string,
	location: string,
	opts: { optional?: boolean; defaultValue?: boolean } = {},
): boolean | undefined {
	const value = obj[key];
	if (value === undefined || value === null) {
		if (opts.optional) return opts.defaultValue;
		fail(`Missing required boolean field "${key}".`, key, value, location, `Set ${key} in site-spec.yaml.`);
	}
	if (typeof value !== 'boolean') {
		fail(`Field "${key}" must be a boolean.`, key, value, location, `Use true or false for ${key}.`);
	}
	return value;
}

function requireHttpUrl(
	obj: Record<string, unknown>,
	key: string,
	location: string,
	opts: { optional?: boolean } = {},
): string | undefined {
	const value = requireString(obj, key, location, { optional: opts.optional });
	if (value === undefined) return undefined;
	try {
		const url = new URL(value);
		if (!/^https?:$/i.test(url.protocol)) {
			fail(
				`${key} must be an http(s) URL.`,
				key,
				value,
				location,
				'Use an absolute http(s) URL.',
			);
		}
	} catch {
		fail(`${key} is not a valid URL.`, key, value, location, 'Use an absolute http(s) URL.');
	}
	return value;
}

function requireArray(
	obj: Record<string, unknown>,
	key: string,
	location: string,
	opts: { optional?: boolean; min?: number } = {},
): unknown[] | undefined {
	const value = obj[key];
	if (value === undefined || value === null) {
		if (opts.optional) return undefined;
		fail(`Missing required array field "${key}".`, key, value, location, `Provide a YAML list for ${key}.`);
	}
	if (!Array.isArray(value)) {
		fail(`Field "${key}" must be an array.`, key, value, location, `Use a YAML list for ${key}.`);
	}
	if (opts.min !== undefined && value.length < opts.min) {
		fail(
			`Field "${key}" must have at least ${opts.min} item(s).`,
			key,
			value,
			location,
			`Add more entries under ${key}.`,
		);
	}
	return value;
}

function parseMediaEnum<T extends string>(
	obj: Record<string, unknown>,
	key: string, location: string, allowed: readonly T[],
): T | undefined {
	const value = requireString(obj, key, location, { optional: true });
	if (value === undefined) return undefined;
	if (!allowed.includes(value as T)) {
		fail(`${key} is invalid.`, key, value, location, `Use one of: ${allowed.join(', ')}.`);
	}
	return value as T;
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface SiteSpecSite {
	id: string;
	mode: SiteMode;
	locale: SiteLocale;
	siteUrl: string;
	hubPath: string;
	title: string;
	shortName: string;
	description: string;
	disclaimer?: string;
}

export interface SiteSpecGame {
	name: string;
	hubTitle: string;
	tagline: string;
	releaseStatus: ReleaseStatus;
	releaseDate?: string;
	developer: string;
	publisher: string;
	platforms: string[];
}

export interface SiteSpecTheme {
	accentColor: string;
	accentForeground?: string;
	hero?: { assetId?: string; focalPoint?: string };
	heroAssetId?: string;
	heroPosition?: string;
}

export interface SiteSpecCategory {
	id: string;
	label: string;
	description: string;
	icon: string;
	order: number;
	imageAssetId?: string | null;
}

/**
 * Player-facing route path. Distinct from Category:
 * Category organizes content in the backend / sidebar; Route is a player task path.
 * `routes[].pages` is the single authoritative source for Guide → Route membership.
 * A Guide may belong to several Routes (Route is a graph/path, not a folder).
 */
export interface SiteSpecRoute {
	id: string;
	eyebrow?: string;
	title: string;
	description: string;
	/** Reuses the existing assets[] system; never a second image schema. */
	visualAssetId?: string;
	/** Max 3; each target must belong to this route's pages. */
	fastAnswers?: SiteSpecRouteFastAnswer[];
	/** Ordered guide sequence — order is meaningful (Follow the Route). At least 1. */
	pages: string[];
}

export interface SiteSpecRouteFastAnswer {
	question: string;
	answer: string;
	pageId: string;
}

export interface SiteSpecPageRelation {
	pageId: string;
	type: RelationType;
}

export interface SiteSpecPageSource {
	type: PageSourceType;
	title: string;
	url: string;
}

export interface SiteSpecPageEvidence {
	asset: string;
	alt: string;
	caption?: string;
	sourceLabel?: string;
	sourceType?: EvidenceSourceType;
	sourceUrl?: string;
}

export interface SiteSpecPageHeadEntry {
	tag: SiteSpecHeadTag;
	attrs?: Record<string, string | boolean>;
	content?: string;
}

export interface SiteSpecPage {
	id: string;
	title: string;
	description: string;
	category: string;
	slug: string;
	pageType: PageType;
	sections: PageSection[];
	homepagePriority?: number;
	source: string;
	status: PageStatus;
	featured: boolean;
	sidebarOrder: number;
	sidebarLabel?: string;
	sidebarBadge?: string;
	lastUpdated?: string;
	trust?: ContentTrust;
	head?: SiteSpecPageHeadEntry[];
	quickAnswer?: string;
	related: string[];
	role: PageRole;
	intents: string[];
	relations: SiteSpecPageRelation[];
	assetType: PageAssetType;
	sources: SiteSpecPageSource[];
	evidence: SiteSpecPageEvidence[];
	coverAssetId?: string | null;
	/** Optional card-specific crop; falls back to cover when omitted. */
	cardImageAssetId?: string | null;
	changeSummary?: string;
	socialImage?: SiteSpecSocialImage;
	eyebrow?: string;
	facts?: SiteSpecPageFact[];
}

export interface SiteSpecPageFact {
	label: string;
	value: string;
}

export interface SiteSpecSocialImage {
	asset: string;
	alt: string;
}

export interface SiteSpecSocial {
	defaultImage?: SiteSpecSocialImage;
}

export interface SiteSpecLinkTarget {
	label: string;
	pageId?: string;
	anchor?: string;
	externalUrl?: string;
}

export interface SiteSpecPopularQuestion {
	label: string;
	pageId: string;
	context?: string;
}

export interface SiteSpecStartHere {
	pageId: string;
	label?: string;
	badge?: string;
}

export interface SiteSpecEvidenceItem {
	assetId: string;
	caption?: string;
	pageId?: string;
}

export interface SiteSpecEvidence {
	title?: string;
	description?: string;
	items: SiteSpecEvidenceItem[];
}

export interface SiteSpecStatusItem {
	label: string;
	value: string;
}

export interface SiteSpecHomepage {
	heroBadge?: string;
	primaryCta?: SiteSpecLinkTarget;
	secondaryCta?: SiteSpecLinkTarget;
	popularQuestions?: SiteSpecPopularQuestion[];
	startHere?: SiteSpecStartHere[];
	evidence?: SiteSpecEvidence;
	/** Optional Hub status rail. Omit to derive from game fields. Max 4; empty values skipped. */
	statusItems?: SiteSpecStatusItem[];
	primaryNav?: SiteSpecLinkTarget[];
}

export interface SiteSpecAsset {
	id: string;
	source: string;
	target: string;
	alt: string;
	sourceUrl?: string;
	sourceType: AssetSourceType;
	usageStatus: AssetUsageStatus;
	kind?: MediaKind;
	aspectRatio?: MediaAspectRatio;
	objectPosition?: string;
}

export const ALLOWED_DEPLOYMENT_PROVIDERS = ['vercel'] as const;
export type DeploymentProvider = (typeof ALLOWED_DEPLOYMENT_PROVIDERS)[number];

export interface SiteSpecDeployment {
	provider: DeploymentProvider;
	orgId: string;
	projectId: string;
	projectName: string;
	productionUrl: string;
	productionBranch: string;
}

export interface SiteSpecTrustPage {
	enabled: boolean;
	source: string;
}

export interface SiteSpecTrust {
	enabled: boolean;
	about?: SiteSpecTrustPage;
	editorialMethod?: SiteSpecTrustPage;
	privacy?: SiteSpecTrustPage;
}

export const ALLOWED_ANALYTICS_PROVIDERS = ['ga4'] as const;
export type AnalyticsProvider = (typeof ALLOWED_ANALYTICS_PROVIDERS)[number];

export interface SiteSpecAnalytics {
	enabled: boolean;
	siteId?: string;
	gameSlug?: string;
	templateVersion?: string;
	launchDate?: string;
	ga4?: { enabled: boolean };
	vercelAnalytics?: { enabled: boolean };
	/** Legacy GA4 fields retained for existing specs; new specs must use ga4. */
	provider?: AnalyticsProvider;
	measurementId?: string;
	trackOutbound?: boolean;
}

export interface SiteSpecAffiliate {
	enabled: boolean;
	disclosure: boolean;
	source?: string;
}

export interface SiteSpecAds {
	enabled: boolean;
}

export interface SiteSpecMonetization {
	enabled: boolean;
	affiliate: SiteSpecAffiliate;
	ads: SiteSpecAds;
}

export interface SiteSpec {
	schemaVersion: number;
	templateVersion: string;
	mode: 'generated-site';
	presentationVersion?: 3;
	site: SiteSpecSite;
	game: SiteSpecGame;
	theme: SiteSpecTheme;
	categories: SiteSpecCategory[];
	pages: SiteSpecPage[];
	/** Optional player-facing route paths. Omit for backward compatibility. */
	routes?: SiteSpecRoute[];
	homepage: SiteSpecHomepage;
	assets: SiteSpecAsset[];
	deployment?: SiteSpecDeployment;
	trust?: SiteSpecTrust;
	analytics?: SiteSpecAnalytics;
	social?: SiteSpecSocial;
	monetization?: SiteSpecMonetization;
}

export interface LoadedSiteSpec {
	spec: SiteSpec;
	specPath: string;
	specRaw: string;
	specHash: string;
	rootDir: string;
}

export function sha256Text(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function sha256File(filePath: string): string {
	return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function readTemplateVersion(rootDir: string): string {
	const file = path.join(rootDir, 'TEMPLATE_VERSION');
	if (!existsSync(file)) {
		fail(
			'TEMPLATE_VERSION is missing.',
			'templateVersion',
			undefined,
			'TEMPLATE_VERSION',
			'Restore TEMPLATE_VERSION at the repository root.',
		);
	}
	return readFileSync(file, 'utf8').trim();
}

function assertCompatibleTemplateVersion(specVersion: string, rootDir: string, location: string) {
	const templateVersion = readTemplateVersion(rootDir);
	if (specVersion !== templateVersion) {
		fail(
			'templateVersion does not match TEMPLATE_VERSION.',
			'templateVersion',
			specVersion,
			location,
			`Set templateVersion to "${templateVersion}" or upgrade the template first.`,
		);
	}
}

function parseSite(raw: unknown, location: string): SiteSpecSite {
	if (!isRecord(raw)) fail('site must be a mapping.', 'site', raw, location, 'Provide a site: block.');
	const id = requireString(raw, 'id', `${location}.id`)!;
	if (!KEBAB.test(id)) {
		fail(
			'site.id must be lowercase kebab-case.',
			'site.id',
			id,
			`${location}.id`,
			'Use ids like `fixture-game`, not GitHub repo names.',
		);
	}
	const modeRaw = requireString(raw, 'mode', `${location}.mode`, { optional: true }) ?? 'standalone';
	if (modeRaw !== 'standalone' && modeRaw !== 'hub') {
		fail(
			'site.mode is invalid.',
			'site.mode',
			modeRaw,
			`${location}.mode`,
			'Use `standalone` for a root deployment or `hub` for a path-prefixed hub.',
		);
	}
	const localeRaw = requireString(raw, 'locale', `${location}.locale`)!;
	if (!ALLOWED_LOCALES.includes(localeRaw as SiteLocale)) {
		fail(
			'locale is not allowed in V1.',
			'site.locale',
			localeRaw,
			`${location}.locale`,
			`Use one of: ${ALLOWED_LOCALES.join(', ')}.`,
		);
	}
	const siteUrl = requireString(raw, 'siteUrl', `${location}.siteUrl`)!;
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(siteUrl);
	} catch {
		fail('siteUrl is not a valid absolute URL.', 'site.siteUrl', siteUrl, `${location}.siteUrl`, 'Use https://…');
	}
	if (parsedUrl.protocol !== 'https:') {
		fail(
			'siteUrl must use HTTPS.',
			'site.siteUrl',
			siteUrl,
			`${location}.siteUrl`,
			'Use an https:// absolute URL (fixtures may use *.example hosts).',
		);
	}
	const hubPathRaw = requireString(raw, 'hubPath', `${location}.hubPath`, { optional: true }) ?? '/';
	const hubPath = normalizeHubPath(hubPathRaw);
	if (modeRaw === 'standalone' && hubPath !== '/') {
		fail(
			'standalone sites must use the root hubPath `/`.',
			'site.hubPath',
			hubPathRaw,
			`${location}.hubPath`,
			'Use hubPath: / for standalone deployments, or set site.mode: hub for a path-prefixed hub.',
		);
	}
	try {
		normalizeHubPath(hubPath);
	} catch (error) {
		if (error instanceof PathConfigError) {
			fail(error.message, error.field, error.value, `${location}.hubPath`, error.hint);
		}
		throw error;
	}
	return {
		id,
		mode: modeRaw as SiteMode,
		locale: localeRaw as SiteLocale,
		siteUrl,
		hubPath,
		title: requireString(raw, 'title', `${location}.title`)!,
		shortName: requireString(raw, 'shortName', `${location}.shortName`)!,
		description: requireString(raw, 'description', `${location}.description`)!,
		disclaimer: requireString(raw, 'disclaimer', `${location}.disclaimer`, { optional: true }),
	};
}

function parseGame(raw: unknown, location: string): SiteSpecGame {
	if (!isRecord(raw)) fail('game must be a mapping.', 'game', raw, location, 'Provide a game: block.');
	const releaseStatus = requireString(raw, 'releaseStatus', `${location}.releaseStatus`)!;
	if (!ALLOWED_RELEASE_STATUSES.includes(releaseStatus as ReleaseStatus)) {
		fail(
			'releaseStatus is invalid.',
			'game.releaseStatus',
			releaseStatus,
			`${location}.releaseStatus`,
			`Use one of: ${ALLOWED_RELEASE_STATUSES.join(', ')}.`,
		);
	}
	const releaseDate = requireString(raw, 'releaseDate', `${location}.releaseDate`, { optional: true });
	if (releaseDate) {
		if (!ISO_DATE.test(releaseDate)) {
			fail(
				'releaseDate must be YYYY-MM-DD when provided.',
				'game.releaseDate',
				releaseDate,
				`${location}.releaseDate`,
				'Omit releaseDate when unknown; do not invent a date.',
			);
		}
		const date = new Date(`${releaseDate}T00:00:00Z`);
		if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(releaseDate)) {
			fail(
				'releaseDate is not a real calendar date.',
				'game.releaseDate',
				releaseDate,
				`${location}.releaseDate`,
				'Use a valid YYYY-MM-DD date or omit the field.',
			);
		}
	} else if (releaseStatus === 'released') {
		fail(
			'released games need an explicit releaseDate or releaseStatus: unknown.',
			'game.releaseDate',
			releaseDate,
			`${location}.releaseDate`,
			'Set the confirmed date, or mark releaseStatus as unknown / pre-release.',
		);
	}
	const platforms = requireArray(raw, 'platforms', `${location}.platforms`, { min: 1 })!;
	const platformNames = platforms.map((item, index) => {
		if (typeof item !== 'string' || !item.trim()) {
			fail(
				'platforms entries must be non-empty strings.',
				`game.platforms[${index}]`,
				item,
				`${location}.platforms[${index}]`,
				'List platforms like PC, PS5.',
			);
		}
		return item.trim();
	});
	return {
		name: requireString(raw, 'name', `${location}.name`)!,
		hubTitle: requireString(raw, 'hubTitle', `${location}.hubTitle`)!,
		tagline: requireString(raw, 'tagline', `${location}.tagline`)!,
		releaseStatus: releaseStatus as ReleaseStatus,
		releaseDate,
		developer: requireString(raw, 'developer', `${location}.developer`)!,
		publisher: requireString(raw, 'publisher', `${location}.publisher`)!,
		platforms: platformNames,
	};
}

function parseTheme(raw: unknown, location: string): SiteSpecTheme {
	if (!isRecord(raw)) fail('theme must be a mapping.', 'theme', raw, location, 'Provide a theme: block.');
	const accentColor = requireString(raw, 'accentColor', `${location}.accentColor`)!;
	if (!HEX_COLOR.test(accentColor)) {
		fail(
			'accentColor must be a hex color.',
			'theme.accentColor',
			accentColor,
			`${location}.accentColor`,
			'Use #RGB, #RRGGBB, or #RRGGBBAA.',
		);
	}
	const accentForeground = requireString(raw, 'accentForeground', `${location}.accentForeground`, {
		optional: true,
	});
	if (accentForeground && !HEX_COLOR.test(accentForeground)) {
		fail(
			'accentForeground must be a hex color.',
			'theme.accentForeground',
			accentForeground,
			`${location}.accentForeground`,
			'Use #RGB, #RRGGBB, or #RRGGBBAA.',
		);
	}
	const hero = isRecord(raw.hero) ? raw.hero : undefined;
	const heroAssetId = requireString(hero ?? {}, 'assetId', `${location}.hero.assetId`, { optional: true }) ?? requireString(raw, 'heroAssetId', `${location}.heroAssetId`, { optional: true });
	const focalPoint = requireString(hero ?? {}, 'focalPoint', `${location}.hero.focalPoint`, { optional: true }) ?? requireString(raw, 'heroPosition', `${location}.heroPosition`, { optional: true }) ?? 'center';
	return {
		accentColor,
		accentForeground,
		hero: { assetId: heroAssetId, focalPoint },
		heroAssetId: heroAssetId,
		heroPosition: focalPoint,
	};
}

function parseCategories(raw: unknown, location: string): SiteSpecCategory[] {
	const list = requireArray({ categories: raw } as Record<string, unknown>, 'categories', location, {
		min: 1,
	})!;
	const ids = new Set<string>();
	const orders = new Set<number>();
	return list.map((item, index) => {
		const loc = `${location}[${index}]`;
		if (!isRecord(item)) fail('category must be a mapping.', `categories[${index}]`, item, loc, 'Fix the category entry.');
		const id = requireString(item, 'id', `${loc}.id`)!;
		if (!KEBAB.test(id)) {
			fail('category id must be kebab-case.', `categories[${index}].id`, id, `${loc}.id`, 'Use getting-started style ids.');
		}
		if (ids.has(id)) {
			fail('Duplicate category id.', `categories[${index}].id`, id, `${loc}.id`, 'Category ids must be unique.');
		}
		ids.add(id);
		const order = requireNumber(item, 'order', `${loc}.order`, { positive: true })!;
		if (orders.has(order)) {
			fail('Duplicate category order.', `categories[${index}].order`, order, `${loc}.order`, 'Use unique order values.');
		}
		orders.add(order);
		const imageAssetId =
			item.imageAssetId === null
				? null
				: requireString(item, 'imageAssetId', `${loc}.imageAssetId`, { optional: true });
		return {
			id,
			label: requireString(item, 'label', `${loc}.label`)!,
			description: requireString(item, 'description', `${loc}.description`)!,
			icon: requireString(item, 'icon', `${loc}.icon`)!,
			order,
			imageAssetId,
		};
	});
}

export const MAX_ROUTE_FAST_ANSWERS = 3;

function parseRouteFastAnswers(
	raw: unknown,
	location: string,
	routeId: string,
	pageIds: Set<string>,
	routePageIds: Set<string>,
): SiteSpecRouteFastAnswer[] | undefined {
	const list = requireArray({ fastAnswers: raw } as Record<string, unknown>, 'fastAnswers', location, {
		optional: true,
	});
	if (!list) return undefined;
	if (list.length > MAX_ROUTE_FAST_ANSWERS) {
		fail(
			`Route "${routeId}" fastAnswers may contain at most ${MAX_ROUTE_FAST_ANSWERS} items.`,
			'fastAnswers',
			list.length,
			location,
			`Keep the ${MAX_ROUTE_FAST_ANSWERS} most common quick questions for this route (max ${MAX_ROUTE_FAST_ANSWERS}).`,
		);
	}
	return list.map((item, index) => {
		const loc = `${location}[${index}]`;
		if (!isRecord(item)) {
			fail('fastAnswer entry must be a mapping.', 'fastAnswers', item, loc, 'Fix the entry.');
		}
		const question = requireString(item, 'question', `${loc}.question`)!;
		const answer = requireString(item, 'answer', `${loc}.answer`)!;
		const pageId = requireString(item, 'pageId', `${loc}.pageId`)!;
		if (!pageIds.has(pageId)) {
			fail(
				`Route "${routeId}" fastAnswer references unknown pageId "${pageId}".`,
				'fastAnswers[].pageId',
				pageId,
				`${loc}.pageId`,
				'Use a page id declared under pages:.',
			);
		}
		if (!routePageIds.has(pageId)) {
			fail(
				`Route "${routeId}" fastAnswer target "${pageId}" is not in that route's pages.`,
				'fastAnswers[].pageId',
				pageId,
				`${loc}.pageId`,
				'fastAnswer.pageId must belong to the same route\'s pages.',
			);
		}
		return { question, answer, pageId };
	});
}

function parseRoutes(raw: unknown, location: string, pageIds: Set<string>): SiteSpecRoute[] | undefined {
	if (raw === undefined || raw === null) return undefined;
	const list = requireArray({ routes: raw } as Record<string, unknown>, 'routes', location)!;
	const ids = new Set<string>();
	return list.map((item, index) => {
		const loc = `${location}[${index}]`;
		if (!isRecord(item)) fail('route must be a mapping.', `routes[${index}]`, item, loc, 'Fix the route entry.');
		const id = requireString(item, 'id', `${loc}.id`)!;
		if (!KEBAB.test(id)) {
			fail(
				'route id must be kebab-case.',
				`routes[${index}].id`,
				id,
				`${loc}.id`,
				'Use getting-started style ids. No spaces, underscores, or slashes — the id becomes the route URL.',
			);
		}
		if (ids.has(id)) {
			fail('Duplicate route id.', `routes[${index}].id`, id, `${loc}.id`, 'Route ids must be unique.');
		}
		ids.add(id);
		const pagesRaw = requireArray(item, 'pages', `${loc}.pages`, { min: 1 })!;
		const pages = pagesRaw.map((entry, pageIndex) => {
			const pageLoc = `${loc}.pages[${pageIndex}]`;
			if (typeof entry !== 'string' || !entry.trim()) {
				fail(
					'route pages entries must be page ids.',
					`routes[${index}].pages[${pageIndex}]`,
					entry,
					pageLoc,
					'Reference page ids declared under pages:.',
				);
			}
			const pageId = entry.trim();
			if (!pageIds.has(pageId)) {
				fail(
					`Route "${id}" references unknown pageId "${pageId}".`,
					`routes[${index}].pages[${pageIndex}]`,
					pageId,
					pageLoc,
					'Use a page id declared under pages:.',
				);
			}
			return pageId;
		});
		const fastAnswers = parseRouteFastAnswers(item.fastAnswers, `${loc}.fastAnswers`, id, pageIds, new Set(pages));
		return {
			id,
			eyebrow: requireString(item, 'eyebrow', `${loc}.eyebrow`, { optional: true }),
			title: requireString(item, 'title', `${loc}.title`)!,
			description: requireString(item, 'description', `${loc}.description`)!,
			visualAssetId: requireString(item, 'visualAssetId', `${loc}.visualAssetId`, { optional: true }),
			fastAnswers,
			pages,
		};
	});
}

function parsePageHead(raw: unknown, location: string): SiteSpecPageHeadEntry[] | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!Array.isArray(raw)) {
		fail('page.head must be an array.', 'pages.head', raw, location, 'Use a list of Starlight head entries.');
	}
	return raw.map((entry, index) => {
		const entryLocation = `${location}[${index}]`;
		if (!isRecord(entry)) {
			fail(
				'page.head entries must be mappings.',
				`pages.head[${index}]`,
				entry,
				entryLocation,
				'Use entries with tag, optional attrs, and optional content.',
			);
		}
		const tag = requireString(entry, 'tag', `${entryLocation}.tag`)!;
		if (!ALLOWED_HEAD_TAGS.includes(tag as SiteSpecHeadTag)) {
			fail(
				'page.head tag is invalid.',
				`pages.head[${index}].tag`,
				tag,
				`${entryLocation}.tag`,
				`Use one of: ${ALLOWED_HEAD_TAGS.join(', ')}.`,
			);
		}
		let attrs: Record<string, string | boolean> | undefined;
		if (entry.attrs !== undefined && entry.attrs !== null) {
			if (!isRecord(entry.attrs)) {
				fail(
					'page.head attrs must be a mapping.',
					`pages.head[${index}].attrs`,
					entry.attrs,
					`${entryLocation}.attrs`,
					'Use string or boolean HTML attribute values.',
				);
			}
			attrs = {};
			for (const [key, value] of Object.entries(entry.attrs)) {
				if (!key.trim() || (typeof value !== 'string' && typeof value !== 'boolean')) {
					fail(
						'page.head attrs values must be strings or booleans.',
						`pages.head[${index}].attrs`,
						entry.attrs,
						`${entryLocation}.attrs.${key}`,
						'Use string or boolean HTML attribute values.',
					);
				}
				attrs[key] = value;
			}
		}
		const content = requireString(entry, 'content', `${entryLocation}.content`, { optional: true, min: 0 });
		if (tag === 'meta' && content !== undefined) {
			fail(
				'page.head meta content must be provided as attrs.content.',
				`pages.head[${index}].content`,
				content,
				`${entryLocation}.content`,
				'Move the value to attrs.content and keep an identifying name/property attribute.',
			);
		}
		return { tag: tag as SiteSpecHeadTag, attrs, content };
	});
}

function parsePages(raw: unknown, location: string, categoryIds: Set<string>): SiteSpecPage[] {
	const list = requireArray({ pages: raw } as Record<string, unknown>, 'pages', location, { min: 1 })!;
	const ids = new Set<string>();
	const slugs = new Set<string>();
	return list.map((item, index) => {
		const loc = `${location}[${index}]`;
		if (!isRecord(item)) fail('page must be a mapping.', `pages[${index}]`, item, loc, 'Fix the page entry.');
		const id = requireString(item, 'id', `${loc}.id`)!;
		if (!KEBAB.test(id)) {
			fail('page id must be kebab-case.', `pages[${index}].id`, id, `${loc}.id`, 'Use beginner-guide style ids.');
		}
		if (ids.has(id)) {
			fail('Duplicate page id.', `pages[${index}].id`, id, `${loc}.id`, 'Page ids must be unique.');
		}
		ids.add(id);
		const slug = requireString(item, 'slug', `${loc}.slug`)!;
		const pageTypeRaw = requireString(item, 'pageType', `${loc}.pageType`, { optional: true }) ?? 'how-to';
		if (!isPageType(pageTypeRaw)) {
			fail('page.pageType is invalid.', `pages[${index}].pageType`, pageTypeRaw, `${loc}.pageType`, `Use one of: ${PAGE_TYPES.join(', ')}.`);
		}
		const sectionsRaw = requireArray(item, 'sections', `${loc}.sections`, { optional: true }) ?? [];
		const sections = sectionsRaw.map((section, sectionIndex) => {
			const sectionLoc = `${loc}.sections[${sectionIndex}]`;
			if (!isRecord(section)) fail('page section must be a mapping.', `${loc}.sections[${sectionIndex}]`, section, sectionLoc, 'Use id and title for each typed section.');
			return {
				id: requireString(section, 'id', `${sectionLoc}.id`)!,
				title: requireString(section, 'title', `${sectionLoc}.title`)!,
			};
		});
		try {
			normalizePageSlug(slug);
		} catch (error) {
			fail(
				'page slug must be one or more kebab-case URL segments.',
				`pages[${index}].slug`,
				slug,
				`${loc}.slug`,
				'Use a single segment for new sites, or a safe nested path to preserve an existing production URL.',
			);
		}
		if (slugs.has(slug)) {
			fail('Duplicate page slug.', `pages[${index}].slug`, slug, `${loc}.slug`, 'Page slugs must be unique.');
		}
		slugs.add(slug);
		const category = requireString(item, 'category', `${loc}.category`)!;
		if (!categoryIds.has(category)) {
			fail(
				'page.category references an unknown category id.',
				`pages[${index}].category`,
				category,
				`${loc}.category`,
				'Add the category under categories: or fix the page.category value.',
			);
		}
		const roleRaw = requireString(item, 'role', `${loc}.role`, { optional: true }) ?? 'supporting';
		if (!ALLOWED_PAGE_ROLES.includes(roleRaw as PageRole)) {
			fail(
				'page.role is invalid.',
				`pages[${index}].role`,
				roleRaw,
				`${loc}.role`,
				`Use one of: ${ALLOWED_PAGE_ROLES.join(', ')}.`,
			);
		}
		const intentsRaw = requireArray(item, 'intents', `${loc}.intents`, { optional: true }) ?? [];
		const intents = intentsRaw.map((entry, intentIndex) => {
			if (typeof entry !== 'string' || !entry.trim()) {
				fail(
					'intents entries must be non-empty kebab-case strings.',
					`pages[${index}].intents[${intentIndex}]`,
					entry,
					`${loc}.intents[${intentIndex}]`,
					'Use intent ids like save-progress.',
				);
			}
			const intent = entry.trim();
			if (!KEBAB.test(intent)) {
				fail(
					'intent must be kebab-case.',
					`pages[${index}].intents[${intentIndex}]`,
					intent,
					`${loc}.intents[${intentIndex}]`,
					'Use lowercase kebab-case intent ids.',
				);
			}
			return intent;
		});
		const relationsRaw = requireArray(item, 'relations', `${loc}.relations`, { optional: true }) ?? [];
		const relations = relationsRaw.map((entry, relationIndex) => {
			const relLoc = `${loc}.relations[${relationIndex}]`;
			if (!isRecord(entry)) {
				fail('relation must be a mapping.', `pages[${index}].relations[${relationIndex}]`, entry, relLoc, 'Fix the relation entry.');
			}
			const pageId = requireString(entry, 'pageId', `${relLoc}.pageId`)!;
			const typeRaw = requireString(entry, 'type', `${relLoc}.type`)!;
			if (!ALLOWED_RELATION_TYPES.includes(typeRaw as RelationType)) {
				fail(
					'relation.type is invalid.',
					`pages[${index}].relations[${relationIndex}].type`,
					typeRaw,
					`${relLoc}.type`,
					`Use one of: ${ALLOWED_RELATION_TYPES.join(', ')}.`,
				);
			}
			return { pageId, type: typeRaw as RelationType };
		});
		const assetTypeRaw = requireString(item, 'assetType', `${loc}.assetType`, { optional: true }) ?? 'article';
		if (!ALLOWED_PAGE_ASSET_TYPES.includes(assetTypeRaw as PageAssetType)) {
			fail(
				'page.assetType is invalid.',
				`pages[${index}].assetType`,
				assetTypeRaw,
				`${loc}.assetType`,
				`Use one of: ${ALLOWED_PAGE_ASSET_TYPES.join(', ')}.`,
			);
		}
		const sources = parsePageSources(item.sources, `${loc}.sources`, index);
		const evidence = parsePageEvidence(item.evidence, `${loc}.evidence`, index);
		const trust = parseContentTrust(item.trust, `${loc}.trust`, index);
		const lastUpdated = requireString(item, 'lastUpdated', `${loc}.lastUpdated`, { optional: true });
		if (lastUpdated) {
			if (!ISO_DATE.test(lastUpdated)) {
				fail(
					'page.lastUpdated must be YYYY-MM-DD when provided.',
					`pages[${index}].lastUpdated`,
					lastUpdated,
					`${loc}.lastUpdated`,
					'Use an ISO calendar date such as 2026-08-13.',
				);
			}
			const date = new Date(`${lastUpdated}T00:00:00Z`);
			if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(lastUpdated)) {
				fail(
					'page.lastUpdated is not a real calendar date.',
					`pages[${index}].lastUpdated`,
					lastUpdated,
					`${loc}.lastUpdated`,
					'Use a real ISO calendar date such as 2026-08-13.',
				);
			}
		}
		const head = parsePageHead(item.head, `${loc}.head`);
		const status = requireString(item, 'status', `${loc}.status`)!;
		if (!ALLOWED_PAGE_STATUSES.includes(status as PageStatus)) {
			fail(
				'page.status is invalid.',
				`pages[${index}].status`,
				status,
				`${loc}.status`,
				`Use one of: ${ALLOWED_PAGE_STATUSES.join(', ')}.`,
			);
		}
		const relatedRaw = requireArray(item, 'related', `${loc}.related`, { optional: true }) ?? [];
		const related = relatedRaw.map((entry, relatedIndex) => {
			if (typeof entry !== 'string' || !entry.trim()) {
				fail(
					'related entries must be page ids.',
					`pages[${index}].related[${relatedIndex}]`,
					entry,
					`${loc}.related[${relatedIndex}]`,
					'Reference page ids, not URLs.',
				);
			}
			return entry.trim();
		});
		const coverAssetId =
			item.coverAssetId === null
				? null
				: requireString(item, 'coverAssetId', `${loc}.coverAssetId`, { optional: true });
		const cardImageAssetId =
			item.cardImageAssetId === null
				? null
				: requireString(item, 'cardImageAssetId', `${loc}.cardImageAssetId`, { optional: true });
		const socialImage = parseSocialImageRef(item.socialImage, `${loc}.socialImage`);
		return {
			id,
			title: requireString(item, 'title', `${loc}.title`)!,
			description: requireString(item, 'description', `${loc}.description`)!,
			category,
			slug,
			pageType: pageTypeRaw,
			sections,
			homepagePriority: requireNumber(item, 'homepagePriority', `${loc}.homepagePriority`, { optional: true }),
			source: requireString(item, 'source', `${loc}.source`)!,
			status: status as PageStatus,
			featured: requireBoolean(item, 'featured', `${loc}.featured`, { optional: true, defaultValue: false })!,
			sidebarOrder: requireNumber(item, 'sidebarOrder', `${loc}.sidebarOrder`, { positive: true })!,
			sidebarLabel: requireString(item, 'sidebarLabel', `${loc}.sidebarLabel`, { optional: true }),
			sidebarBadge: requireString(item, 'sidebarBadge', `${loc}.sidebarBadge`, { optional: true }),
			lastUpdated,
			trust,
			head,
			quickAnswer: requireString(item, 'quickAnswer', `${loc}.quickAnswer`, { optional: true }),
			related,
			role: roleRaw as PageRole,
			intents,
			relations,
			assetType: assetTypeRaw as PageAssetType,
			sources,
			evidence,
			coverAssetId,
			cardImageAssetId,
			changeSummary: requireString(item, 'changeSummary', `${loc}.changeSummary`, { optional: true }),
			socialImage,
			eyebrow: requireString(item, 'eyebrow', `${loc}.eyebrow`, { optional: true }),
			facts: parsePageFacts(item, loc),
		};
	});
}

function parsePageFacts(
	item: Record<string, unknown>,
	parentLoc: string,
): SiteSpecPageFact[] | undefined {
	const raw = requireArray(item, 'facts', `${parentLoc}.facts`, { optional: true });
	if (!raw) return undefined;
	if (raw.length > 4) {
		fail(
			'pages[].facts may contain at most 4 items.',
			`${parentLoc}.facts`,
			raw.length,
			`${parentLoc}.facts`,
			'Remove extra fact entries (max 4).',
		);
	}
	return raw.map((entry, index) => {
		const loc = `${parentLoc}.facts[${index}]`;
		if (!isRecord(entry)) {
			fail('facts entry must be a mapping.', `${parentLoc}.facts[${index}]`, entry, loc, 'Fix the entry.');
		}
		const label = requireString(entry, 'label', `${loc}.label`)!;
		const value = requireString(entry, 'value', `${loc}.value`)!;
		if (!label.trim()) {
			fail('facts[].label must be non-empty.', `${loc}.label`, label, `${loc}.label`, 'Provide a non-empty label.');
		}
		if (!value.trim()) {
			fail('facts[].value must be non-empty.', `${loc}.value`, value, `${loc}.value`, 'Provide a non-empty value.');
		}
		return { label, value };
	});
}

function parsePageSources(raw: unknown, location: string, pageIndex: number): SiteSpecPageSource[] {
	const list = requireArray({ sources: raw } as Record<string, unknown>, 'sources', location, {
		optional: true,
	}) ?? [];
	return list.map((entry, sourceIndex) => {
		const loc = `${location}[${sourceIndex}]`;
		if (!isRecord(entry)) {
			fail(
				'source must be a mapping.',
				`pages[${pageIndex}].sources[${sourceIndex}]`,
				entry,
				loc,
				'Provide type, title, and url.',
			);
		}
		const typeRaw = requireString(entry, 'type', `${loc}.type`)!;
		if (!ALLOWED_PAGE_SOURCE_TYPES.includes(typeRaw as PageSourceType)) {
			fail(
				'source.type is invalid.',
				`pages[${pageIndex}].sources[${sourceIndex}].type`,
				typeRaw,
				`${loc}.type`,
				`Use one of: ${ALLOWED_PAGE_SOURCE_TYPES.join(', ')}.`,
			);
		}
		return {
			type: typeRaw as PageSourceType,
			title: requireString(entry, 'title', `${loc}.title`)!,
			url: requireHttpUrl(entry, 'url', `${loc}.url`)!,
		};
	});
}

function parseContentTrust(raw: unknown, location: string, pageIndex: number): ContentTrust | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!isRecord(raw)) fail('page.trust must be a mapping.', `pages[${pageIndex}].trust`, raw, location, 'Provide trust metadata as a mapping.');
	const statusRaw = requireString(raw, 'status', `${location}.status`, { optional: true });
	if (statusRaw !== undefined && !TRUST_STATUSES.includes(statusRaw as TrustStatus)) fail('trust.status is invalid.', `pages[${pageIndex}].trust.status`, statusRaw, `${location}.status`, `Use one of: ${TRUST_STATUSES.join(', ')}.`);
	const lastVerified = requireString(raw, 'lastVerified', `${location}.lastVerified`, { optional: true });
	if (lastVerified) {
		const date = new Date(`${lastVerified}T00:00:00Z`);
		if (!ISO_DATE.test(lastVerified) || Number.isNaN(date.getTime()) || !date.toISOString().startsWith(lastVerified)) fail('trust.lastVerified must be a real YYYY-MM-DD date.', `pages[${pageIndex}].trust.lastVerified`, lastVerified, `${location}.lastVerified`, 'Use a real ISO calendar date such as 2026-08-13.');
	}
	const appliesRaw = requireArray(raw, 'appliesTo', `${location}.appliesTo`, { optional: true });
	const appliesTo = appliesRaw?.map((value, index) => {
		if (typeof value !== 'string' || !value.trim()) fail('trust.appliesTo values must be non-empty strings.', `pages[${pageIndex}].trust.appliesTo[${index}]`, value, `${location}.appliesTo[${index}]`, 'Use a human-readable platform or version scope.');
		return value.trim();
	});
	const sourcesRaw = requireArray(raw, 'sources', `${location}.sources`, { optional: true });
	const sources = sourcesRaw?.map((value, index) => {
		const sourceLoc = `${location}.sources[${index}]`;
		if (!isRecord(value)) fail('trust source must be a mapping.', `pages[${pageIndex}].trust.sources[${index}]`, value, sourceLoc, 'Provide label, type, and an optional URL.');
		const typeRaw = requireString(value, 'type', `${sourceLoc}.type`)!;
		if (!TRUST_SOURCE_TYPES.includes(typeRaw as TrustSourceType)) fail('trust source type is invalid.', `pages[${pageIndex}].trust.sources[${index}].type`, typeRaw, `${sourceLoc}.type`, `Use one of: ${TRUST_SOURCE_TYPES.join(', ')}.`);
		return { label: requireString(value, 'label', `${sourceLoc}.label`)!, url: requireHttpUrl(value, 'url', `${sourceLoc}.url`, { optional: true }), type: typeRaw as TrustSourceType };
	});
	return { status: statusRaw as TrustStatus | undefined, lastVerified, appliesTo, sources, note: requireString(raw, 'note', `${location}.note`, { optional: true }) };
}

function parsePageEvidence(raw: unknown, location: string, pageIndex: number): SiteSpecPageEvidence[] {
	const list = requireArray({ evidence: raw } as Record<string, unknown>, 'evidence', location, {
		optional: true,
	}) ?? [];
	return list.map((entry, evidenceIndex) => {
		const loc = `${location}[${evidenceIndex}]`;
		if (!isRecord(entry)) {
			fail(
				'evidence item must be a mapping.',
				`pages[${pageIndex}].evidence[${evidenceIndex}]`,
				entry,
				loc,
				'Provide asset, alt, and sourceType.',
			);
		}
		const asset = assertSafeAssetTarget(
			requireString(entry, 'asset', `${loc}.asset`)!,
			`pages[${pageIndex}].evidence[${evidenceIndex}].asset`,
			`${loc}.asset`,
		);
		const sourceTypeRaw = requireString(entry, 'sourceType', `${loc}.sourceType`, { optional: true });
		if (sourceTypeRaw !== undefined && !ALLOWED_EVIDENCE_SOURCE_TYPES.includes(sourceTypeRaw as EvidenceSourceType)) {
			fail(
				'evidence.sourceType is invalid.',
				`pages[${pageIndex}].evidence[${evidenceIndex}].sourceType`,
				sourceTypeRaw,
				`${loc}.sourceType`,
				`Use one of: ${ALLOWED_EVIDENCE_SOURCE_TYPES.join(', ')}.`,
			);
		}
		return {
			asset,
			alt: requireString(entry, 'alt', `${loc}.alt`)!,
			caption: requireString(entry, 'caption', `${loc}.caption`, { optional: true }),
			sourceLabel: requireString(entry, 'sourceLabel', `${loc}.sourceLabel`, { optional: true }),
			sourceType: sourceTypeRaw as EvidenceSourceType | undefined,
			sourceUrl: requireHttpUrl(entry, 'sourceUrl', `${loc}.sourceUrl`, { optional: true }),
		};
	});
}

function parseLinkTarget(
	raw: unknown,
	field: string,
	location: string,
	pageIds: Set<string>,
): SiteSpecLinkTarget {
	if (!isRecord(raw)) fail(`${field} must be a mapping.`, field, raw, location, 'Provide label + pageId/anchor/externalUrl.');
	const label = requireString(raw, 'label', `${location}.label`)!;
	const pageId = requireString(raw, 'pageId', `${location}.pageId`, { optional: true });
	const anchor = requireString(raw, 'anchor', `${location}.anchor`, { optional: true });
	const externalUrl = requireString(raw, 'externalUrl', `${location}.externalUrl`, { optional: true });
	const setCount = [pageId, anchor, externalUrl].filter(Boolean).length;
	if (setCount !== 1) {
		fail(
			`${field} must set exactly one of pageId, anchor, or externalUrl.`,
			field,
			raw,
			location,
			'Do not mix internal page ids with free-form href strings.',
		);
	}
	if (pageId && !pageIds.has(pageId)) {
		fail(
			`${field}.pageId references an unknown page.`,
			`${field}.pageId`,
			pageId,
			`${location}.pageId`,
			'Use a page id declared under pages:.',
		);
	}
	if (anchor) {
		const normalized = anchor.replace(/^#/, '');
		if (!ALLOWED_ANCHORS.has(normalized)) {
			fail(
				`${field}.anchor is not an allowed in-site anchor.`,
				`${field}.anchor`,
				anchor,
				`${location}.anchor`,
				`Allowed anchors: ${[...ALLOWED_ANCHORS].map((a) => `#${a}`).join(', ')}.`,
			);
		}
	}
	if (externalUrl) {
		try {
			const url = new URL(externalUrl);
			if (!/^https?:$/i.test(url.protocol)) {
				fail(
					`${field}.externalUrl must be http(s).`,
					`${field}.externalUrl`,
					externalUrl,
					`${location}.externalUrl`,
					'Use an absolute http(s) URL for external links.',
				);
			}
		} catch {
			fail(
				`${field}.externalUrl is not a valid URL.`,
				`${field}.externalUrl`,
				externalUrl,
				`${location}.externalUrl`,
				'Use an absolute http(s) URL.',
			);
		}
	}
	return {
		label,
		pageId,
		anchor: anchor ? anchor.replace(/^#/, '') : undefined,
		externalUrl,
	};
}

function parseHomepage(raw: unknown, location: string, pageIds: Set<string>): SiteSpecHomepage {
	if (raw === undefined || raw === null) return {};
	if (!isRecord(raw)) fail('homepage must be a mapping.', 'homepage', raw, location, 'Provide a homepage: block.');
	const homepage: SiteSpecHomepage = {
		heroBadge: requireString(raw, 'heroBadge', `${location}.heroBadge`, { optional: true }),
	};
	const primaryNav = requireArray(raw, 'primaryNav', `${location}.primaryNav`, { optional: true });
	if (primaryNav) {
		homepage.primaryNav = primaryNav.map((item, index) =>
			parseLinkTarget(item, `homepage.primaryNav[${index}]`, `${location}.primaryNav[${index}]`, pageIds),
		);
	}
	if (raw.primaryCta !== undefined) {
		homepage.primaryCta = parseLinkTarget(raw.primaryCta, 'homepage.primaryCta', `${location}.primaryCta`, pageIds);
	}
	if (raw.secondaryCta !== undefined) {
		homepage.secondaryCta = parseLinkTarget(
			raw.secondaryCta,
			'homepage.secondaryCta',
			`${location}.secondaryCta`,
			pageIds,
		);
	}
	const popular = requireArray(raw, 'popularQuestions', `${location}.popularQuestions`, { optional: true });
	if (popular) {
		homepage.popularQuestions = popular.map((item, index) => {
			const loc = `${location}.popularQuestions[${index}]`;
			if (!isRecord(item)) {
				fail('popularQuestions entry must be a mapping.', `homepage.popularQuestions[${index}]`, item, loc, 'Fix the entry.');
			}
			const pageId = requireString(item, 'pageId', `${loc}.pageId`)!;
			if (!pageIds.has(pageId)) {
				fail(
					'popularQuestions.pageId references an unknown page.',
					`homepage.popularQuestions[${index}].pageId`,
					pageId,
					`${loc}.pageId`,
					'Use a page id declared under pages:.',
				);
			}
			return {
				label: requireString(item, 'label', `${loc}.label`)!,
				pageId,
				context: requireString(item, 'context', `${loc}.context`, { optional: true }),
			};
		});
	}
	const startHere = requireArray(raw, 'startHere', `${location}.startHere`, { optional: true });
	if (startHere) {
		homepage.startHere = startHere.map((item, index) => {
			const loc = `${location}.startHere[${index}]`;
			if (!isRecord(item)) {
				fail('startHere entry must be a mapping.', `homepage.startHere[${index}]`, item, loc, 'Fix the entry.');
			}
			const pageId = requireString(item, 'pageId', `${loc}.pageId`)!;
			if (!pageIds.has(pageId)) {
				fail(
					'startHere.pageId references an unknown page.',
					`homepage.startHere[${index}].pageId`,
					pageId,
					`${loc}.pageId`,
					'Use a page id declared under pages:.',
				);
			}
			return {
				pageId,
				label: requireString(item, 'label', `${loc}.label`, { optional: true }),
				badge: requireString(item, 'badge', `${loc}.badge`, { optional: true }),
			};
		});
	}
	const statusItems = requireArray(raw, 'statusItems', `${location}.statusItems`, { optional: true });
	if (statusItems) {
		homepage.statusItems = statusItems
			.map((item, index) => {
				const loc = `${location}.statusItems[${index}]`;
				if (!isRecord(item)) {
					fail('statusItems entry must be a mapping.', `homepage.statusItems[${index}]`, item, loc, 'Fix the entry.');
				}
				const label = requireString(item, 'label', `${loc}.label`)!;
				const value = requireString(item, 'value', `${loc}.value`)!;
				return { label, value };
			})
			.filter((item) => item.label.trim() && item.value.trim())
			.slice(0, 4);
	}
	if (raw.evidence !== undefined) {
		if (!isRecord(raw.evidence)) {
			fail('homepage.evidence must be a mapping.', 'homepage.evidence', raw.evidence, `${location}.evidence`, 'Fix evidence.');
		}
		const itemsRaw = requireArray(raw.evidence, 'items', `${location}.evidence.items`, { min: 1 })!;
		homepage.evidence = {
			title: requireString(raw.evidence, 'title', `${location}.evidence.title`, { optional: true }),
			description: requireString(raw.evidence, 'description', `${location}.evidence.description`, {
				optional: true,
			}),
			items: itemsRaw.map((item, index) => {
				const loc = `${location}.evidence.items[${index}]`;
				if (!isRecord(item)) {
					fail('evidence item must be a mapping.', `homepage.evidence.items[${index}]`, item, loc, 'Fix the item.');
				}
				const pageId = requireString(item, 'pageId', `${loc}.pageId`, { optional: true });
				if (pageId && !pageIds.has(pageId)) {
					fail(
						'evidence.pageId references an unknown page.',
						`homepage.evidence.items[${index}].pageId`,
						pageId,
						`${loc}.pageId`,
						'Use a page id declared under pages:.',
					);
				}
				return {
					assetId: requireString(item, 'assetId', `${loc}.assetId`)!,
					caption: requireString(item, 'caption', `${loc}.caption`, { optional: true }),
					pageId,
				};
			}),
		};
	}
	return homepage;
}

function parseTrustPage(
	raw: unknown,
	field: TrustPageKind,
	location: string,
): SiteSpecTrustPage | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!isRecord(raw)) {
		fail(`trust.${field} must be a mapping.`, field, raw, location, `Use enabled/source under trust.${field}.`);
	}
	const enabled = requireBoolean(raw, 'enabled', location, { optional: true, defaultValue: false })!;
	const source = requireString(raw, 'source', location, { optional: !enabled });
	if (!enabled) {
		return { enabled: false, source: source ?? '' };
	}
	if (!source) {
		fail(
			'trust page source is required when enabled is true.',
			'source',
			source,
			location,
			`Set source to a markdown file under site-input/trust/ (e.g. site-input/trust/${TRUST_PAGE_SLUGS[field]}.md).`,
		);
	}
	return { enabled: true, source };
}

function parseTrust(raw: unknown, location: string): SiteSpecTrust | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!isRecord(raw)) {
		fail('trust must be a mapping.', 'trust', raw, location, 'Use trust.enabled and optional page blocks.');
	}
	const enabled = requireBoolean(raw, 'enabled', location, { optional: true, defaultValue: false })!;
	const about = parseTrustPage(raw.about, 'about', `${location}.about`);
	const editorialMethod = parseTrustPage(raw.editorialMethod, 'editorialMethod', `${location}.editorialMethod`);
	const privacy = parseTrustPage(raw.privacy, 'privacy', `${location}.privacy`);
	return { enabled, about, editorialMethod, privacy };
}

function parseMonetization(raw: unknown, location: string): SiteSpecMonetization | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!isRecord(raw)) {
		fail(
			'monetization must be a mapping.',
			'monetization',
			raw,
			location,
			'Use monetization.enabled plus optional affiliate/ads blocks.',
		);
	}
	const enabled = requireBoolean(raw, 'enabled', location, { optional: true, defaultValue: false })!;
	let affiliate: SiteSpecAffiliate = { enabled: false, disclosure: true };
	if (raw.affiliate !== undefined && raw.affiliate !== null) {
		if (!isRecord(raw.affiliate)) {
			fail(
				'monetization.affiliate must be a mapping.',
				'monetization.affiliate',
				raw.affiliate,
				`${location}.affiliate`,
				'Use enabled/disclosure/source under monetization.affiliate.',
			);
		}
		const affiliateEnabled = requireBoolean(raw.affiliate, 'enabled', `${location}.affiliate`, {
			optional: true,
			defaultValue: false,
		})!;
		const disclosure = requireBoolean(raw.affiliate, 'disclosure', `${location}.affiliate`, {
			optional: true,
			defaultValue: true,
		})!;
		const sourceRequired = enabled && affiliateEnabled && disclosure;
		const source = requireString(raw.affiliate, 'source', `${location}.affiliate`, {
			optional: !sourceRequired,
		});
		if (sourceRequired && !source) {
			fail(
				'affiliate disclosure source is required when affiliate disclosure is enabled.',
				'monetization.affiliate.source',
				source,
				`${location}.affiliate.source`,
				'Set source to a markdown file such as site-input/trust/affiliate-disclosure.md.',
			);
		}
		affiliate = { enabled: affiliateEnabled, disclosure, source: source || undefined };
	}
	let ads: SiteSpecAds = { enabled: false };
	if (raw.ads !== undefined && raw.ads !== null) {
		if (!isRecord(raw.ads)) {
			fail(
				'monetization.ads must be a mapping.',
				'monetization.ads',
				raw.ads,
				`${location}.ads`,
				'Use monetization.ads.enabled.',
			);
		}
		ads = {
			enabled: requireBoolean(raw.ads, 'enabled', `${location}.ads`, {
				optional: true,
				defaultValue: false,
			})!,
		};
	}
	return { enabled, affiliate, ads };
}

export function isAffiliateDisclosureEnabled(spec: SiteSpec): boolean {
	return !!(spec.monetization?.enabled && spec.monetization.affiliate.enabled && spec.monetization.affiliate.disclosure);
}

function parseAnalytics(raw: unknown, location: string): SiteSpecAnalytics | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!isRecord(raw)) {
		fail('analytics must be a mapping.', 'analytics', raw, location, 'Use analytics.siteId/gameSlug/templateVersion/launchDate and provider switches.');
	}
	const analyticsRecord = raw;
	const hasIdentityContract = analyticsRecord.siteId !== undefined || analyticsRecord.gameSlug !== undefined || analyticsRecord.templateVersion !== undefined || analyticsRecord.launchDate !== undefined;
	const hasProviderSwitches = analyticsRecord.ga4 !== undefined || analyticsRecord.vercelAnalytics !== undefined;
	const hasContract = hasIdentityContract || hasProviderSwitches;
	const enabled = requireBoolean(analyticsRecord, 'enabled', location, { optional: true, defaultValue: hasContract })!;
	if (!enabled && !hasContract) {
		return undefined;
	}
	if (hasIdentityContract) {
		const siteId = requireString(analyticsRecord, 'siteId', `${location}.siteId`);
		if (!siteId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteId)) fail('analytics.siteId must be kebab-case.', 'analytics.siteId', siteId, `${location}.siteId`, 'Use a stable lowercase identifier such as serious-sam-shatterverse.');
		const gameSlug = requireString(analyticsRecord, 'gameSlug', `${location}.gameSlug`);
		if (!gameSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameSlug)) fail('analytics.gameSlug must be kebab-case.', 'analytics.gameSlug', gameSlug, `${location}.gameSlug`, 'Use a stable lowercase game identifier.');
		const templateVersion = requireString(analyticsRecord, 'templateVersion', `${location}.templateVersion`);
		if (!templateVersion || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(templateVersion)) fail('analytics.templateVersion is invalid.', 'analytics.templateVersion', templateVersion, `${location}.templateVersion`, 'Use a machine-readable version such as game-wiki-starter-v2.0.1.');
		const launchDate = requireString(analyticsRecord, 'launchDate', `${location}.launchDate`);
		const launchDateParsed = launchDate ? new Date(`${launchDate}T00:00:00Z`) : new Date('invalid');
		if (!launchDate || !/^\d{4}-\d{2}-\d{2}$/.test(launchDate) || Number.isNaN(launchDateParsed.getTime()) || launchDateParsed.toISOString().slice(0, 10) !== launchDate) fail('analytics.launchDate must be YYYY-MM-DD.', 'analytics.launchDate', launchDate, `${location}.launchDate`, 'Use a machine-readable date such as 2026-08-29.');
		function providerSwitch(key: 'ga4' | 'vercelAnalytics') {
			const value = analyticsRecord[key];
			if (!isRecord(value)) fail(`analytics.${key} must be a mapping.`, `analytics.${key}`, value, `${location}.${key}`, `Use analytics.${key}.enabled: true|false.`);
			return { enabled: requireBoolean(value, 'enabled', `${location}.${key}`)! };
		}
		return { enabled: true, siteId, gameSlug, templateVersion, launchDate, ga4: providerSwitch('ga4'), vercelAnalytics: providerSwitch('vercelAnalytics') };
	}
	if (hasProviderSwitches) {
		function optionalProviderSwitch(key: 'ga4' | 'vercelAnalytics') {
			const value = analyticsRecord[key];
			if (value === undefined) return undefined;
			if (!isRecord(value)) fail(`analytics.${key} must be a mapping.`, `analytics.${key}`, value, `${location}.${key}`, `Use analytics.${key}.enabled: true|false.`);
			return { enabled: requireBoolean(value, 'enabled', `${location}.${key}`)! };
		}
		return {
			enabled: true,
			ga4: optionalProviderSwitch('ga4'),
			vercelAnalytics: optionalProviderSwitch('vercelAnalytics'),
		};
	}
	const provider = requireString(analyticsRecord, 'provider', `${location}.provider`);
	if (!provider || !(ALLOWED_ANALYTICS_PROVIDERS as readonly string[]).includes(provider)) {
		fail(
			'analytics.provider is invalid.',
			'analytics.provider',
			provider,
			`${location}.provider`,
			'V1 only supports provider: ga4.',
		);
	}
	const measurementId = requireString(analyticsRecord, 'measurementId', `${location}.measurementId`);
	if (!measurementId || !GA4_MEASUREMENT_ID.test(measurementId)) {
		fail(
			'analytics.measurementId must be a GA4 ID.',
			'analytics.measurementId',
			measurementId,
			`${location}.measurementId`,
			'Use a GA4 measurement ID such as G-XXXXXXXXXX.',
		);
	}
	const trackOutbound = requireBoolean(analyticsRecord, 'trackOutbound', `${location}.trackOutbound`, {
		optional: true,
		defaultValue: true,
	})!;
	return {
		enabled: true,
		provider: 'ga4',
		measurementId,
		trackOutbound,
	};
}

function assertAnalyticsRequiresPrivacy(spec: SiteSpec) {
	if (!spec.analytics?.enabled) return;
	if (spec.analytics.provider !== 'ga4' && !spec.analytics.ga4?.enabled) return;
	if (spec.trust?.enabled && spec.trust.privacy?.enabled) return;
	fail(
		'GA4 analytics requires an enabled Privacy page.',
		'analytics',
		spec.analytics.provider,
		'analytics',
		'Enable trust.enabled and trust.privacy.enabled before turning on GA4. The generator will not create a Privacy page for you.',
	);
}

function parseSocialImageRef(raw: unknown, location: string): SiteSpecSocialImage | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!isRecord(raw)) {
		fail(
			'social image must be a mapping.',
			'socialImage',
			raw,
			location,
			'Use asset (assets[].target) and a non-empty alt.',
		);
	}
	const asset = requireString(raw, 'asset', `${location}.asset`)!;
	const alt = requireString(raw, 'alt', `${location}.alt`)!;
	return { asset, alt };
}

function parseSocial(raw: unknown, location: string): SiteSpecSocial | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!isRecord(raw)) {
		fail('social must be a mapping.', 'social', raw, location, 'Use social.defaultImage with asset and alt.');
	}
	const defaultImage = parseSocialImageRef(raw.defaultImage, `${location}.defaultImage`);
	return { defaultImage };
}

function assertTrustInputSource(
	source: string,
	field: string,
	rootDir: string,
	specDir: string,
	location: string,
) {
	const normalized = source.replace(/\\/g, '/');
	if (!normalized.startsWith('site-input/')) {
		fail(
			'trust source must live under site-input/.',
			field,
			source,
			location,
			'Use paths such as site-input/trust/about.md.',
		);
	}
	const full = resolveInputPath(rootDir, specDir, source);
	const rel = path.relative(rootDir, full);
	const relToSpec = path.relative(specDir, full);
	if (
		(rel.startsWith('..') || path.isAbsolute(rel)) &&
		(relToSpec.startsWith('..') || path.isAbsolute(relToSpec))
	) {
		fail(
			'trust source escapes the project/spec roots.',
			field,
			source,
			location,
			'Keep trust sources inside the repository (e.g. site-input/trust/…).',
		);
	}
	if (!existsSync(full)) {
		fail(
			'trust source file does not exist.',
			field,
			source,
			location,
			`Create ${source} before running the generator.`,
		);
	}
	assertRegularInputFile(
		full,
		field,
		location,
		`Create ${source} as a regular local file before running the generator.`,
	);
}

function assertTrustUrlCollision(spec: SiteSpec, kind: TrustPageKind, field: string) {
	const hub = normalizeHubPath(spec.site.hubPath);
	const trustSlug = TRUST_PAGE_SLUGS[kind];
	const trustHref = pageHref(hub, trustSlug);
	const trustPath = trustHref.replace(/\/+$/, '') || '/';
	for (const guide of spec.pages) {
		const guideHref = pageHref(hub, guide.slug);
		const guidePath = guideHref.replace(/\/+$/, '') || '/';
		if (guidePath === trustPath) {
			fail(
				'trust page URL collides with a guide page slug.',
				field,
				trustSlug,
				`pages[id=${guide.id}].slug`,
				`Change pages[id=${guide.id}].slug or disable this page.`,
			);
		}
	}
	for (const category of spec.categories) {
		const categoryPath = pageHref(hub, category.id).replace(/\/+$/, '') || '/';
		if (categoryPath === trustPath) {
			fail(
				'trust page URL collides with a category landing id.',
				field,
				trustSlug,
				`categories[id=${category.id}]`,
				`Rename categories[id=${category.id}] or disable this page.`,
			);
		}
	}
}

function assertTrustCollisions(spec: SiteSpec) {
	if (spec.trust?.enabled) {
		for (const kind of CORE_TRUST_PAGE_KINDS) {
			const page = spec.trust[kind];
			if (!page?.enabled) continue;
			assertTrustUrlCollision(spec, kind, `trust.${kind}`);
		}
	}
	if (isAffiliateDisclosureEnabled(spec)) {
		assertTrustUrlCollision(spec, 'affiliateDisclosure', 'monetization.affiliate');
	}
}

function assertGuidePathCollisions(spec: SiteSpec) {
	const reserved = new Map<string, string>();
	const addReserved = (href: string, owner: string) => {
		const pathValue = href.replace(/\/+$/, '') || '/';
		reserved.set(pathValue, owner);
	};

	addReserved(normalizeHubPath(spec.site.hubPath), 'Hub');
	addReserved(pageHref(spec.site.hubPath, 'guides'), 'Guides Index');
	addReserved(pageHref(spec.site.hubPath, 'routes'), 'Routes Index');
	for (const category of spec.categories) {
		addReserved(pageHref(spec.site.hubPath, category.id), `category ${category.id}`);
	}
	for (const route of spec.routes ?? []) {
		addReserved(pageHref(spec.site.hubPath, `routes/${route.id}`), `route ${route.id}`);
	}
	if (spec.trust?.enabled) {
		for (const kind of CORE_TRUST_PAGE_KINDS) {
			if (spec.trust[kind]?.enabled) {
				addReserved(pageHref(spec.site.hubPath, TRUST_PAGE_SLUGS[kind]), `trust ${kind}`);
			}
		}
	}

	for (const guide of spec.pages) {
		const guidePath = pageHref(spec.site.hubPath, guide.slug).replace(/\/+$/, '') || '/';
		const owner = reserved.get(guidePath);
		if (owner) {
			fail(
				`guide path collides with reserved ${owner} path.`,
				`pages[id=${guide.id}].slug`,
				guide.slug,
				`pages[id=${guide.id}].slug`,
				'Keep guide slugs distinct from the Hub, Guides/Routes indexes, routes, categories, and enabled trust pages.',
			);
		}
	}
}

function assertTrustSourcesExist(spec: SiteSpec, rootDir: string, specDir: string) {
	if (!spec.trust?.enabled) return;
	for (const kind of CORE_TRUST_PAGE_KINDS) {
		const page = spec.trust[kind];
		if (!page?.enabled) continue;
		assertTrustInputSource(
			page.source,
			`trust.${kind}.source`,
			rootDir,
			specDir,
			`trust.${kind}`,
		);
	}
}

function assertAffiliateDisclosureSource(spec: SiteSpec, rootDir: string, specDir: string) {
	if (!isAffiliateDisclosureEnabled(spec)) return;
	const source = spec.monetization?.affiliate.source;
	if (!source) {
		fail(
			'affiliate disclosure source is required when affiliate disclosure is enabled.',
			'monetization.affiliate.source',
			source,
			'monetization.affiliate.source',
			'Set source to a markdown file such as site-input/trust/affiliate-disclosure.md.',
		);
	}
	assertTrustInputSource(source, 'monetization.affiliate.source', rootDir, specDir, 'monetization.affiliate');
}

export function assertSafeAssetTarget(target: string, field: string, location: string): string {
	const normalized = target.replace(/\\/g, '/').replace(/^\/+/, '');
	if (!normalized || normalized.includes('\0')) {
		fail('asset target is empty or invalid.', field, target, location, 'Use a path under src/assets/.');
	}
	if (path.posix.isAbsolute(target) || path.win32.isAbsolute(target) || path.isAbsolute(target)) {
		fail(
			'asset target must be a relative path under src/assets/.',
			field,
			target,
			location,
			'Use a relative path such as hero/main.jpg. Absolute paths are forbidden.',
		);
	}
	if (
		normalized.startsWith('..') ||
		normalized.split('/').includes('..') ||
		target.includes('..\\') ||
		/(^|[\\/])\.\.([\\/]|$)/.test(target)
	) {
		fail(
			'asset target escapes src/assets/.',
			field,
			target,
			location,
			'Use a relative path inside src/assets/ such as hero/main.jpg. Path traversal is forbidden.',
		);
	}
	if (normalized.startsWith('src/assets/')) {
		fail(
			'asset target must be relative to src/assets/, not include that prefix.',
			field,
			target,
			location,
			'Write target: hero/main.jpg instead of src/assets/hero/main.jpg.',
		);
	}
	return normalized;
}

export function assertRegularInputFile(fullPath: string, field: string, location: string, hint: string): void {
	if (!existsSync(fullPath)) {
		fail('Input file does not exist.', field, fullPath, location, hint);
	}
	const stat = lstatSync(fullPath);
	if (stat.isSymbolicLink()) {
		fail(
			'Symlinked input files are not allowed in V1.',
			field,
			fullPath,
			location,
			'Provide a regular file under site-input/; symlinks are rejected to prevent path escape.',
		);
	}
	if (!stat.isFile()) {
		fail('Input path must be a regular file.', field, fullPath, location, hint);
	}
}

function placeholderString(
	obj: Record<string, unknown>,
	key: string,
	location: string,
): string {
	const value = obj[key];
	if (value === undefined || value === null) return '';
	if (typeof value !== 'string') {
		fail(`Field "${key}" must be a string.`, key, value, location, `Use a YAML string for ${key}.`);
	}
	return value.trim();
}

export function normalizePublicUrl(value: string): string {
	const parsed = new URL(value);
	parsed.hash = '';
	parsed.search = '';
	if (parsed.pathname === '/' || parsed.pathname === '') {
		return `${parsed.protocol}//${parsed.host}`;
	}
	return parsed.href.replace(/\/+$/, '');
}

export function isBlockedProductionHostname(hostname: string): boolean {
	const host = hostname.toLowerCase();
	if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1') {
		return true;
	}
	if (host === 'example' || host.endsWith('.example')) {
		return true;
	}
	if (host.endsWith('.vercel.app') && host.includes('-git-')) {
		return true;
	}
	return false;
}

function parseDeployment(raw: unknown, location: string): SiteSpecDeployment | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!isRecord(raw)) {
		fail('deployment must be a mapping.', 'deployment', raw, location, 'Provide a deployment: block.');
	}
	const provider = placeholderString(raw, 'provider', `${location}.provider`);
	if (!provider) {
		fail(
			'deployment.provider is required.',
			'deployment.provider',
			provider,
			`${location}.provider`,
			'Set provider: vercel.',
		);
	}
	if (!ALLOWED_DEPLOYMENT_PROVIDERS.includes(provider as DeploymentProvider)) {
		fail(
			'deployment.provider is not supported.',
			'deployment.provider',
			provider,
			`${location}.provider`,
			'V1 only supports provider: vercel.',
		);
	}
	const orgId = placeholderString(raw, 'orgId', `${location}.orgId`);
	const projectId = placeholderString(raw, 'projectId', `${location}.projectId`);
	const projectName = placeholderString(raw, 'projectName', `${location}.projectName`);
	const productionUrl = placeholderString(raw, 'productionUrl', `${location}.productionUrl`);
	const productionBranch = placeholderString(raw, 'productionBranch', `${location}.productionBranch`);

	if (projectId && !projectId.startsWith('prj_')) {
		fail(
			'deployment.projectId should be a Vercel project id.',
			'deployment.projectId',
			projectId,
			`${location}.projectId`,
			'Use the Vercel project id (prj_…).',
		);
	}

	if (productionUrl) {
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(productionUrl);
		} catch {
			fail(
				'deployment.productionUrl is not a valid absolute URL.',
				'deployment.productionUrl',
				productionUrl,
				`${location}.productionUrl`,
				'Use an https:// production URL.',
			);
		}
		if (parsedUrl.protocol !== 'https:') {
			fail(
				'deployment.productionUrl must use HTTPS.',
				'deployment.productionUrl',
				productionUrl,
				`${location}.productionUrl`,
				'Use an https:// production URL.',
			);
		}
		if (isBlockedProductionHostname(parsedUrl.hostname)) {
			fail(
				'deployment.productionUrl is not a public production URL.',
				'deployment.productionUrl',
				productionUrl,
				`${location}.productionUrl`,
				'Do not use localhost, *.example, or Vercel preview hostnames.',
			);
		}
	}

	return {
		provider: provider as DeploymentProvider,
		orgId,
		projectId,
		projectName,
		productionUrl,
		productionBranch,
	};
}

function parseAssets(raw: unknown, location: string): SiteSpecAsset[] {
	const list = requireArray({ assets: raw } as Record<string, unknown>, 'assets', location, { optional: true }) ?? [];
	const ids = new Set<string>();
	const targets = new Set<string>();
	return list.map((item, index) => {
		const loc = `${location}[${index}]`;
		if (!isRecord(item)) fail('asset must be a mapping.', `assets[${index}]`, item, loc, 'Fix the asset entry.');
		const id = requireString(item, 'id', `${loc}.id`)!;
		if (!KEBAB.test(id)) {
			fail('asset id must be kebab-case.', `assets[${index}].id`, id, `${loc}.id`, 'Use hero, gameplay-wide, etc.');
		}
		if (ids.has(id)) {
			fail('Duplicate asset id.', `assets[${index}].id`, id, `${loc}.id`, 'Asset ids must be unique.');
		}
		ids.add(id);
		const target = assertSafeAssetTarget(
			requireString(item, 'target', `${loc}.target`)!,
			`assets[${index}].target`,
			`${loc}.target`,
		);
		if (targets.has(target)) {
			fail('Duplicate asset target.', `assets[${index}].target`, target, `${loc}.target`, 'Each target path must be unique.');
		}
		targets.add(target);
		const sourceType = requireString(item, 'sourceType', `${loc}.sourceType`)!;
		if (!ALLOWED_SOURCE_TYPES.includes(sourceType as AssetSourceType)) {
			fail(
				'sourceType is invalid.',
				`assets[${index}].sourceType`,
				sourceType,
				`${loc}.sourceType`,
				`Use one of: ${ALLOWED_SOURCE_TYPES.join(', ')}.`,
			);
		}
		const usageStatus = requireString(item, 'usageStatus', `${loc}.usageStatus`)!;
		if (!ALLOWED_USAGE_STATUSES.includes(usageStatus as AssetUsageStatus)) {
			fail(
				'usageStatus is invalid.',
				`assets[${index}].usageStatus`,
				usageStatus,
				`${loc}.usageStatus`,
				`Use one of: ${ALLOWED_USAGE_STATUSES.join(', ')}.`,
			);
		}
		const alt = requireString(item, 'alt', `${loc}.alt`)!;
		return {
			id,
			source: requireString(item, 'source', `${loc}.source`)!,
			target,
			alt,
			sourceUrl: requireHttpUrl(item, 'sourceUrl', `${loc}.sourceUrl`, { optional: true }),
			sourceType: sourceType as AssetSourceType,
			usageStatus: usageStatus as AssetUsageStatus,
			kind: parseMediaEnum(item, 'kind', `${loc}.kind`, ALLOWED_MEDIA_KINDS),
			aspectRatio: parseMediaEnum(item, 'aspectRatio', `${loc}.aspectRatio`, ALLOWED_MEDIA_ASPECT_RATIOS),
			objectPosition: requireString(item, 'objectPosition', `${loc}.objectPosition`, { optional: true }),
		};
	});
}

function assertAssetReferences(spec: SiteSpec) {
	const assetIds = new Set(spec.assets.map((asset) => asset.id));
	const assetTargets = new Set(spec.assets.map((asset) => asset.target));
	if (spec.theme.heroAssetId && !assetIds.has(spec.theme.heroAssetId)) {
		fail(
			'theme.heroAssetId references an unknown asset.',
			'theme.heroAssetId',
			spec.theme.heroAssetId,
			'theme.heroAssetId',
			'Declare the asset under assets: or fix heroAssetId.',
		);
	}
	if (spec.theme.heroAssetId) {
		const hero = spec.assets.find((asset) => asset.id === spec.theme.heroAssetId)!;
		if (!hero.alt.trim()) {
			fail('Hero asset must include alt text.', 'assets[].alt', hero.alt, `assets[id=${hero.id}].alt`, 'Provide a non-empty alt.');
		}
	}
	for (const category of spec.categories) {
		if (category.imageAssetId && !assetIds.has(category.imageAssetId)) {
			fail(
				'category.imageAssetId references an unknown asset.',
				`categories[id=${category.id}].imageAssetId`,
				category.imageAssetId,
				`categories[id=${category.id}]`,
				'Declare the asset under assets:.',
			);
		}
	}
	for (const route of spec.routes ?? []) {
		if (route.visualAssetId && !assetIds.has(route.visualAssetId)) {
			fail(
				'route.visualAssetId references an unknown asset.',
				`routes[id=${route.id}].visualAssetId`,
				route.visualAssetId,
				`routes[id=${route.id}]`,
				'Declare the asset under assets: or omit visualAssetId for a content-only route.',
			);
		}
	}
	for (const page of spec.pages) {
		if (page.coverAssetId && !assetIds.has(page.coverAssetId)) {
			fail(
				'page.coverAssetId references an unknown asset.',
				`pages[id=${page.id}].coverAssetId`,
				page.coverAssetId,
				`pages[id=${page.id}]`,
				'Declare the asset under assets:.',
			);
		}
		if (page.cardImageAssetId && !assetIds.has(page.cardImageAssetId)) {
			fail(
				'page.cardImageAssetId references an unknown asset.',
				`pages[id=${page.id}].cardImageAssetId`,
				page.cardImageAssetId,
				`pages[id=${page.id}]`,
				'Declare the asset under assets: or omit cardImageAssetId to use coverAssetId.',
			);
		}
		for (const relatedId of page.related) {
			if (!spec.pages.some((entry) => entry.id === relatedId)) {
				fail(
					'page.related references an unknown page id.',
					`pages[id=${page.id}].related`,
					relatedId,
					`pages[id=${page.id}]`,
					'related must list page ids declared under pages:.',
				);
			}
			if (relatedId === page.id) {
				fail(
					'page.related must not include the page itself.',
					`pages[id=${page.id}].related`,
					relatedId,
					`pages[id=${page.id}]`,
					'Remove the self-reference.',
				);
			}
		}
		for (const relation of page.relations) {
			if (!spec.pages.some((entry) => entry.id === relation.pageId)) {
				fail(
					'page.relations references an unknown page id.',
					`pages[id=${page.id}].relations`,
					relation.pageId,
					`pages[id=${page.id}]`,
					'relations must list page ids declared under pages:.',
				);
			}
			if (relation.pageId === page.id) {
				fail(
					'page.relations must not reference the page itself.',
					`pages[id=${page.id}].relations`,
					relation.pageId,
					`pages[id=${page.id}]`,
					'Remove the self-relation.',
				);
			}
		}
		for (const item of page.evidence) {
			if (!assetTargets.has(item.asset)) {
				fail(
					'page.evidence asset does not match any assets[].target.',
					`pages[id=${page.id}].evidence`,
					item.asset,
					`pages[id=${page.id}]`,
					'Set evidence.asset to an existing assets[].target path relative to src/assets/.',
				);
			}
		}
		if (page.socialImage && !assetTargets.has(page.socialImage.asset)) {
			fail(
				'page.socialImage.asset does not match any assets[].target.',
				`pages[id=${page.id}].socialImage.asset`,
				page.socialImage.asset,
				`pages[id=${page.id}].socialImage`,
				'Set socialImage.asset to an existing assets[].target path relative to src/assets/.',
			);
		}
	}
	if (spec.social?.defaultImage && !assetTargets.has(spec.social.defaultImage.asset)) {
		fail(
			'social.defaultImage.asset does not match any assets[].target.',
			'social.defaultImage.asset',
			spec.social.defaultImage.asset,
			'social.defaultImage',
			'Set social.defaultImage.asset to an existing assets[].target path relative to src/assets/.',
		);
	}
	for (const item of spec.homepage.evidence?.items ?? []) {
		if (!assetIds.has(item.assetId)) {
			fail(
				'homepage.evidence item references an unknown asset.',
				'homepage.evidence.items[].assetId',
				item.assetId,
				'homepage.evidence.items',
				'Declare the asset under assets:.',
			);
		}
	}
}

function assertSourcesExist(spec: SiteSpec, rootDir: string, specDir: string) {
	for (const page of spec.pages) {
		const full = resolveInputPath(rootDir, specDir, page.source);
		const rel = path.relative(rootDir, full);
		const relToSpec = path.relative(specDir, full);
		if (
			(rel.startsWith('..') || path.isAbsolute(rel)) &&
			(relToSpec.startsWith('..') || path.isAbsolute(relToSpec))
		) {
			fail(
				'page.source escapes the project/spec roots.',
				`pages[id=${page.id}].source`,
				page.source,
				`pages[id=${page.id}]`,
				'Keep page sources inside the repository (e.g. site-input/pages/…).',
			);
		}
		if (!existsSync(full)) {
			fail(
				'page source file does not exist.',
				`pages[id=${page.id}].source`,
				page.source,
				`pages[id=${page.id}]`,
				`Create ${page.source} before running the generator.`,
			);
		}
		assertRegularInputFile(
			full,
			`pages[id=${page.id}].source`,
			`pages[id=${page.id}]`,
			`Create ${page.source} as a regular local file before running the generator.`,
		);
	}
	for (const asset of spec.assets) {
		const full = resolveInputPath(rootDir, specDir, asset.source);
		const rel = path.relative(rootDir, full);
		const relToSpec = path.relative(specDir, full);
		if (
			(rel.startsWith('..') || path.isAbsolute(rel)) &&
			(relToSpec.startsWith('..') || path.isAbsolute(relToSpec))
		) {
			fail(
				'asset.source escapes the project/spec roots.',
				`assets[id=${asset.id}].source`,
				asset.source,
				`assets[id=${asset.id}]`,
				'Keep asset sources inside the repository (e.g. site-input/assets/…).',
			);
		}
		if (!existsSync(full)) {
			fail(
				'asset source file does not exist.',
				`assets[id=${asset.id}].source`,
				asset.source,
				`assets[id=${asset.id}]`,
				`Add the local file at ${asset.source}, or run assets:bootstrap for an allowed official sourceUrl.`,
			);
		}
		assertRegularInputFile(
			full,
			`assets[id=${asset.id}].source`,
			`assets[id=${asset.id}]`,
			`Add a regular local file at ${asset.source}. Symlinks are not allowed in V1.`,
		);
	}
	assertTrustSourcesExist(spec, rootDir, specDir);
	assertAffiliateDisclosureSource(spec, rootDir, specDir);
}

export function resolveInputPath(rootDir: string, specDir: string, relativeSource: string): string {
	const fromSpec = path.resolve(specDir, relativeSource);
	if (existsSync(fromSpec)) return fromSpec;
	return path.resolve(rootDir, relativeSource);
}

export function parseSiteSpecDocument(
	raw: unknown,
	rootDir: string,
	location = 'site-spec.yaml',
	specDir = rootDir,
): SiteSpec {
	if (!isRecord(raw)) {
		fail('site-spec root must be a mapping.', 'site-spec', raw, location, 'Start with schemaVersion, site, game, …');
	}
	const schemaVersion = requireNumber(raw, 'schemaVersion', `${location}.schemaVersion`)!;
	if (schemaVersion !== SITE_SPEC_SCHEMA_VERSION) {
		fail(
			'Unsupported schemaVersion.',
			'schemaVersion',
			schemaVersion,
			`${location}.schemaVersion`,
			`V1 only supports schemaVersion: ${SITE_SPEC_SCHEMA_VERSION}.`,
		);
	}
	const templateVersion = requireString(raw, 'templateVersion', `${location}.templateVersion`)!;
	assertCompatibleTemplateVersion(templateVersion, rootDir, `${location}.templateVersion`);
	const mode = requireString(raw, 'mode', `${location}.mode`)!;
	if (mode !== 'generated-site') {
		fail(
			'mode must be generated-site for the site generator.',
			'mode',
			mode,
			`${location}.mode`,
			'Set mode: generated-site.',
		);
	}
	const presentationVersion = raw.presentationVersion === undefined
		? undefined
		: requireNumber(raw, 'presentationVersion', `${location}.presentationVersion`);
	if (presentationVersion !== undefined && presentationVersion !== 3) {
		fail('Unsupported presentationVersion.', 'presentationVersion', presentationVersion, `${location}.presentationVersion`, 'Use 3 for the V3 presentation or omit it for legacy V2 sites.');
	}
	const site = parseSite(raw.site, `${location}.site`);
	const game = parseGame(raw.game, `${location}.game`);
	const theme = parseTheme(raw.theme, `${location}.theme`);
	const categories = parseCategories(raw.categories, `${location}.categories`);
	const categoryIds = new Set(categories.map((category) => category.id));
	const pages = parsePages(raw.pages, `${location}.pages`, categoryIds);
	const pageIds = new Set(pages.map((page) => page.id));
	const routes = parseRoutes(raw.routes, `${location}.routes`, pageIds);
	const homepage = parseHomepage(raw.homepage, `${location}.homepage`, pageIds);
	const assets = parseAssets(raw.assets, `${location}.assets`);
	const trust = parseTrust(raw.trust, `${location}.trust`);
	const analytics = parseAnalytics(raw.analytics, `${location}.analytics`);
	const social = parseSocial(raw.social, `${location}.social`);
	const monetization = parseMonetization(raw.monetization, `${location}.monetization`);
	const deployment = parseDeployment(raw.deployment, `${location}.deployment`);
	if (deployment?.productionUrl) {
		const siteUrlNormalized = normalizePublicUrl(site.siteUrl);
		const productionUrlNormalized = normalizePublicUrl(deployment.productionUrl);
		if (siteUrlNormalized !== productionUrlNormalized) {
			fail(
				'site.siteUrl must match deployment.productionUrl.',
				'deployment.productionUrl',
				deployment.productionUrl,
				`${location}.deployment.productionUrl`,
				'Set both URLs to the same production origin. Production deploy will not silently fix this.',
			);
		}
	}
	const spec: SiteSpec = {
		schemaVersion,
		templateVersion,
		mode: 'generated-site',
		presentationVersion: presentationVersion as 3 | undefined,
		site,
		game,
		theme,
		categories,
		pages,
		routes,
		homepage,
		assets,
		deployment,
		trust,
		analytics,
		social,
		monetization,
	};
	assertAssetReferences(spec);
	assertGuidePathCollisions(spec);
	assertTrustCollisions(spec);
	assertAnalyticsRequiresPrivacy(spec);
	assertSourcesExist(spec, rootDir, specDir);
	return spec;
}

export function loadSiteSpec(specPath: string, rootDir: string): LoadedSiteSpec {
	const absoluteSpec = path.resolve(specPath);
	if (!existsSync(absoluteSpec) || !statSync(absoluteSpec).isFile()) {
		fail(
			'site-spec file does not exist.',
			'spec',
			specPath,
			specPath,
			'Pass an existing YAML file via --spec path/to/site-spec.yaml.',
		);
	}
	const specRaw = readFileSync(absoluteSpec, 'utf8');
	const specDir = path.dirname(absoluteSpec);
	let document: unknown;
	try {
		document = parseYaml(specRaw);
	} catch (error) {
		fail(
			'Failed to parse site-spec YAML.',
			'spec',
			String(error),
			absoluteSpec,
			'Fix YAML syntax, then re-run the generator.',
		);
	}
	const spec = parseSiteSpecDocument(
		document,
		rootDir,
		path.relative(rootDir, absoluteSpec) || absoluteSpec,
		specDir,
	);
	return {
		spec,
		specPath: absoluteSpec,
		specRaw,
		specHash: sha256Text(specRaw),
		rootDir: path.resolve(rootDir),
	};
}

export function publicSlugForPage(hubPath: string, pageSlug: string): string {
	const hub = normalizeHubPath(hubPath);
	const slug = normalizePageSlug(pageSlug);
	if (hub === '/') return slug;
	const hubSegment = hub.replace(/^\/+|\/+$/g, '');
	return `${hubSegment}/${slug}`;
}

export function publicHrefForPage(hubPath: string, pageSlug: string): string {
	return pageHref(hubPath, pageSlug);
}

export function resolveLinkTarget(
	target: SiteSpecLinkTarget,
	spec: SiteSpec,
): string {
	if (target.externalUrl) return target.externalUrl;
	if (target.anchor) return `#${target.anchor}`;
	const page = spec.pages.find((entry) => entry.id === target.pageId);
	if (!page) {
		fail(
			'Link target pageId is missing.',
			'pageId',
			target.pageId,
			'homepage CTA',
			'Declare the page under pages:.',
		);
	}
	return publicHrefForPage(spec.site.hubPath, page.slug);
}

export function mapReleaseDate(game: SiteSpecGame): string {
	if (game.releaseDate) return game.releaseDate;
	if (game.releaseStatus === 'unknown') return 'unknown';
	return 'TBD';
}

export function resolvePlaceholders(markdown: string, spec: SiteSpec, pageId: string): string {
	const pageIds = new Set(spec.pages.map((page) => page.id));
	let output = markdown.replace(/\{\{hub\}\}/g, normalizeHubPath(spec.site.hubPath));

	output = output.replace(/\{\{page:([a-z0-9]+(?:-[a-z0-9]+)*)\}\}/g, (_match, id: string) => {
		if (!pageIds.has(id)) {
			fail(
				'Unknown page id in markdown placeholder.',
				`pages[id=${pageId}].source`,
				`{{page:${id}}}`,
				spec.pages.find((page) => page.id === pageId)?.source ?? pageId,
				'Use {{page:<declared-page-id>}} only. Fuzzy matching is not supported.',
			);
		}
		const page = spec.pages.find((entry) => entry.id === id)!;
		return publicHrefForPage(spec.site.hubPath, page.slug);
	});

	if (/\{\{page:[^}]+\}\}/.test(output) || /\{\{hub\}\}/.test(output)) {
		fail(
			'Unresolved internal placeholders remain in page markdown.',
			`pages[id=${pageId}].source`,
			output.match(/\{\{(?:page:[^}]+|hub)\}\}/)?.[0],
			spec.pages.find((page) => page.id === pageId)?.source ?? pageId,
			'Only {{hub}} and {{page:<id>}} are supported; fix unknown placeholders.',
		);
	}
	return output;
}
