/** V2.1 page-type registry and typed article section contract. */
export const PAGE_TYPES = [
	'overview', 'puzzle', 'troubleshooting', 'how-to', 'missable',
	'location', 'boss', 'collectible', 'comparison', 'database',
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export interface PageSection {
	id: string;
	title: string;
}

export interface PageTypeSectionContract {
	renderer: 'guide-article';
	minimumSections: number;
	recommendedSections: readonly string[];
}

export const PAGE_TYPE_SECTION_CONTRACTS: Record<PageType, PageTypeSectionContract> = {
	overview: { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Summary', 'Details'] },
	puzzle: { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Quick Solution', 'Steps', 'Troubleshooting'] },
	troubleshooting: { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Quick Fix', 'Fix Steps', 'Platform-specific', 'Evidence'] },
	'how-to': { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Answer', 'Steps'] },
	missable: { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Answer', 'Requirement', 'Chapter Select / Replay behavior'] },
	location: { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Location', 'Route', 'What to collect'] },
	boss: { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Preparation', 'Strategy', 'Rewards'] },
	collectible: { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Where to find it', 'How to collect it'] },
	comparison: { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Summary', 'Differences', 'What changed'] },
	database: { renderer: 'guide-article', minimumSections: 0, recommendedSections: ['Overview', 'Details', 'References'] },
};

/** All page types resolve through one registered article renderer. */
export const PAGE_TYPE_RENDERERS: Record<PageType, 'guide-article'> = Object.fromEntries(
	PAGE_TYPES.map((pageType) => [pageType, 'guide-article']),
) as Record<PageType, 'guide-article'>;

export function isPageType(value: string): value is PageType {
	return (PAGE_TYPES as readonly string[]).includes(value);
}

export function rendererForPageType(pageType: PageType): 'guide-article' {
	return PAGE_TYPE_RENDERERS[pageType];
}
