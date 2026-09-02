import { game } from '../config/game';
import {
	categoryHref as categoryHrefFromHub,
	categoryIdFromPath as categoryIdFromPathHelper,
	isCategoryLandingPath as isCategoryLandingPathHelper,
	normalizeHubPath,
} from './paths';

function hub() {
	return normalizeHubPath(game.hubPath);
}

/** Public URL for a category landing. Built from hubPath + category.id. */
export function categoryHref(categoryId: string) {
	return categoryHrefFromHub(hub(), categoryId);
}

export function categoryIdFromPath(pathname: string) {
	return categoryIdFromPathHelper(
		hub(),
		pathname,
		game.categories.map((category) => category.id),
	);
}

export function isCategoryLandingPath(pathname: string) {
	return isCategoryLandingPathHelper(
		hub(),
		pathname,
		game.categories.map((category) => category.id),
	);
}
