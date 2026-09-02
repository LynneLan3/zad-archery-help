import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const pack = path.join(root, 'research/zad-archery/2026-09-02');
const out = path.join(root, 'site-input/v4/zad-archery/site.json');
const articleDir = path.join(pack, 'guide-content/articles');
const publicRoot = '/zad-archery/';
const readJson = (file) => readFile(path.join(pack, file), 'utf8').then(JSON.parse);
const [brief, questions, sources] = await Promise.all([
	readJson('site-brief.json'), readJson('player-questions.json'), readJson('sources.json'),
]);
const articles = await Promise.all((await readdir(articleDir)).filter((file) => file.endsWith('.json')).map((file) => readFile(path.join(articleDir, file), 'utf8').then(JSON.parse)));
const ready = new Set(['READY', 'READY_WITH_LIVE_COUNT_NOTE']);
const published = articles.filter((article) => ready.has(article.research_status));
const sourceMap = new Map(sources.map((source) => [source.id, source]));

const imageFor = (route) => route.includes('steam-deck') ? '06_gameplay.jpg' : route.includes('achievements') ? '11_kotaku_gameplay.jpg' : route.includes('patch') ? '04_gameplay.jpg' : route.includes('mobile') ? '12_kotaku_cover.jpg' : route.includes('demo-save') ? '02_gameplay.jpg' : route.includes('how-long') ? '10_steam_library_hero.jpg' : '07_steam_header.jpg';
const routeId = (route) => route.replace(/^\//, '').replace(/\/$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
const evidenceFor = (article) => (article.source_ids ?? []).map((id) => {
	const source = sourceMap.get(id);
	return { evidenceId: id, sourceType: source?.tier ?? 'research', sourceRef: source?.url, finding: source?.supports?.join('; ') ?? id, lastVerified: source?.retrieved };
});
const bodyFor = (article) => ({
	intro: article.quick_answer_draft,
	sections: (article.sections ?? []).map((section, index) => ({ id: `section-${index + 1}`, title: section.h2, paragraphs: (section.claims ?? []).map((claim) => claim.text), bullets: section.table ? section.table.map((row) => `${row.name}: ${row.unlock}`) : [] })),
	faq: (article.faq ?? []).map((item, index) => ({ id: `faq-${index + 1}`, question: item.q, answer: item.a })),
});
const pageFor = (article) => {
	const id = routeId(article.route);
	const image = imageFor(article.route);
	const evidence = evidenceFor(article);
	return {
		id, title: article.title_draft, href: article.route, query: article.title_draft, playerProblem: article.primary_intent.replaceAll('_', ' '), primaryTask: article.primary_intent.includes('completion') || article.primary_intent.includes('progress') ? 'progression' : article.primary_intent.includes('achievement') ? 'collection-browse' : 'entity-lookup', priority: article.priority === 'P0' ? 10 : 8,
		facts: article.sections?.flatMap((section) => (section.claims ?? []).slice(0, 2).map((claim, index) => ({ id: `${id}-${index}`, label: section.h2, value: claim.text, verified: true }))).slice(0, 6) ?? [],
		evidence, freshness: { dataWindow: 'Verified 2026-09-02', platform: article.category === 'Platforms' ? 'Platform compatibility' : 'Launch notes' },
		assets: [{ mediaId: `media-${id}`, role: 'entity', path: `${publicRoot}${image}`, alt: `${brief.identity.game} visual for ${article.title_draft}`, caption: 'Zad Archery gameplay and official art reference.', provenance: 'User-supplied Zad Archery workspace asset; decorative/article support only.', usable: true, type: 'image/jpeg' }],
		body: bodyFor(article), primitiveData: [
			{ instanceId: `${id}-header`, primitiveId: 'A01', payload: { title: article.title_draft, task: article.primary_intent.replaceAll('_', ' '), subject: article.category ?? 'Guide' }, evidenceRefs: evidence.map((item) => item.evidenceId), mediaRefs: [`media-${id}`] },
			{ instanceId: `${id}-answer`, primitiveId: 'A02', payload: { answer: article.quick_answer_draft, qualifier: article.research_status === 'READY_WITH_LIVE_COUNT_NOTE' ? 'Live count note: 12 are currently exposed; a pre-release announcement mentioned 25.' : undefined }, evidenceRefs: evidence.slice(0, 1).map((item) => item.evidenceId), mediaRefs: [] },
		],
	};
};

const primary = [
	{ id: 'home', label: 'Home', href: '/' },
	{ id: 'guides', label: 'Guides', href: '/guides/' },
		{ id: 'progression', label: 'Progression', href: '/guides/progression/' },
		{ id: 'achievements', label: 'Achievements', href: '/achievements/' },
];
const navItems = published.map((article) => ({ id: routeId(article.route), label: article.title_draft, href: article.route, pageId: routeId(article.route) }));
const navigation = { primary, utilities: [{ id: 'search', label: 'Search', href: '/search/' }], secondary: navItems };
const pages = published.map(pageFor);
const hero = { mediaId: 'zad-hero', role: 'hero', path: `${publicRoot}10_steam_library_hero.jpg`, alt: 'Zad Archery archer facing target monsters in a green valley', caption: 'Official Zad Archery art used for brand and hero presentation.', provenance: 'User-supplied Zad Archery workspace asset; marketing/decorative only.', usable: true, type: 'image/jpeg' };
const site = { game: { name: 'Zad Archery Help', slug: 'zad-archery', accent: '#d49a22', accentForeground: '#23170d', identity: { palette: { background: '#f6f0e6', panel: '#fffaf1', ink: '#2c251e' }, typography: 'sans', background: `${publicRoot}10_steam_library_hero.jpg` } }, navigation, pages: [{ ...pages[0], id: 'home', title: 'Zad Archery Help', href: '/', query: 'Zad Archery guides', playerProblem: 'find a verified answer', priority: 20, assets: [hero], body: { intro: brief.official_game_description_summary, sections: [], faq: [] }, primitiveData: [] }, ...pages] };
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(site, null, 2)}\n`, 'utf8');
console.log(`V4 input written: ${out}`);
console.log(`Published research pages: ${pages.length}`);
console.log(`Player questions: ${questions.filter((item) => ready.has(item.status)).length} ready / ${questions.length} total`);
