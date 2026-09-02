import type { PageRelationRef, PageRole } from '../lib/page-relations';
import type { PageAssetType, PageEvidenceItem, PageSource } from '../lib/page-evidence';
import type { TrustPageKind } from '../lib/trust';

export type {
	PageRole,
	RelationType,
	PageRelationRef,
	PageRelationView,
} from '../lib/page-relations';

export type {
	PageAssetType,
	PageSourceType,
	EvidenceSourceType,
	PageSource,
	PageEvidenceItem,
} from '../lib/page-evidence';

export type UiLocale = 'en' | 'zh-CN';
export type SiteMode = 'standalone' | 'hub';

export type ReleaseStatus =
	| 'announced'
	| 'pre-release'
	| 'early-access'
	| 'released'
	| 'unknown';

export interface GameCategory {
	id: string;
	label: string;
	description: string;
	icon: string;
	order: number;
	/** Optional path relative to `src/assets/` (subfolders allowed). */
	image?: string;
}

export type GameAssetUsage = 'homepageHero' | 'guideCard' | 'articleHero' | 'inlineMedia';

export interface GameAssetManifestEntry {
	assetId: string;
	source: string;
	localPath: string;
	width: number;
	height: number;
	aspectRatio: number;
	fileSize: number;
	usage: readonly GameAssetUsage[];
}

export interface GameRuntimeCompatibility {
	generatorContract: string;
	experienceRenderer: string;
	pageSchema: string;
	navigationShell: string;
	guideLibrary: string;
	articleContract: string;
	fingerprint: string;
}

/**
 * Resolved player-facing page within a Route.
 * Built at generation time from site-spec pages — the runtime never re-parses site-spec.
 */
export interface GameRoutePage {
	pageId: string;
	href: string;
	title: string;
	/** Compact player-facing label; falls back to the full title. */
	label?: string;
	description: string;
	/** Inherited from the page's eyebrow when present. */
	eyebrow?: string;
	/** Optional cover asset path relative to `src/assets/`. */
	image?: string;
}

/** One of a Route's quick answers. Target must belong to the same route's pages. */
export interface GameRouteFastAnswer {
	question: string;
	answer: string;
	pageId: string;
	href: string;
}

/**
 * Player-facing route path — a task path, not a content folder.
 * Distinct from Category: Category organizes content for backend/sidebar,
 * Route describes how a player moves through guides (order is meaningful).
 * `routes[].pages` is the single authoritative Guide → Route membership source.
 */
export interface GameRoute {
	id: string;
	eyebrow?: string;
	title: string;
	description: string;
	/** Route landing href: `/{hubPath}/routes/{id}/`. */
	href: string;
	/** Optional visual asset path relative to `src/assets/`. Omit → content-only route. */
	visual?: string;
	/** Ordered guide list — preserve order (Follow the Route). */
	pages: readonly GameRoutePage[];
	/** Max 3 quick answers for this route. */
	fastAnswers?: readonly GameRouteFastAnswer[];
}

export interface GamePortalQuestion {
	label: string;
	href: string;
	/** Optional one-line context under the question. Omit to show title only. */
	context?: string;
}

export interface GameHubStatusItem {
	label: string;
	value: string;
}

/** Player-task entry for Start Here. Not the same as category browse. */
export interface GameHubStartHereItem {
	title: string;
	description: string;
	href: string;
	/** Optional path relative to `src/assets/`. */
	image?: string;
	/** Small eyebrow label (e.g. Beginner, Systems). */
	label?: string;
	badge?: string;
}

export interface GameHubEvidenceItem {
	/** Path relative to `src/assets/`. */
	image: string;
	alt: string;
	caption?: string;
	href?: string;
}

/** Optional Hub evidence / gameplay visual block. Omit entirely to hide the section. */
export interface GameHubEvidence {
	title?: string;
	description?: string;
	items: readonly GameHubEvidenceItem[];
}

export interface GameHubRecentUpdate {
	title: string;
	href: string;
	/** ISO date string, e.g. 2026-08-13 */
	date: string;
	changeSummary?: string;
	tag?: string;
}

export interface GamePortalCta {
	label: string;
	href: string;
}

export interface GamePortalNavItem {
	label: string;
	href: string;
}

export interface GamePortalConfig {
	/** High-value primary guide navigation; About remains secondary/footer. */
	primaryNav?: readonly GamePortalNavItem[];
	/** Compact question list on the Hub. Each href should point at a real guide. */
	popularQuestions?: readonly GamePortalQuestion[];
	/** Recently Updated list. Defaults to true when omitted. */
	showRecentlyUpdated?: boolean;
	/** Max items in Recently Updated. Defaults to 3. */
	maxRecent?: number;
	/** Compact About / Game Info on the Hub. Defaults to true when omitted. */
	showAbout?: boolean;
	/** Optional badge above the Hub H1 (kept for compatibility; Hub Hero no longer renders it). */
	heroBadge?: string;
	/** Optional primary Hero CTA. Falls back to Start Here. */
	primaryCta?: GamePortalCta;
	/** Optional secondary Hero CTA. Falls back to Browse Guides. */
	secondaryCta?: GamePortalCta;
	/**
	 * Optional Game Status Rail under the Hero (max 4).
	 * When omitted, Hub derives up to 4 items from existing game fields.
	 * When set, empty values are skipped and missing items are not padded.
	 */
	statusItems?: readonly GameHubStatusItem[];
	/**
	 * Player-task Start Here cards (typically 4).
	 * When omitted, Hub falls back to guides with `featured: true`.
	 */
	startHere?: readonly GameHubStartHereItem[];
	/**
	 * Optional gameplay / official media strip.
	 * When omitted or when `items` is empty, the section is not rendered.
	 */
	evidence?: GameHubEvidence;
	/**
	 * Optional curated Recently Updated rows.
	 * When omitted, Hub auto-builds from guide `lastUpdated` (+ optional `changeSummary`).
	 */
	recentUpdates?: readonly GameHubRecentUpdate[];
}

export type TrustRobotsPolicy = 'index,follow' | 'noindex,follow';

/** Runtime trust page metadata from site-spec (not used by template demo). */
export interface GameTrustPageConfig {
	enabled: true;
	slug: string;
	path: string;
	title: string;
	robots: TrustRobotsPolicy;
}

/** Optional trust / legal pages. Omitted when disabled or unconfigured. */
export interface GameTrustConfig {
	enabled: boolean;
	pages: Partial<Record<TrustPageKind, GameTrustPageConfig>>;
}

/** Generated-site page metadata from site-spec (not used by template demo guides). */
export interface GamePageConfig {
	id: string;
	pageType?: string;
	homepagePriority?: number;
	sections?: readonly { id: string; title: string }[];
	/** Public slug path segment(s) after hub, e.g. `example-game/overview`. */
	slug: string;
	role: PageRole;
	intents: readonly string[];
	relations: readonly PageRelationRef[];
	assetType: PageAssetType;
	sources: readonly PageSource[];
	evidence: readonly PageEvidenceItem[];
	socialImage?: SocialImageRef;
}

export interface SocialImageRef {
	asset: string;
	alt: string;
}

export interface GameSocialConfig {
	defaultImage?: SocialImageRef;
}

export type AnalyticsProvider = 'ga4';

export interface GameAnalyticsConfig {
	enabled: true;
	siteId?: string;
	gameSlug?: string;
	templateVersion?: string;
	launchDate?: string;
	ga4?: { enabled: boolean };
	vercelAnalytics?: { enabled: boolean };
	/** Legacy runtime fields retained for pre-G014 generated sites. */
	provider?: AnalyticsProvider;
	measurementId?: string;
	trackOutbound?: boolean;
}

export interface GameAffiliateConfig {
	enabled: boolean;
	disclosure: boolean;
}

export interface GameAdsConfig {
	enabled: boolean;
}

/** Runtime monetization switches. Omitted when the whole layer is off. */
export interface GameMonetizationConfig {
	enabled: true;
	affiliate: GameAffiliateConfig;
	ads: GameAdsConfig;
}

export interface GameConfig {
	/** Presentation-only switch. Omitted means the legacy V2 renderer. */
	presentationVersion?: 3;
	name: string;
	/** Compact product name used in nav chrome. */
	shortName: string;
	/**
	 * Full site title (browser / Starlight title).
	 * Falls back to shortName when omitted (template demo).
	 */
	title?: string;
	description: string;
	tagline: string;
	siteUrl: string;
	siteMode: SiteMode;
	/**
	 * Public path of this game’s main Hub.
	 * Supported: `/` or a single segment like `/example-game/`.
	 * Multi-segment hubs are rejected by validate:site.
	 */
	hubPath: string;
	/** Visible GamePortal H1. Falls back to `${name} Guide & Wiki` when omitted. */
	hubTitle?: string;
	/** UI locale for chrome strings. Demo default stays `en`. */
	locale?: UiLocale;
	/** Shipping / availability status shown on the Hub. */
	releaseStatus: ReleaseStatus;
	/**
	 * Confirmed calendar date (`YYYY-MM-DD`) or a non-date marker (`TBD` / `unknown` / `未定`).
	 * Do not invent dates when status is unknown/announced.
	 */
	releaseDate: string;
	developer: string;
	publisher: string;
	platforms: readonly string[];
	assets?: readonly GameAssetManifestEntry[];
	runtimeCompatibility?: GameRuntimeCompatibility;
	accentColor: string;
	/**
	 * Text/icon color for accent-filled controls (primary CTA).
	 * Injected as `--game-accent-foreground`. Defaults to a dark ink that matches the demo button.
	 */
	accentForeground?: string;
	/** Optional path relative to `src/assets/` for the Hub's full-width Hero image. */
	heroImage?: string;
	/** Accessible description for the configured Hero image. Defaults to the game name. */
	heroAlt?: string;
	/** CSS object-position value used when the Hero image is cropped. Defaults to `center`. */
	heroPosition?: string;
	logoImage?: string;
	/** Optional site disclaimer shown in Hub About when present. */
	disclaimer?: string;
	categories: readonly GameCategory[];
	/** Optional Hub portal presentation. GamePortal reads this; do not fork the component per game. */
	portal?: GamePortalConfig;
	/** Page relationship graph from site-spec. Omitted in template demo mode. */
	pages?: readonly GamePageConfig[];
	/** Optional player-facing route paths. Omitted in template demo mode and for specs without routes. */
	routes?: readonly GameRoute[];
	/** Optional trust / legal pages. Omitted in template demo mode. */
	trust?: GameTrustConfig;
	/** Optional site-level analytics. Omitted when disabled or unconfigured. */
	analytics?: GameAnalyticsConfig;
	/** Optional default social / Open Graph image. Omitted when unconfigured. */
	social?: GameSocialConfig;
	/** Optional monetization hooks. Omitted when disabled or unconfigured. */
	monetization?: GameMonetizationConfig;
}
