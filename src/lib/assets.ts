import type { ImageMetadata } from 'astro';

/**
 * Recursive asset map keyed by paths relative to `src/assets/`.
 * Examples: `placeholder.svg`, `hero/cover.jpg`, `guides/overview.webp`
 */
const assetModules = import.meta.glob<{ default: ImageMetadata }>(
	'../assets/**/*.{svg,png,jpg,jpeg,webp,avif}',
	{ eager: true },
);

function normalizeAssetPath(relativePath: string): string {
	return relativePath.replace(/^\/+/, '').replace(/\\/g, '/');
}

function moduleKey(relativePath: string): string {
	return `../assets/${normalizeAssetPath(relativePath)}`;
}

export { isPlaceholderAssetPath } from './asset-path';

export function listGameAssetPaths(): string[] {
	return Object.keys(assetModules)
		.map((key) => key.replace(/^\.\.\/assets\//, ''))
		.sort();
}

/**
 * Resolve an optional image.
 * - `undefined` / empty → user did not configure → `undefined`
 * - configured but missing → throws (do not silently swallow typos)
 */
export function resolveGameAsset(
	relativePath: string | undefined,
	context?: string,
): ImageMetadata | undefined {
	if (relativePath === undefined || relativePath === '') return undefined;

	const normalized = normalizeAssetPath(relativePath);
	const asset = assetModules[moduleKey(normalized)]?.default;
	if (!asset) {
		const where = context ? ` (${context})` : '';
		const available = listGameAssetPaths();
		const hint =
			available.length > 0
				? `Available under src/assets/: ${available.slice(0, 12).join(', ')}${available.length > 12 ? ', …' : ''}`
				: 'No image files found under src/assets/.';
		throw new Error(
			`Configured image "${relativePath}" was not found under src/assets/${where}. ` +
				`Use a path relative to src/assets/ (subfolders allowed, e.g. hero/cover.jpg). ${hint}`,
		);
	}
	return asset;
}

export function gameAssetExists(relativePath: string | undefined): boolean {
	if (!relativePath) return false;
	return Boolean(assetModules[moduleKey(normalizeAssetPath(relativePath))]?.default);
}
