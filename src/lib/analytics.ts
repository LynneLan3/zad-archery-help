/** Shared analytics vocabulary. Provider adapters and event phases consume this contract. */
export const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]+$/;

export type AnalyticsEnvironment = 'production' | 'preview' | 'development';

export function resolveAnalyticsEnvironment(input: {
	isProd: boolean;
	vercelEnv?: string;
}): AnalyticsEnvironment {
	if (input.vercelEnv === 'preview') return 'preview';
	if (input.vercelEnv === 'production' || input.isProd) return 'production';
	return 'development';
}

export function shouldLoadGa4(input: {
	analyticsEnabled: boolean;
	ga4Enabled: boolean;
	measurementId?: string;
	environment: AnalyticsEnvironment;
}): boolean {
	return Boolean(
		input.analyticsEnabled &&
		input.ga4Enabled &&
		input.environment === 'production' &&
		input.measurementId &&
		GA4_MEASUREMENT_ID.test(input.measurementId),
	);
}

export function shouldLoadVercelAnalytics(input: {
	analyticsEnabled: boolean;
	vercelAnalyticsEnabled: boolean;
	environment: AnalyticsEnvironment;
}): boolean {
	return Boolean(
		input.analyticsEnabled &&
		input.vercelAnalyticsEnabled &&
		input.environment === 'production',
	);
}

export const ANALYTICS_PLACEMENTS = [
	'hero',
	'popular_questions',
	'start_here',
	'browse_guides',
	'recently_updated',
	'guide_internal_link',
	'navigation',
] as const;

export type AnalyticsPlacement = (typeof ANALYTICS_PLACEMENTS)[number];

export interface AnalyticsIdentity {
	siteId: string;
	gameSlug: string;
	templateVersion: string;
	launchDate: string;
}

/** Normalize a page path for future GSC/GA4/event joins. */
export function normalizeAnalyticsPath(pathname: string): string {
	const path = pathname.trim().split(/[?#]/, 1)[0] || '/';
	const withSlash = path.startsWith('/') ? path : `/${path}`;
	return withSlash === '/' ? '/' : `${withSlash.replace(/\/+$|\s+$/g, '')}/`;
}
