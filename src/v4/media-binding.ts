import type { PlayerTask } from './intent-contract';
import type { PageAssetCandidate } from './page-data-contract';

export interface BoundMedia {
	assets: readonly PageAssetCandidate[];
	primitiveSupport: Readonly<Record<string, 'available' | 'unresolved' | 'unsupported'>>;
}

function functionalRank(role: PageAssetCandidate['role']): number {
	return role === 'map' || role === 'entity' || role === 'step' || role === 'evidence' ? 0 : role === 'hero' ? 1 : 2;
}

function hasBindablePath(candidate: PageAssetCandidate): boolean {
	const path = candidate.path?.trim();
	if (!path) return false;
	// Media may be a local public path, a relative generated asset, or an
	// explicitly remote HTTP(S) asset. Other schemes must never reach <img>.
	return !/^[a-z][a-z\d+.-]*:/i.test(path) || /^https?:\/\//i.test(path);
}

export function bindTaskMedia(task: PlayerTask, candidates: readonly PageAssetCandidate[]): BoundMedia {
	const assets = candidates.filter((candidate) => candidate.usable && hasBindablePath(candidate)).sort((a, b) => functionalRank(a.role) - functionalRank(b.role));
	const support: Record<string, 'available' | 'unresolved' | 'unsupported'> = {};
	if (task === 'location') {
		const mapAvailable = assets.some((asset) => asset.role === 'map');
		support['L02'] = mapAvailable ? 'available' : 'unsupported';
		support['L03'] = mapAvailable ? 'available' : 'unsupported';
	}
	if (task === 'entity-lookup') support['E01'] = assets.some((asset) => asset.role === 'entity') ? 'available' : 'unresolved';
	return { assets, primitiveSupport: support };
}
