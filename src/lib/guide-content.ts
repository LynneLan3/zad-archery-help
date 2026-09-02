/**
 * Guide content bundle for the Experience editorial layout.
 *
 * Computes every data dependency the Experience Guide page needs from the
 * existing Starlight entry — no new schema. Shared by the header and footer
 * section components so the two halves of the layout stay in sync.
 */
import type { CollectionEntry } from 'astro:content';
import { game } from '../config/game';
import type { GameRoute } from '../config/game-types';
import { findRoutesForPage } from './routes';
import { nextStepSlugs, mergeRelatedSlugs } from './page-relations';
import { getGuides, guideHref, resolveRelated } from './guides';
import type { PageSection } from './page-types';
import type { ResolvedMediaAsset } from './media';
import { isPlaceholderAssetPath } from './asset-path';

export interface GuideContent {
	canonical: string;
	cover?: { image: NonNullable<CollectionEntry<'docs'>['data']['cover']>; media: ResolvedMediaAsset };
	facts: Array<{ label: string; value: string }>;
	quickAnswer?: string;
	lastUpdated?: Date;
	sections: PageSection[];
	nextGuides: CollectionEntry<'docs'>[];
	related: CollectionEntry<'docs'>[];
	currentRoutes: GameRoute[];
	primaryRoute?: GameRoute;
	otherRoutes: GameRoute[];
	routes: readonly GameRoute[];
	pageId: string;
}

export async function loadGuideContent(entry: CollectionEntry<'docs'>): Promise<GuideContent> {
	const routes = game.routes ?? [];
	const publicHref = guideHref(entry);
	const pageId =
		routes.flatMap((route) => route.pages).find((page) => page.href === publicHref)?.pageId ??
		(entry.id.split('/').pop() ?? entry.id);
	const currentRoutes = findRoutesForPage(pageId, routes);
	const currentRouteIds = new Set(currentRoutes.map((route) => route.id));
	const otherRoutes = routes.filter((route) => !currentRouteIds.has(route.id)).slice(0, 3);

	const sections = entry.data.sections ?? [];
	const lastUpdated = entry.data.lastUpdated instanceof Date ? entry.data.lastUpdated : undefined;

	const guides = await getGuides();
	const nextSlugs = nextStepSlugs(entry.data.relations);
	const nextGuides = nextSlugs.length > 0 ? resolveRelated(guides, nextSlugs, entry.id) : [];
	const relatedSlugs = mergeRelatedSlugs(entry.data.related, entry.data.relations).filter(
		(slug) => !nextSlugs.includes(slug),
	);
	const related = relatedSlugs.length > 0 ? resolveRelated(guides, relatedSlugs, entry.id) : [];

	return {
		canonical: new URL(publicHref, game.siteUrl).href,
		cover: entry.data.cover && !isPlaceholderAssetPath(entry.data.cover.src)
			? {
					image: entry.data.cover,
					media: {
						image: entry.data.cover,
						src: entry.data.cover.src,
						alt: entry.data.coverMedia?.alt ?? entry.data.imageAlt ?? entry.data.title,
						caption: entry.data.coverMedia?.caption,
						sourceLabel: entry.data.coverMedia?.sourceLabel,
						sourceUrl: entry.data.coverMedia?.sourceUrl,
						kind: entry.data.coverMedia?.kind ?? 'cover',
						aspectRatio: entry.data.coverMedia?.aspectRatio ?? '16:9',
						objectPosition: entry.data.coverMedia?.objectPosition,
					},
				}
			: undefined,
		facts: entry.data.facts ?? [],
		quickAnswer: entry.data.quickAnswer,
		lastUpdated,
		sections,
		nextGuides,
		related,
		currentRoutes,
		primaryRoute: currentRoutes[0],
		otherRoutes,
		routes,
		pageId,
	};
}
