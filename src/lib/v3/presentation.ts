import type { CollectionEntry } from 'astro:content';
import { game } from '../../config/game';
import { isCategoryLandingPath } from '../category-url';
import { isTrustPath } from '../trust';

export const isV3Presentation = game.presentationVersion === 3;

export function isV3Article(entry: CollectionEntry<'docs'>, pathname: string) {
	if (!isV3Presentation || entry.data.template === 'splash') return false;
	if (entry.id === '404' || entry.id.endsWith('/404')) return false;
	return !isCategoryLandingPath(pathname) && !isTrustPath(pathname);
}

export function v3NavItems() {
	return game.portal?.primaryNav?.map((item) => ({ label: item.label, href: item.href })) ?? [];
}
