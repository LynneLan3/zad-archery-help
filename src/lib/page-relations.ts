export const PAGE_ROLES = ['core', 'supporting'] as const;
export type PageRole = (typeof PAGE_ROLES)[number];

export const RELATION_TYPES = ['related', 'next-step'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** Runtime relation on a guide (public slug + type). */
export interface PageRelationView {
	slug: string;
	type: RelationType;
}

/** Spec / config relation (page id + type). */
export interface PageRelationRef {
	pageId: string;
	type: RelationType;
}

export function isPageRole(value: string): value is PageRole {
	return (PAGE_ROLES as readonly string[]).includes(value);
}

export function isRelationType(value: string): value is RelationType {
	return (RELATION_TYPES as readonly string[]).includes(value);
}

function normalizeSlug(slug: string): string {
	return slug.replace(/^\/+|\/+$/g, '');
}

/**
 * Merge legacy `related` slugs with relations where type=`related`.
 * Preserves order: legacy first, then relations. Drops duplicates by slug.
 */
export function mergeRelatedSlugs(
	legacyRelated: readonly string[] | undefined,
	relations: readonly PageRelationView[] | undefined,
): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of legacyRelated ?? []) {
		const slug = normalizeSlug(raw);
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
	}
	for (const relation of relations ?? []) {
		if (relation.type !== 'related') continue;
		const slug = normalizeSlug(relation.slug);
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
	}
	return out;
}

/** First configured next-step relation slug, if any. */
export function nextStepSlug(relations: readonly PageRelationView[] | undefined): string | undefined {
	return nextStepSlugs(relations)[0];
}

/** All configured next-step relation slugs (config order, max 3). */
export function nextStepSlugs(relations: readonly PageRelationView[] | undefined): string[] {
	const out: string[] = [];
	for (const relation of relations ?? []) {
		if (relation.type !== 'next-step') continue;
		const slug = normalizeSlug(relation.slug);
		if (slug && !out.includes(slug)) {
			out.push(slug);
			if (out.length >= 3) break;
		}
	}
	return out;
}
