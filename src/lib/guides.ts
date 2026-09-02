import { getCollection, type CollectionEntry } from 'astro:content';
import { game } from '../config/game';
import { pageHref } from './paths';

export { categoryHref, categoryIdFromPath, isCategoryLandingPath } from './category-url';

export type GuideEntry = CollectionEntry<'docs'>;

export function isGuidePage(entry: GuideEntry) {
	return entry.data.template !== 'splash';
}

function sourceDirectory(entry: GuideEntry) {
	const match = entry.filePath?.match(/(?:^|\/)src\/content\/docs\/([^/]+)\//);
	return match?.[1];
}

export function categoryIdOf(entry: GuideEntry) {
	return entry.data.category ?? sourceDirectory(entry) ?? '';
}

export function categoryOf(entry: GuideEntry) {
	const id = categoryIdOf(entry);
	return game.categories.find((category) => category.id === id);
}

export function guideSlug(entry: GuideEntry) {
	const authoredSlug = entry.data.slug?.replace(/^\/+|\/+$/g, '');
	if (authoredSlug) return authoredSlug;
	return entry.id.replace(/\/index$/, '');
}

export function guideHref(entry: GuideEntry) {
	const slug = guideSlug(entry);
	if (!slug || slug === 'index') return game.hubPath;
	return pageHref(game.hubPath, slug);
}

export async function getHubHref() {
	const docs = await getCollection('docs');
	const hub = docs.find((entry) => entry.data.template === 'splash');
	return hub ? guideHref(hub) : '/';
}

export function sortGuides(a: GuideEntry, b: GuideEntry) {
	const orderA = a.data.sidebar.order ?? Number.POSITIVE_INFINITY;
	const orderB = b.data.sidebar.order ?? Number.POSITIVE_INFINITY;
	if (orderA !== orderB) return orderA - orderB;
	return a.data.title.localeCompare(b.data.title);
}

export async function getGuides() {
	const docs = await getCollection('docs');
	return docs.filter(isGuidePage);
}

export function resolveRelated(guides: GuideEntry[], slugs: string[], sourceId: string) {
	return slugs.map((rawSlug) => {
		const slug = rawSlug.replace(/^\/+|\/+$/g, '');
		const match = guides.find((entry) => guideSlug(entry) === slug || entry.id === slug);
		if (!match) {
			throw new Error(
				`Related guide "${slug}" was not found (referenced from "${sourceId}"). Fix the frontmatter related list.`
			);
		}
		return match;
	});
}
