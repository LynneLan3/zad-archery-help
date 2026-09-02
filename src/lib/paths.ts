/**
 * Hub / guide / category URL helpers.
 *
 * Supported hubPath values (initial contract):
 * - `/`              → Hub at site root
 * - `/segment/`      → Hub at a single path segment (e.g. `/example-game/`)
 *
 * Multi-segment hubs like `/games/foo/` are rejected at validate/build time.
 * Category landings use `[[hub]]/[categoryId].astro` and stay one segment under the hub.
 */

export type SupportedHubKind = 'root' | 'single';

const PAGE_SLUG_SEGMENT = '[a-z0-9]+(?:-[a-z0-9]+)*';
export const PAGE_SLUG_PATTERN = new RegExp(`^(?:${PAGE_SLUG_SEGMENT})(?:\\/(?:${PAGE_SLUG_SEGMENT}))*$`);

export class PathConfigError extends Error {
	constructor(
		message: string,
		readonly field: string,
		readonly value: unknown,
		readonly hint: string,
	) {
		super(message);
		this.name = 'PathConfigError';
	}
}

/** Normalize to `/` or `/segment/` (always trailing slash except we keep `/` as `/`). */
export function normalizeHubPath(hubPath: string): string {
	const trimmed = hubPath.trim();
	if (!trimmed) {
		throw new PathConfigError(
			'hubPath is empty.',
			'game.hubPath',
			hubPath,
			'Use `/` for a root Hub or `/your-game/` for a single-segment Hub.',
		);
	}
	if (!trimmed.startsWith('/')) {
		throw new PathConfigError(
			'hubPath must start with `/`.',
			'game.hubPath',
			hubPath,
			'Example: `/` or `/example-game/`.',
		);
	}
	if (trimmed !== '/' && !/^\/[A-Za-z0-9._~-]+\/?$/.test(trimmed)) {
		throw new PathConfigError(
			'hubPath must be `/` or a single URL segment.',
			'game.hubPath',
			hubPath,
			'Multi-segment hubs (e.g. `/games/foo/`) are not supported. Use `/foo/` instead.',
		);
	}
	if (trimmed === '/') return '/';
	return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export function hubKind(hubPath: string): SupportedHubKind {
	const normalized = normalizeHubPath(hubPath);
	return normalized === '/' ? 'root' : 'single';
}

/** Public Hub href, always with trailing slash except root which is `/`. */
export function hubHref(hubPath: string): string {
	return normalizeHubPath(hubPath);
}

/**
 * Starlight splash `slug` that must match hubPath.
 * - hub `/` → `undefined` (omit frontmatter slug)
 * - hub `/example-game/` → `example-game`
 */
export function expectedHubSlug(hubPath: string): string | undefined {
	const normalized = normalizeHubPath(hubPath);
	if (normalized === '/') return undefined;
	return normalized.replace(/^\/+|\/+$/g, '');
}

/** Normalize a public guide slug, allowing safe nested kebab-case paths. */
export function normalizePageSlug(pageSlug: string): string {
	const slug = pageSlug.trim();
	if (!PAGE_SLUG_PATTERN.test(slug)) {
		throw new PathConfigError(
			'page slug must be one or more kebab-case URL segments.',
			'page.slug',
			pageSlug,
			'Use `system-requirements` or a safe nested path such as `legacy-game/classes`.',
		);
	}
	return slug;
}

/** Category landing href from hub + category id. */
export function categoryHref(hubPath: string, categoryId: string): string {
	const id = categoryId.replace(/^\/+|\/+$/g, '');
	if (!id || id.includes('/')) {
		throw new PathConfigError(
			'category id must be a single path segment.',
			'game.categories[].id',
			categoryId,
			'Use ids like `getting-started`, not nested paths.',
		);
	}
	const hub = normalizeHubPath(hubPath);
	return hub === '/' ? `/${id}/` : `${hub}${id}/`;
}

/**
 * Build an internal page href under the Hub.
 * `pageSlug` is the public path after the hub (no leading slash), e.g. `overview`.
 * Absolute in-page hashes like `#browse-guides` are returned unchanged.
 * Absolute http(s) URLs are returned unchanged.
 */
export function pageHref(hubPath: string, pageSlug: string): string {
	const raw = pageSlug.trim();
	if (!raw) {
		throw new PathConfigError(
			'page slug is empty.',
			'pageHref',
			pageSlug,
			'Pass a guide slug such as `overview`, or a hash like `#browse-guides`.',
		);
	}
	if (raw.startsWith('#')) return raw;
	if (/^https?:\/\//i.test(raw)) return raw;

	const slug = normalizePageSlug(raw.replace(/^\/+|\/+$/g, ''));
	const hub = normalizeHubPath(hubPath);
	if (hub === '/') return `/${slug}/`;
	return `${hub}${slug}/`;
}

/** Params helper kept for tests/docs; category pages use rest segments from categoryHref. */
export function categoryLandingParam(hubPath: string, categoryId: string): string {
	return categoryHref(hubPath, categoryId).replace(/^\/+|\/+$/g, '');
}

/** @deprecated Prefer categoryLandingParam + rest route `[...categoryLanding]`. */
export function categoryStaticParams(hubPath: string, categoryId: string) {
	const normalized = normalizeHubPath(hubPath);
	const id = categoryId.replace(/^\/+|\/+$/g, '');
	if (normalized === '/') {
		return { hub: undefined, categoryId: id };
	}
	return { hub: expectedHubSlug(normalized), categoryId: id };
}

export function categoryIdFromPath(hubPath: string, pathname: string, categoryIds: readonly string[]) {
	const path = pathname.replace(/\/+$/, '') || '/';
	const hub = normalizeHubPath(hubPath);
	const idSet = new Set(categoryIds);

	if (hub === '/') {
		const rest = path.replace(/^\//, '');
		return idSet.has(rest) ? rest : undefined;
	}

	const hubPrefix = hub.replace(/\/+$/, '');
	const prefix = `${hubPrefix}/`;
	if (!path.startsWith(prefix)) return undefined;
	const rest = path.slice(prefix.length);
	return idSet.has(rest) ? rest : undefined;
}

export function isCategoryLandingPath(hubPath: string, pathname: string, categoryIds: readonly string[]) {
	return Boolean(categoryIdFromPath(hubPath, pathname, categoryIds));
}

/** Soft-normalize an href for comparison (trim trailing slash except root). */
export function canonicalizePath(href: string): string {
	if (href.startsWith('#') || /^https?:\/\//i.test(href)) return href;
	const path = href.split(/[?#]/)[0] ?? href;
	if (path === '/') return '/';
	return path.replace(/\/+$/, '') || '/';
}
