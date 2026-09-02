import type { SiteSpec, SiteSpecPage } from './site-spec';

/** Inbound link sources counted for orphan detection (category landing excluded). */
function collectHomepageTargets(spec: SiteSpec, inbound: Map<string, Set<string>>) {
	const add = (pageId: string | undefined, source: string) => {
		if (!pageId) return;
		const set = inbound.get(pageId) ?? new Set<string>();
		set.add(source);
		inbound.set(pageId, set);
	};

	const homepage = spec.homepage;
	add(homepage.primaryCta?.pageId, 'homepage.primaryCta');
	for (const item of homepage.popularQuestions ?? []) {
		add(item.pageId, 'homepage.popularQuestions');
	}
	for (const item of homepage.startHere ?? []) {
		add(item.pageId, 'homepage.startHere');
	}
	for (const item of homepage.evidence?.items ?? []) {
		add(item.pageId, 'homepage.evidence');
	}
}

function collectGuideTargets(spec: SiteSpec, inbound: Map<string, Set<string>>) {
	for (const page of spec.pages) {
		for (const relatedId of page.related ?? []) {
			const set = inbound.get(relatedId) ?? new Set<string>();
			set.add(`pages[id=${page.id}].related`);
			inbound.set(relatedId, set);
		}
		for (const relation of page.relations ?? []) {
			const set = inbound.get(relation.pageId) ?? new Set<string>();
			set.add(`pages[id=${page.id}].relations[type=${relation.type}]`);
			inbound.set(relation.pageId, set);
		}
	}
}

/**
 * Indexable guides with no inbound links besides category landing.
 * Category landing always lists guides in its category, so it is excluded from orphan relief.
 */
export function findOrphanPages(spec: SiteSpec): SiteSpecPage[] {
	const inbound = new Map<string, Set<string>>();
	collectHomepageTargets(spec, inbound);
	collectGuideTargets(spec, inbound);

	return spec.pages.filter((page) => {
		const sources = inbound.get(page.id);
		return !sources || sources.size === 0;
	});
}

export function formatOrphanWarning(page: SiteSpecPage): string {
	return [
		`Orphan page "${page.id}" (${page.slug}) lacks inbound links besides its category landing.`,
		'Add homepage.startHere / popularQuestions / primaryCta, or link from another guide via related / relations.',
	].join(' ');
}
