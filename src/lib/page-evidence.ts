export const PAGE_ASSET_TYPES = ['article', 'reference', 'checklist', 'comparison'] as const;
export type PageAssetType = (typeof PAGE_ASSET_TYPES)[number];

export const PAGE_SOURCE_TYPES = ['official', 'steam', 'reddit', 'youtube', 'other'] as const;
export type PageSourceType = (typeof PAGE_SOURCE_TYPES)[number];

export const EVIDENCE_SOURCE_TYPES = ['firsthand', 'official', 'community'] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export interface PageSource {
	type: PageSourceType;
	title: string;
	url: string;
}

export interface PageEvidenceItem {
	/** Path relative to `src/assets/` (must match `assets[].target`). */
	asset: string;
	alt: string;
	caption?: string;
	sourceLabel?: string;
	sourceType?: EvidenceSourceType;
	sourceUrl?: string;
}

export function isPageAssetType(value: string): value is PageAssetType {
	return (PAGE_ASSET_TYPES as readonly string[]).includes(value);
}

export function isPageSourceType(value: string): value is PageSourceType {
	return (PAGE_SOURCE_TYPES as readonly string[]).includes(value);
}

export function isEvidenceSourceType(value: string): value is EvidenceSourceType {
	return (EVIDENCE_SOURCE_TYPES as readonly string[]).includes(value);
}
