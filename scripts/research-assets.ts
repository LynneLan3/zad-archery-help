#!/usr/bin/env node
/**
 * Research official game media before a V2 Launch site-spec is authored.
 *
 * This is intentionally a small, ordered page probe. It reports candidates;
 * it does not create a second media schema or replace assets:bootstrap.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface SourceSpec { label: string; url?: string; sourceType: 'store' | 'official' | 'press-kit' }
interface Candidate { url: string; source: SourceSpec; purpose: string }
interface Options { game: string; steamAppId: string; sources: SourceSpec[]; out: string; maxCandidates: number }

const STEAM_MEDIA_HOST = /(^|\.)((fastly\.)?steamstatic\.com|akamaihd\.net)$/i;
const IMAGE_URL = /(?:https?:)?\/\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi;

function fail(message: string): never { throw new Error(`[assets:research] ${message}`); }

function parseArgs(argv: string[]): Options {
	let game = ''; let steamAppId = ''; let out = 'site-input/asset-research.md'; let maxCandidates = 4;
	const urls: Partial<Record<string, string>> = {};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--game') game = argv[++i] ?? '';
		else if (arg === '--steam-appid') steamAppId = argv[++i] ?? '';
		else if (arg === '--official-url') urls.official = argv[++i];
		else if (arg === '--publisher-url') urls.publisher = argv[++i];
		else if (arg === '--press-kit-url') urls.pressKit = argv[++i];
		else if (arg === '--trailer-url') urls.trailer = argv[++i];
		else if (arg === '--out') out = argv[++i] ?? '';
		else if (arg === '--max-candidates') maxCandidates = Number(argv[++i] ?? 0);
		else if (arg === '--help' || arg === '-h') {
			console.log('Usage: npm run assets:research -- --game "Game" --steam-appid 123 [--official-url https://...] [--publisher-url https://...] [--press-kit-url https://...] [--trailer-url https://...] [--max-candidates 4] [--out path]');
			process.exit(0);
		} else fail(`Unknown option ${arg}.`);
	}
	if (!game.trim()) fail('--game is required.');
	if (!/^\d+$/.test(steamAppId)) fail('--steam-appid must be numeric.');
	if (!Number.isInteger(maxCandidates) || maxCandidates < 1) fail('--max-candidates must be a positive integer.');
	if (!out.trim()) fail('--out must be a file path.');
	const sources: SourceSpec[] = [
		{ label: 'Steam official store page', url: `https://store.steampowered.com/app/${steamAppId}/`, sourceType: 'store' },
		{ label: 'Game official website', url: urls.official, sourceType: 'official' },
		{ label: 'Publisher / developer official page', url: urls.publisher, sourceType: 'official' },
		{ label: 'Official press kit', url: urls.pressKit, sourceType: 'press-kit' },
		{ label: 'Official trailer / gameplay media', url: urls.trailer, sourceType: 'official' },
	];
	for (const source of sources) if (source.url && !/^https:\/\//i.test(source.url)) fail(`${source.label} URL must be HTTPS.`);
	return { game: game.trim(), steamAppId, sources, out, maxCandidates };
}

function canonicalize(value: string, base: URL, sourceType: SourceSpec['sourceType']): string | undefined {
	try {
		const url = new URL(value.replaceAll('\\/', '/').replaceAll('&amp;', '&'), base);
		if (url.protocol !== 'https:') return undefined;
		const baseHost = base.hostname.replace(/^www\./i, '');
		const candidateHost = url.hostname.replace(/^www\./i, '');
		const allowed = sourceType === 'store'
			? STEAM_MEDIA_HOST.test(url.hostname)
			: candidateHost === baseHost || candidateHost.endsWith(`.${baseHost}`);
		if (!allowed) return undefined;
		return url.href;
	} catch { return undefined; }
}

function purpose(url: string): string {
	return /\/header\.jpg/i.test(url) || /capsule_/i.test(url)
		? 'Homepage hero / shared cover or card (crop after visual review)'
		: 'Guide cover/card reuse; evidence only when the image supports the page claim';
}

async function probe(source: SourceSpec): Promise<{ status: string; candidates: Candidate[] }> {
	if (!source.url) return { status: 'NOT_PROVIDED', candidates: [] };
	const page = new URL(source.url);
	try {
		const response = await fetch(page, { headers: { accept: 'text/html' } });
		if (!response.ok) return { status: `HTTP_${response.status}`, candidates: [] };
		const html = (await response.text()).replaceAll('\\/', '/').replaceAll('&quot;', '"');
		const steamAppPath = source.sourceType === 'store' ? `/apps/${page.pathname.match(/\/app\/(\d+)/)?.[1] ?? ''}/` : undefined;
		const candidates = [...html.matchAll(IMAGE_URL)]
			.map((match) => canonicalize(match[0], page, source.sourceType))
			.filter((url): url is string => Boolean(url))
			.filter((url) => !steamAppPath || url.includes(steamAppPath))
			.filter((url) => !/\.(?:116x65|232x130|600x338)\./i.test(url))
			.map((url) => ({ url, source, purpose: purpose(url) }));
		return { status: candidates.length > 0 ? `FOUND_${candidates.length}` : 'NO_USABLE_MEDIA_FOUND', candidates };
	} catch (error) {
		return { status: `ERROR_${error instanceof Error ? error.name : 'UNKNOWN'}`, candidates: [] };
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const selected: Candidate[] = []; const results: Array<{ source: SourceSpec; status: string }> = [];
	for (const source of options.sources) {
		if (selected.length >= options.maxCandidates) {
			results.push({ source, status: 'NOT_CHECKED_SUFFICIENT_MEDIA_FOUND' });
			continue;
		}
		const result = await probe(source);
		results.push({ source, status: result.status });
		for (const candidate of result.candidates) {
			if (!selected.some((item) => item.url === candidate.url)) selected.push(candidate);
			if (selected.length >= options.maxCandidates) break;
		}
	}
	const status = selected.length > 0 ? 'FOUND_USABLE_MEDIA' : 'NO_USABLE_MEDIA_FOUND';
	const lines = [
		`# Asset Research / Intake — ${options.game}`, '', `- Status: \`${status}\``,
		`- Researched at: ${new Date().toISOString()}`,
		'- Search is ordered and stops after enough candidates; result is not rights clearance.', '',
		'## Source order checked', '',
		...results.map(({ source, status: sourceStatus }, i) => `${i + 1}. ${source.label}: ${source.url ?? 'NOT_PROVIDED'} — ${sourceStatus}`), '',
		'## Reviewed candidates', '',
		...(selected.length > 0 ? selected.map((candidate, i) => `${i + 1}. \`${i === 0 ? 'hero-candidate' : `media-${i}`}\` — ${candidate.purpose}\n   - sourceType: \`${candidate.source.sourceType}\`\n   - sourceUrl: ${candidate.url}\n   - usageStatus: \`review-required\`\n   - review: confirm crop, mobile suitability, alt text, and rights before copying into existing \`assets[]\`.`) : ['- `NO_USABLE_MEDIA_FOUND`: retain the report and record why each source was unavailable before using disclosed `text-first`.']),
		'', '## Intake decision', '',
		'- Use the existing `assets[]` schema only; semantic reuse and different crops are allowed.',
		'- Homepage hero: use at least one suitable official visual when found.',
		'- Evidence: assign only when the image supports a specific page claim.',
	];
	const output = path.resolve(process.cwd(), options.out);
	await mkdir(path.dirname(output), { recursive: true });
	await writeFile(output, `${lines.join('\n')}\n`, 'utf8');
	console.log(`[assets:research] ${status}; candidates=${selected.length}; report=${path.relative(process.cwd(), output)}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
