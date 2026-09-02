import type { PageBody, PageBodySection, PageFaq, PageFact, PageEvidence, PageFreshness, PageAssetCandidate } from './page-data-contract';

export interface ApimartPagePackage {
	page_id?: string;
	title?: string;
	query?: string;
	player_problem?: string;
	body?: string | { intro?: string; sections?: readonly unknown[]; faq?: readonly unknown[] };
	content?: string;
	sections?: readonly unknown[];
	faq?: readonly unknown[];
	facts?: readonly PageFact[];
	evidence?: readonly PageEvidence[];
	freshness?: PageFreshness;
	assets?: readonly PageAssetCandidate[];
}

const stringValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
function normalizeSection(raw: unknown, index: number): PageBodySection | null {
	if (typeof raw === 'string') return { id: `section-${index + 1}`, title: '', paragraphs: [raw.trim()].filter(Boolean), bullets: [] };
	if (!raw || typeof raw !== 'object') return null;
	const value = raw as Record<string, unknown>;
	const paragraphs = [value.body, value.text, value.content].flatMap((item) => typeof item === 'string' ? item.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean) : []);
	const directParagraphs = Array.isArray(value.paragraphs) ? value.paragraphs.map(stringValue).filter(Boolean) : [];
	const bullets = Array.isArray(value.bullets) ? value.bullets.map(stringValue).filter(Boolean) : [];
	return { id: stringValue(value.id) || `section-${index + 1}`, title: stringValue(value.title) || stringValue(value.heading), paragraphs: [...paragraphs, ...directParagraphs], bullets };
}

export function normalizePagePackage(input: ApimartPagePackage | undefined): { body: PageBody; facts: readonly PageFact[]; evidence: readonly PageEvidence[]; freshness?: PageFreshness; assets: readonly PageAssetCandidate[] } {
	if (!input) return { body: { intro: '', sections: [], faq: [] }, facts: [], evidence: [], assets: [] };
	const rawBody = input.body;
	const objectBody = rawBody && typeof rawBody === 'object' ? rawBody : undefined;
	const sectionInput = objectBody?.sections ?? input.sections ?? [];
	const sections = (Array.isArray(sectionInput) ? sectionInput : []).map(normalizeSection).filter((item): item is PageBodySection => Boolean(item));
	const intro = typeof rawBody === 'string' ? rawBody.split(/\n{2,}/)[0]?.trim() ?? '' : stringValue(objectBody?.intro);
	const faqInput = objectBody?.faq ?? input.faq ?? [];
	const faq = (Array.isArray(faqInput) ? faqInput : []).flatMap((raw, index): PageFaq[] => {
		if (!raw || typeof raw !== 'object') return [];
		const value = raw as Record<string, unknown>;
		const question = stringValue(value.question);
		const answer = stringValue(value.answer ?? value.body);
		return question && answer ? [{ id: stringValue(value.id) || `faq-${index + 1}`, question, answer }] : [];
	});
	const bodyText = typeof input.content === 'string' ? input.content : typeof rawBody === 'string' ? rawBody : '';
	if (bodyText && !sections.length) sections.push(...bodyText.split(/\n{2,}/).slice(intro ? 1 : 0).map((text, index) => ({ id: `section-${index + 1}`, title: '', paragraphs: [text.trim()].filter(Boolean), bullets: [] })));
	return { body: { intro, sections, faq }, facts: input.facts ?? [], evidence: input.evidence ?? [], freshness: input.freshness, assets: input.assets ?? [] };
}
