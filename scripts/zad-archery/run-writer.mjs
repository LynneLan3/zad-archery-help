import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const packRoot = path.join(root, 'research/zad-archery/2026-09-02');
const jobsRoot = path.join(root, 'content-jobs/zad-archery');
const writerPrompt = process.env.ZAD_WRITER_PROMPT || '/Users/lanling/Code/hot_words_websites/Mortal Shell II/scripts/prompts/game-guide-page-package.md';
const timeoutMs = Number(process.env.APIMART_TIMEOUT_MS || 120000);

const ready = new Set(['READY', 'READY_WITH_LIVE_COUNT_NOTE']);
const json = (file) => readFile(path.join(packRoot, file), 'utf8').then(JSON.parse);
const cleanJson = (value) => JSON.stringify(value, null, 2);

function parseJson(text) {

	const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
	const value = JSON.parse(normalized);
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Writer output must be a JSON object');
	for (const field of ['title', 'description', 'quickAnswer', 'articleMarkdown']) {
		if (typeof value[field] !== 'string' || !value[field].trim()) throw new Error(`Writer output missing ${field}`);
	}
	if (!Array.isArray(value.faq) || value.faq.some((item) => !item || typeof item.question !== 'string' || typeof item.answer !== 'string')) {
		throw new Error('Writer output FAQ is invalid');
	}
	return value;
}

async function request(prompt, research) {
	const key = process.env.APIMART_API_KEY?.trim();
	const base = (process.env.APIMART_BASE_URL || 'https://api.apimart.ai/v1').replace(/\/+$/, '');
	const model = process.env.APIMART_MODEL?.trim();
	if (!key || !model) throw new Error('APIMART_API_KEY and APIMART_MODEL are required');
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(`${base}/chat/completions`, {
			method: 'POST',
			headers: { accept: 'application/json', authorization: `Bearer ${key}`, 'content-type': 'application/json' },
			body: JSON.stringify({ model, max_tokens: 8000, stream: false, messages: [{ role: 'system', content: prompt }, { role: 'user', content: research }] }),
			signal: controller.signal,
		});
		const payload = JSON.parse(await response.text());
		if (!response.ok) throw new Error(`APIMart HTTP ${response.status}: ${payload?.error?.message || payload?.message || 'provider error'}`);
		const content = payload?.choices?.[0]?.message?.content || payload?.data?.choices?.[0]?.message?.content || payload?.content;
		if (typeof content !== 'string' || !content.trim()) throw new Error('APIMart returned empty content');
		return parseJson(content);
	} catch (error) {
		if (error?.name === 'AbortError') throw new Error(`APIMart timed out after ${timeoutMs}ms`);
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

const articleNames = (await readdir(path.join(packRoot, 'guide-content/articles'))).filter((name) => name.endsWith('.json'));
const [manifest, siteBrief, sources, articles] = await Promise.all([
	json('manifest.json'), json('site-brief.json'), json('sources.json'),
	Promise.all(articleNames.map((name) => json(`guide-content/articles/${name}`))),
]);
const targets = articles.filter((article) => ready.has(article.research_status));
const prompt = await readFile(writerPrompt, 'utf8');
await mkdir(jobsRoot, { recursive: true });
for (const article of targets) {
	const jobDir = path.join(jobsRoot, article.slug);
	await mkdir(jobDir, { recursive: true });
	const brief = [
		`# Zad Archery Writer brief: ${article.route}`,
		'\nThis is the research/evidence boundary for one page-package Writer job. It is not final prose.',
		`\n## Pack\n${cleanJson(manifest)}`,
		`\n## Site identity\n${cleanJson(siteBrief)}`,
		`\n## Article research\n${cleanJson(article)}`,
		`\n## Source records\n${cleanJson(sources.filter((source) => article.source_ids?.includes(source.id)))}`,
		'\n## Writer constraints\nUse only supplied evidence. Do not invent mechanics, thresholds, item names, locations, counts, or current-build behavior. Return the existing page-package JSON contract. Keep any caveat and live-count discrepancy explicit.',
	].join('\n');
	await writeFile(path.join(jobDir, 'research.md'), `${brief}\n`, 'utf8');
	const output = await request(prompt, brief);
	await writeFile(path.join(jobDir, 'page.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
	console.log(`${article.slug}: PASS`);
}
console.log(`writer jobs: ${targets.length}`);
