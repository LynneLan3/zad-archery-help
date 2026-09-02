import type { ImageMetadata } from 'astro';

export const MEDIA_KINDS = ['cover', 'screenshot', 'evidence', 'illustration'] as const;
export const MEDIA_ASPECT_RATIOS = ['16:9', '4:3', '1:1', 'portrait', 'auto'] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];
export type MediaAspectRatio = (typeof MEDIA_ASPECT_RATIOS)[number];

/** Canonical semantic contract shared by generated and hand-authored media. */
export interface MediaAsset {
	src: string;
	alt: string;
	caption?: string;
	sourceLabel?: string;
	sourceUrl?: string;
	kind?: MediaKind;
	aspectRatio?: MediaAspectRatio;
	objectPosition?: string;
}

export interface ResolvedMediaAsset extends MediaAsset {
	image: ImageMetadata;
}

export function resolveMediaAsset(image: ImageMetadata, media: MediaAsset): ResolvedMediaAsset {
	return { ...media, src: media.src || image.src, image };
}

export function mediaAspectRatio(value: MediaAspectRatio | undefined): string | undefined {
	if (!value || value === 'auto') return undefined;
	if (value === 'portrait') return '3 / 4';
	return value.replace(':', ' / ');
}
