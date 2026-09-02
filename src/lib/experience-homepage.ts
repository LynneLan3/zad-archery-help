/**
 * Experience Homepage data helpers (V2.2-E1).
 *
 * Deterministic section derivation for the formal Homepage at `/{hubPath}/`.
 * No new Homepage schema — every value comes from existing runtime config
 * (`game`, `game.routes`, `game.portal`) or the existing docs content
 * collection (guide `featured` / `role` / `cover` / `lastUpdated`).
 */

import type { CollectionEntry } from 'astro:content';
import { categoryOf, guideHref, sortGuides } from './guides';
import { game } from '../config/game';

export type GuideEntry = CollectionEntry<'docs'>;

/** Guides with an image can carry editorial visuals (hero / field notes). */
export function hasGuideCover(entry: GuideEntry): boolean {
	return Boolean(entry.data.cover);
}

/**
 * Featured primary candidate.
 *
 * Preference rule (in order):
 * 1. first `featured: true` guide (stable sidebar order);
 * 2. among those, prefer `role: 'core'`.
 *
 * Returns undefined only when no guide is marked featured. The Homepage
 * renders image-bearing featured guides with a visual and image-less featured
 * guides as content-only, never with a random placeholder or empty frame.
 */
export function findFeaturedGuide(guides: readonly GuideEntry[]): GuideEntry | undefined {
	const priorities = new Map<string, number>((game.pages ?? []).map((page) => [page.id, page.homepagePriority ?? Number.POSITIVE_INFINITY]));
	const candidates = guides
		.filter((entry) => entry.data.featured)
		.sort((a, b) => (priorities.get(a.id.split('/').pop() ?? a.id) ?? Number.POSITIVE_INFINITY) - (priorities.get(b.id.split('/').pop() ?? b.id) ?? Number.POSITIVE_INFINITY) || sortGuides(a, b));
	if (candidates.length === 0) return undefined;
	return candidates.find((entry) => entry.data.role === 'core') ?? candidates[0];
}

export interface FieldNotesOptions {
	/** Hrefs already surfaced by Start Here (excluded from Field Notes). */
	excludeHrefs?: ReadonlySet<string>;
	/** Href of the Featured primary page (excluded from Field Notes). */
	excludeFeaturedHref?: string;
	/** Defaults to 3. Never pads with invented content. */
	limit?: number;
}

/**
 * Field Notes / More to Explore.
 *
 * Deterministically derived from the guide content collection in stable
 * sidebar order, excluding pages already surfaced by Start Here and the
 * Featured primary. When fewer than `limit` remain, fewer are shown.
 */
export function fieldNotesFrom(
	guides: readonly GuideEntry[],
	options: FieldNotesOptions = {},
): GuideEntry[] {
	const exclude = new Set(options.excludeHrefs ?? []);
	const featuredHref = options.excludeFeaturedHref;
	return guides
		.filter((entry) => {
			const href = guideHref(entry);
			if (featuredHref && href === featuredHref) return false;
			return !exclude.has(href);
		})
		.sort(sortGuides)
		.slice(0, options.limit ?? 3);
}

export interface RecentView {
	title: string;
	href: string;
	date: Date;
	changeSummary?: string;
	tag?: string;
}

/** Recently Updated derived from guide `lastUpdated` (newest first). */
export function deriveRecentViews(guides: readonly GuideEntry[], limit = 3): RecentView[] {
	return guides
		.filter((entry) => entry.data.lastUpdated instanceof Date)
		.sort((a, b) => {
			const dateA = a.data.lastUpdated as Date;
			const dateB = b.data.lastUpdated as Date;
			return dateB.getTime() - dateA.getTime();
		})
		.slice(0, limit)
		.map((entry) => ({
			title: entry.data.title,
			href: guideHref(entry),
			date: entry.data.lastUpdated as Date,
			changeSummary: entry.data.changeSummary,
			tag: categoryOf(entry)?.label,
		}));
}

/** Stable zero-padded route number: `01`, `02`, … derived from index. */
export function routeNumber(index: number): string {
	return String(index + 1).padStart(2, '0');
}
