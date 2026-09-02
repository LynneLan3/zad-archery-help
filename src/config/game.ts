/**
 * Per-game config entrypoint.
 * Types are hand-maintained in `game-types.ts`.
 * Site values live in `site.generated.ts` (generator-managed for generated sites).
 */
export type {
	UiLocale,
	ReleaseStatus,
	GameCategory,
	GameRoute,
	GameRoutePage,
	GameRouteFastAnswer,
	GamePortalQuestion,
	GameHubStatusItem,
	GameHubStartHereItem,
	GameHubEvidenceItem,
	GameHubEvidence,
	GameHubRecentUpdate,
	GamePortalCta,
	GamePortalConfig,
	GamePageConfig,
	GameConfig,
	PageRole,
	RelationType,
	PageRelationRef,
	PageRelationView,
	PageAssetType,
	PageSourceType,
	EvidenceSourceType,
	PageSource,
	PageEvidenceItem,
	GameTrustConfig,
	GameTrustPageConfig,
	TrustRobotsPolicy,
	GameAnalyticsConfig,
	AnalyticsProvider,
	GameSocialConfig,
	SocialImageRef,
	GameMonetizationConfig,
	GameAffiliateConfig,
	GameAdsConfig,
} from './game-types';

export type { TrustPageKind } from '../lib/trust';

export { siteConfig as game } from './site.generated';
