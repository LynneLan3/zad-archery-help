import { readFileSync } from 'node:fs';
import path from 'node:path';

export const PRODUCT_COMPLETENESS_CHECKS = ['Identity', 'Research', 'Body', 'Composition', 'Discovery', 'Search', 'Media', 'Routes-SEO', 'Visual-UX', 'Runtime'] as const;
export type ProductCompletenessCheck = typeof PRODUCT_COMPLETENESS_CHECKS[number];
type AnyRecord = Record<string, any>;

function fail(check: ProductCompletenessCheck, message: string): never { throw new Error(`Product Completeness Checks · ${check}: ${message}`); }
function pagesOf(site: AnyRecord): AnyRecord[] { return Array.isArray(site.pages) ? site.pages : []; }
function route(href: unknown): string { return String(href ?? '').replace(/^\/v4-preview(?=\/|$)/, '') || '/'; }
function textOf(page: AnyRecord): string { const d = page.pageData ?? {}; const body = d.body ?? {}; return [body.intro, ...(body.sections ?? []).flatMap((s: AnyRecord) => [...(s.paragraphs ?? []), ...(s.bullets ?? [])]), ...(body.faq ?? []).flatMap((f: AnyRecord) => [f.question, f.answer]), ...(d.facts ?? []).flatMap((f: AnyRecord) => [f.label, f.value])].filter(Boolean).join(' '); }

export function validateProductCompleteness(site: AnyRecord): { ok: true; checks: readonly ProductCompletenessCheck[] } {
	if (!site.game?.name?.trim() || !site.game?.slug?.trim()) fail('Identity', 'game name and slug are required');
	const pages = pagesOf(site); if (!pages.length) fail('Research', 'at least one researched page is required');
	for (const page of pages) {
		const d = page.pageData ?? {}; const recipe = d.primitiveRecipe ?? []; const composition = page.composition?.primitives ?? [];
		if (!d.intent?.query?.trim() || !d.intent?.playerProblem?.trim() || typeof d.intent.priority !== 'number') fail('Research', `page ${page.id} is missing query, player problem, or priority`);
		if (!textOf(page) && !(d.primitiveData?.length)) fail('Body', `page ${page.id} has no body, facts, FAQ, or answer data`);
		if (!composition.length || !composition.every((item: AnyRecord) => recipe.some((decision: AnyRecord) => decision.primitiveId === item.id && decision.status === 'include'))) fail('Composition', `page ${page.id} composition is not resolved from included primitives`);
		const requiredByPrototype: Record<string, string[]> = { P1: ['A01'], P2: ['A01', 'E02'], P3: ['A01', 'D01'], P4: ['A01', 'P02'], P5: ['A01', 'L01'], P6: ['A01', 'P03'], P7: ['A01', 'A03'], P8: ['A01'], P9: ['A01'], P10: ['A01', 'S03'] };
		for (const id of requiredByPrototype[d.intent?.prototype] ?? []) if (!composition.some((item: AnyRecord) => item.id === id)) fail('Composition', `page ${page.id} prototype ${d.intent.prototype} lacks ${id}`);
		for (const item of d.primitiveData ?? []) for (const ref of item.mediaRefs ?? []) if (!d.media?.some((media: AnyRecord) => media.mediaId === ref && media.localRef && media.provenance)) fail('Media', `page ${page.id} has an unproven media reference ${ref}`);
	}
	const hrefs = new Set(['/','/category/','/search/', ...pages.map((page) => route(page.href))]);
	if (!site.navigation?.utilities?.some((item: AnyRecord) => item.id === 'search' && hrefs.has(route(item.href)))) fail('Discovery', 'navigation must expose the default search route');
	if (!pages.every((page) => hrefs.has(route(page.href)))) fail('Routes-SEO', 'every page must have a discoverable route');
	if (typeof site.theme?.base !== 'string' || site.theme?.functionalEvidenceFirst !== true) fail('Visual-UX', 'V4 visual theme contract is missing');
	return { ok: true, checks: PRODUCT_COMPLETENESS_CHECKS };
}

export function validateProductCompletenessFile(filePath: string): void {
	const site = JSON.parse(readFileSync(path.resolve(filePath), 'utf8'));
	const result = validateProductCompleteness(site);
	console.log(`Product Completeness Checks PASS: ${result.checks.join(' / ')}`);
}

if (process.argv[1]?.endsWith('product-completeness.ts')) validateProductCompletenessFile(process.argv[2] ?? 'src/v4/generated/example-site.json');
