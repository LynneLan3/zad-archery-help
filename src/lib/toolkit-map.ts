import type { ToolkitItem } from './toolkit';

export interface ToolkitMapMarker {
	id: string;
	href?: string;
	guideUrl?: string;
}

export interface ToolkitMapTarget {
	itemId: string;
	name: string;
	mapMarkerId: string;
	category: string;
	region?: string;
}

export interface ToolkitMapGuideGroup {
	key: string;
	guideUrl: string;
	label: string;
	targets: readonly ToolkitMapTarget[];
}

/** Normalize internal guide paths so equivalent slash forms resolve together. */
export function normalizeGuideUrl(guideUrl: string): string {
	const path = guideUrl.trim().split(/[?#]/, 1)[0] || '/';
	if (path === '/') return path;
	return `/${path.replace(/^\/+|\/+$/g, '')}/`;
}

/** Return a stable key for a guide's multi-target map state. */
export function getGuideMapKey(guideUrl: string): string {
	return normalizeGuideUrl(guideUrl).replace(/^\/+|\/+$/g, '').split('/').pop() || 'guide';
}

export function getGuideMapLabel(guideUrl: string): string {
	return getGuideMapKey(guideUrl)
		.split('-')
		.filter(Boolean)
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(' ');
}

/**
 * Resolve only toolkit relations that point at an existing marker.
 * The generated site's toolkit items remain the relation source of truth.
 */
export function getMapTargetsForGuideUrl(
	guideUrl: string,
	toolkitItems: readonly ToolkitItem[],
	markers: readonly ToolkitMapMarker[],
): ToolkitMapTarget[] {
	const normalizedGuideUrl = normalizeGuideUrl(guideUrl);
	const markerIds = new Set(markers.map((marker) => marker.id));
	return toolkitItems
		.filter((item) => item.guideUrl && normalizeGuideUrl(item.guideUrl) === normalizedGuideUrl)
		.filter((item): item is typeof item & { mapMarkerId: string } => Boolean(item.mapMarkerId && markerIds.has(item.mapMarkerId)))
		.map((item) => ({
			itemId: item.id,
			name: item.name,
			mapMarkerId: item.mapMarkerId,
			category: item.category,
			region: item.region,
		}));
}

export function getToolkitMapGuideGroups(
	toolkitItems: readonly ToolkitItem[],
	markers: readonly ToolkitMapMarker[],
): ToolkitMapGuideGroup[] {
	const guideUrls = [...new Set(toolkitItems.map((item) => item.guideUrl).filter(Boolean))] as string[];
	return guideUrls
		.map((guideUrl) => ({
			key: getGuideMapKey(guideUrl),
			guideUrl: normalizeGuideUrl(guideUrl),
			label: getGuideMapLabel(guideUrl),
			targets: getMapTargetsForGuideUrl(guideUrl, toolkitItems, markers),
		}))
		.filter((group) => group.targets.length > 0);
}

/** Prefer the toolkit relation when both datasets carry a guide URL. */
export function getCanonicalGuideUrlForMapMarker(
	markerId: string,
	toolkitItems: readonly ToolkitItem[],
	markers: readonly ToolkitMapMarker[],
): string | undefined {
	return toolkitItems.find((item) => item.mapMarkerId === markerId)?.guideUrl
		?? markers.find((marker) => marker.id === markerId)?.guideUrl
		?? markers.find((marker) => marker.id === markerId)?.href;
}
