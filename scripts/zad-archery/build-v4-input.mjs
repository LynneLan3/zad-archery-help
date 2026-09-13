import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const pack = path.join(root, 'research/zad-archery/2026-09-02');
const jobsRoot = path.join(root, 'content-jobs/zad-archery');
const out = path.join(root, 'site-input/v4/zad-archery/site.json');
const articleDir = path.join(pack, 'guide-content/articles');
const publicRoot = '/zad-archery/';
const FRESHNESS = 'Verified 2026-09-13';
const readJson = (file) => readFile(path.join(pack, file), 'utf8').then(JSON.parse);
const [brief, questions, sources] = await Promise.all([
	readJson('site-brief.json'), readJson('player-questions.json'), readJson('sources.json'),
]);
const articles = await Promise.all((await readdir(articleDir)).filter((file) => file.endsWith('.json')).map((file) => readFile(path.join(articleDir, file), 'utf8').then(JSON.parse)));
const ready = new Set(['READY', 'READY_WITH_LIVE_COUNT_NOTE']);
const published = articles.filter((article) => ready.has(article.research_status));
const sourceMap = new Map(sources.map((source) => [source.id, source]));

const imageFor = (route) => {
	if (route.includes('steam-deck')) return '06_gameplay.jpg';
	if (route.includes('achievements')) return '11_kotaku_gameplay.jpg';
	if (route.includes('patch') || route.includes('mega-update')) return '04_gameplay.jpg';
	if (route.includes('mobile')) return '12_kotaku_cover.jpg';
	if (route.includes('demo-save')) return '02_gameplay.jpg';
	if (route.includes('how-long') || route.includes('endless') || route.includes('rings')) return '10_steam_library_hero.jpg';
	if (route.includes('symbol')) return '07_steam_header.jpg';
	if (route.includes('guardian')) return '04_gameplay.jpg';
	return '07_steam_header.jpg';
};
const routeId = (route) => route.replace(/^\//, '').replace(/\/$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
const evidenceFor = (article) => (article.source_ids ?? []).map((id) => {
	const source = sourceMap.get(id);
	return { evidenceId: id, sourceType: source?.tier ?? 'research', sourceRef: source?.url, finding: source?.supports?.join('; ') ?? id, lastVerified: source?.retrieved };
});

function parseMarkdownBody(markdown, fallbackIntro) {
	const text = String(markdown || '').replace(/^---[\s\S]*?---\s*/, '').trim();
	const chunks = text.split(/\n(?=##\s+)/);
	let intro = fallbackIntro || '';
	const sections = [];
	const faq = [];
	for (const chunk of chunks) {
		const trimmed = chunk.trim();
		if (!trimmed) continue;
		if (!trimmed.startsWith('## ')) {
			const paras = trimmed.replace(/^#\s+.+\n+/, '').split(/\n{2,}/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
			if (!intro && paras[0]) intro = paras[0].replace(/^\*\*Quick answer:?\*\*\s*/i, '');
			continue;
		}
		const lines = trimmed.split('\n');
		const title = lines[0].replace(/^##\s+/, '').trim();
		const body = lines.slice(1).join('\n').trim();
		if (/^faq$/i.test(title)) {
			const items = body.split(/\n(?=###\s+|\*\*|Q:)/).map((block) => block.trim()).filter(Boolean);
			for (const [index, item] of items.entries()) {
				const qMatch = item.match(/^(?:###\s+|\*\*|Q:\s*)(.+?)(?:\*\*)?\s*\n([\s\S]+)$/);
				if (!qMatch) continue;
				faq.push({ id: `faq-${index + 1}`, question: qMatch[1].replace(/\*\*/g, '').trim(), answer: qMatch[2].replace(/\n+/g, ' ').trim() });
			}
			continue;
		}
		if (/quick answer/i.test(title)) {
			intro = body.split(/\n{2,}/)[0]?.replace(/\n/g, ' ').trim() || intro;
			continue;
		}
		const paragraphs = body.split(/\n{2,}/).map((p) => p.replace(/\n/g, ' ').replace(/^[-*]\s+/gm, '').trim()).filter(Boolean);
		sections.push({ id: `section-${sections.length + 1}`, title, paragraphs, bullets: [] });
	}
	return { intro, sections, faq };
}

async function loadWriterPackage(slug) {
	const candidates = [
		path.join(jobsRoot, slug, 'page.json'),
		path.join(jobsRoot, slug, 'article.md'),
	];
	for (const candidate of candidates) {
		try {
			await access(candidate);
			if (candidate.endsWith('.json')) {
				const page = JSON.parse(await readFile(candidate, 'utf8'));
				const parsed = parseMarkdownBody(page.articleMarkdown || '', page.quickAnswer || '');
				return {
					title: page.title,
					description: page.description,
					body: {
						intro: page.quickAnswer || parsed.intro,
						sections: parsed.sections.length ? parsed.sections : undefined,
						faq: Array.isArray(page.faq) && page.faq.length
							? page.faq.map((item, index) => ({ id: `faq-${index + 1}`, question: item.question, answer: item.answer }))
							: parsed.faq,
					},
				};
			}
			const markdown = await readFile(candidate, 'utf8');
			const parsed = parseMarkdownBody(markdown, '');
			const titleMatch = markdown.match(/^title:\s*["']?(.+?)["']?\s*$/m) || markdown.match(/^#\s+(.+)$/m);
			return {
				title: titleMatch?.[1]?.trim(),
				body: parsed,
			};
		} catch {
			// continue
		}
	}
	return null;
}

const bodyFor = (article, writer) => {
	if (writer?.body?.sections?.length) {
		return {
			intro: writer.body.intro || article.quick_answer_draft,
			sections: writer.body.sections,
			faq: writer.body.faq?.length
				? writer.body.faq
				: (article.faq ?? []).map((item, index) => ({ id: `faq-${index + 1}`, question: item.q, answer: item.a })),
		};
	}
	return {
		intro: writer?.body?.intro || article.quick_answer_draft,
		sections: (article.sections ?? []).map((section, index) => ({
			id: `section-${index + 1}`,
			title: section.h2,
			paragraphs: (section.claims ?? []).map((claim) => claim.text),
			bullets: section.table ? section.table.map((row) => `${row.name}: ${row.unlock}`) : [],
		})),
		faq: (article.faq ?? []).map((item, index) => ({ id: `faq-${index + 1}`, question: item.q, answer: item.a })),
	};
};

const pageFor = async (article) => {
	const id = routeId(article.route);
	const image = imageFor(article.route);
	const evidence = evidenceFor(article);
	const writer = await loadWriterPackage(article.slug);
	const body = bodyFor(article, writer);
	const title = writer?.title || article.title_draft;
	const related = (article.related_routes ?? []).map((href) => ({ href, label: href }));
	return {
		id,
		title,
		href: article.route,
		query: title,
		playerProblem: article.primary_intent.replaceAll('_', ' '),
		primaryTask: article.primary_intent.includes('completion') || article.primary_intent.includes('progress') || article.primary_intent.includes('mechanic') || article.primary_intent.includes('problem')
			? 'progression'
			: article.primary_intent.includes('achievement')
				? 'collection-browse'
				: 'entity-lookup',
		priority: article.priority === 'P0' ? 10 : 8,
		facts: article.sections?.flatMap((section) => (section.claims ?? []).slice(0, 2).map((claim, index) => ({ id: `${id}-${index}`, label: section.h2, value: claim.text, verified: true }))).slice(0, 6) ?? [],
		evidence,
		freshness: {
			dataWindow: FRESHNESS,
			platform: article.category === 'Platforms' ? 'Platform compatibility' : article.category === 'Updates' ? 'Current patch notes' : 'Current progression',
			version: article.route.includes('patch-1-0-2') ? 'Historical Patch 1.0.2' : 'Mega Update / Patch 1.1.1',
		},
		assets: [{ mediaId: `media-${id}`, role: 'entity', path: `${publicRoot}${image}`, alt: `${brief.identity.game} visual for ${title}`, caption: 'Zad Archery gameplay and official art reference.', provenance: 'User-supplied Zad Archery workspace asset; decorative/article support only.', usable: true, type: 'image/jpeg' }],
		related,
		body,
		primitiveData: [
			{ instanceId: `${id}-header`, primitiveId: 'A01', payload: { title, task: article.primary_intent.replaceAll('_', ' '), subject: article.category ?? 'Guide' }, evidenceRefs: evidence.map((item) => item.evidenceId), mediaRefs: [`media-${id}`] },
			{ instanceId: `${id}-answer`, primitiveId: 'A02', payload: { answer: body.intro, qualifier: article.research_status === 'READY_WITH_LIVE_COUNT_NOTE' ? 'Live count note: 12 are currently exposed; a pre-release announcement mentioned 25.' : undefined }, evidenceRefs: evidence.slice(0, 1).map((item) => item.evidenceId), mediaRefs: [] },
		],
	};
};

const primary = [
	{ id: 'home', label: 'Home', href: '/' },
	{ id: 'guides', label: 'Guides', href: '/guides/' },
	{ id: 'progression', label: 'Progression', href: '/guides/progression/' },
	{ id: 'updates', label: 'Updates', href: '/updates/' },
	{ id: 'achievements', label: 'Achievements', href: '/achievements/' },
];
const pages = [];
for (const article of published) pages.push(await pageFor(article));
const navItems = pages.map((page) => ({ id: page.id, label: page.title, href: page.href, pageId: page.id }));
const navigation = { primary, utilities: [{ id: 'search', label: 'Search', href: '/search/' }], secondary: navItems };
const hero = { mediaId: 'zad-hero', role: 'hero', path: `${publicRoot}10_steam_library_hero.jpg`, alt: 'Zad Archery archer facing target monsters in a green valley', caption: 'Official Zad Archery art used for brand and hero presentation.', provenance: 'User-supplied Zad Archery workspace asset; marketing/decorative only.', usable: true, type: 'image/jpeg' };
const site = {
	game: {
		name: 'Zad Archery Help',
		slug: 'zad-archery',
		accent: '#d49a22',
		accentForeground: '#23170d',
		identity: {
			palette: { background: '#f6f0e6', panel: '#fffaf1', ink: '#2c251e' },
			typography: 'sans',
			background: `${publicRoot}10_steam_library_hero.jpg`,
		},
	},
	navigation,
	pages: [{
		...pages[0],
		id: 'home',
		title: 'Zad Archery Help',
		href: '/',
		query: 'Zad Archery guides',
		playerProblem: 'find a verified answer',
		priority: 20,
		assets: [hero],
		body: {
			intro: 'Current Zad Archery answers for the September 4 Mega Update, Patch 1.1.1, Symbols, Rings, Portal Currency, Endless, and launch progression problems.',
			sections: [],
			faq: [],
		},
		primitiveData: [],
	}, ...pages],
};
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(site, null, 2)}\n`, 'utf8');
console.log(`V4 input written: ${out}`);
console.log(`Published research pages: ${pages.length}`);
console.log(`Player questions: ${questions.filter((item) => ready.has(item.status) || item.status.startsWith('READY')).length} ready / ${questions.length} total`);
