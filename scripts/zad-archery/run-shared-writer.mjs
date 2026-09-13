#!/usr/bin/env node
/**
 * Run Shared Article Writer for Zad recovery scopes, then convert Markdown
 * into the page-package JSON consumed by build-v4-input.mjs.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const writer = '/Users/lanling/Code/shared-dev-skills/article-writer/scripts/shared-article-writer.mjs';
const slugs = process.argv.slice(2);
const targets = slugs.length
	? slugs
	: [
		'getting-started',
		'how-long-to-beat-zad-archery',
		'patch-1-0-2',
		'mega-update',
		'patch-1-1-1',
		'symbols',
		'rings-portal-endless',
		'guardian-skipped-level',
	];

function run(command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => { stdout += chunk; });
		child.stderr.on('data', (chunk) => { stderr += chunk; });
		child.on('close', (code) => {
			if (code === 0) resolve({ stdout, stderr });
			else reject(new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr || stdout}`));
		});
	});
}

function stripFrontmatter(markdown) {
	return String(markdown || '').replace(/^---[\s\S]*?---\s*/, '').trim();
}

function parseFrontmatter(markdown) {
	const match = String(markdown || '').match(/^---\n([\s\S]*?)\n---/);
	const meta = {};
	if (!match) return meta;
	for (const line of match[1].split('\n')) {
		const idx = line.indexOf(':');
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim();
		const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
		meta[key] = value;
	}
	return meta;
}

function extractQuickAnswer(markdown) {
	const body = stripFrontmatter(markdown);
	const quick = body.match(/##\s+Quick Answer\s*\n+([\s\S]*?)(?=\n##\s+)/i);
	if (quick) return quick[1].trim().split(/\n{2,}/)[0].replace(/\n/g, ' ').trim();
	const paras = body.replace(/^#\s+.+\n+/, '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
	return paras[0]?.replace(/\n/g, ' ').trim() || '';
}

function extractFaq(markdown) {
	const body = stripFrontmatter(markdown);
	const faqChunk = body.split(/\n##\s+/).find((chunk) => /^faq\b/i.test(chunk));
	if (!faqChunk) return [];
	const lines = faqChunk.split('\n').slice(1).join('\n').trim();
	const blocks = lines.split(/\n(?=###\s+|\*\*[^*]+\*\*\s*\n|Q:)/).map((b) => b.trim()).filter(Boolean);
	const faq = [];
	for (const block of blocks) {
		const match = block.match(/^(?:###\s+|\*\*|Q:\s*)(.+?)(?:\*\*)?\s*\n([\s\S]+)$/);
		if (!match) continue;
		faq.push({
			question: match[1].replace(/\*\*/g, '').trim(),
			answer: match[2].replace(/\n+/g, ' ').trim(),
		});
	}
	return faq;
}

async function convertMarkdownToPage(slug) {
	const jobDir = path.join(root, 'content-jobs/zad-archery', slug);
	const articlePath = path.join(jobDir, 'article.md');
	await access(articlePath);
	const markdown = await readFile(articlePath, 'utf8');
	const meta = parseFrontmatter(markdown);
	const title = meta.title || markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || slug;
	const page = {
		title,
		description: meta.description || extractQuickAnswer(markdown).slice(0, 155),
		quickAnswer: extractQuickAnswer(markdown),
		faq: extractFaq(markdown),
		articleMarkdown: stripFrontmatter(markdown),
		writer: {
			pipeline: 'shared-dev-skills/article-writer/scripts/shared-article-writer.mjs',
			model: process.env.APIMART_MODEL || 'gpt-5-mini',
			slug,
		},
	};
	await writeFile(path.join(jobDir, 'page.json'), `${JSON.stringify(page, null, 2)}\n`, 'utf8');
	return page;
}

for (const slug of targets) {
	const input = `content-jobs/zad-archery/${slug}/research.md`;
	const output = `content-jobs/zad-archery/${slug}/article.md`;
	// V4 pages previously shipped research drafts, not Shared Writer Markdown.
	// Recovery creates the first evidence-bound Writer prose for each scope.
	const mode = 'create';
	await mkdir(path.dirname(path.join(root, output)), { recursive: true });
	const args = [
		writer,
		'--target-repo', root,
		'--input', input,
		'--output', output,
		'--mode', mode,
		'--extra-instructions',
		'Write only from the research brief. Keep answers short and evidence-bound. Do not invent rankings, exact hidden values, or unverified recovery steps. Prefer verified simple version structure: Quick Answer, short H2 sections, FAQ.',
	];
	console.log(`writer:${slug}:start mode=${mode}`);
	const result = await run(process.execPath, args);
	if (result.stdout.trim()) console.log(result.stdout.trim());
	const page = await convertMarkdownToPage(slug);
	console.log(`writer:${slug}:PASS title=${page.title}`);
}

console.log(`writer jobs complete: ${targets.length}`);
