import type { ImageMetadata } from 'astro';
import type { GuideEntry } from './guides';
import { isPlaceholderAssetPath } from './asset-path';

/** Resolve the visual used by a guide card while keeping `cover` compatible. */
export function resolveGuideCardImage(entry: GuideEntry): ImageMetadata | undefined {
	const image = entry.data.cardImage ?? entry.data.thumbnail ?? entry.data.cover;
	return image && !isPlaceholderAssetPath(image.src) ? image : undefined;
}

export function guideCardImageAlt(entry: GuideEntry): string {
	return entry.data.imageAlt ?? entry.data.title;
}

/** Stable partition: image-bearing cards first, preserving authored order. */
export function sortGuidesByCardImage(entries: readonly GuideEntry[]): GuideEntry[] {
	return [...entries].sort(
		(a, b) => Number(!resolveGuideCardImage(a)) - Number(!resolveGuideCardImage(b)),
	);
}
