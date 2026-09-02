import { canonicalizePath } from './paths';

export interface SocialImageRef {
	asset: string;
	alt: string;
}

export interface SocialImageLookup {
	pathname: string;
	pages?: readonly { slug: string; socialImage?: SocialImageRef }[];
	defaultImage?: SocialImageRef;
}

/**
 * Page socialImage wins, then site defaultImage.
 * Hub / category / trust paths have no page override and inherit default.
 * Never falls back to evidence or cover images.
 */
export function resolveSocialImage(input: SocialImageLookup): SocialImageRef | undefined {
	const path = canonicalizePath(input.pathname);
	const page = input.pages?.find((entry) => canonicalizePath(`/${entry.slug}/`) === path);
	if (page?.socialImage) return page.socialImage;
	return input.defaultImage;
}

export function toAbsoluteUrl(src: string, siteUrl: string): string {
	if (/^https?:\/\//i.test(src)) return src;
	const origin = new URL(siteUrl);
	return new URL(src, origin).href;
}

export function countMetaByProperty(html: string, property: string): number {
	const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const matches = html.match(new RegExp(`<meta\\s[^>]*property="${escaped}"`, 'gi')) ?? [];
	return matches.length;
}

export function countMetaByName(html: string, name: string): number {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const matches = html.match(new RegExp(`<meta\\s[^>]*name="${escaped}"`, 'gi')) ?? [];
	return matches.length;
}
