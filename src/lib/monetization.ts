import { game } from '../config/game';

export const AD_PLACEMENTS = [
	'guide-after-answer',
	'guide-mid-content',
	'guide-before-related',
	'hub-after-start-here',
] as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export function isMonetizationEnabled(): boolean {
	return game.monetization?.enabled === true;
}

export function isAffiliateEnabled(): boolean {
	return isMonetizationEnabled() && game.monetization?.affiliate.enabled === true;
}

export function isAffiliateDisclosureEnabled(): boolean {
	return isAffiliateEnabled() && game.monetization?.affiliate.disclosure !== false;
}

export function isAdsEnabled(): boolean {
	return isMonetizationEnabled() && game.monetization?.ads.enabled === true;
}

/** When ads are off, AdSlot renders nothing (no empty box, no CLS). */
export function adSlotDatasetFor(
	adsEnabled: boolean,
	placement: AdPlacement,
): { 'data-ad-slot': AdPlacement } | null {
	if (!AD_PLACEMENTS.includes(placement)) return null;
	if (!adsEnabled) return null;
	return { 'data-ad-slot': placement };
}

export function adSlotDataset(placement: AdPlacement): { 'data-ad-slot': AdPlacement } | null {
	return adSlotDatasetFor(isAdsEnabled(), placement);
}
