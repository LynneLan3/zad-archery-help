/**
 * Bootstrap declared official artwork into site-input/assets.
 *
 * This is intentionally not a general image downloader. It only processes
 * assets that already have a provenance URL and an allowed official source
 * type. The site generator remains deterministic and only consumes local
 * files after this step completes.
 */
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

const ALLOWED_SOURCE_TYPES = new Set(['official', 'store', 'press-kit']);
const STEAM_HOSTS = new Set([
	'store.steampowered.com',
	'steamstatic.com',
	'fastly.steamstatic.com',
	'akamai.steamstatic.com',
	'akamaihd.net',
	'steamcdn-a.akamaihd.net',
]);
const BLOCKED_SEARCH_HOSTS = new Set([
	'google.com',
	'www.google.com',
	'bing.com',
	'www.bing.com',
	'duckduckgo.com',
	'www.duckduckgo.com',
	'yandex.com',
	'www.yandex.com',
]);
const MAX_BYTES = 30 * 1024 * 1024;

interface RawAsset {
	id?: unknown;
	source?: unknown;
	sourceUrl?: unknown;
	sourceType?: unknown;
}

interface RawAssetBootstrap {
	allowedHosts?: unknown;
}

interface CliOptions {
	specPath: string;
	dryRun: boolean;
	force: boolean;
}

function fail(message: string): never {
	throw new Error(`[assets:bootstrap] ${message}`);
}

function parseArgs(argv: string[]): CliOptions {
	let specPath = 'site-spec.yaml';
	let dryRun = false;
	let force = false;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--spec') {
			specPath = argv[index + 1] ?? fail('--spec requires a file path.');
			index += 1;
		} else if (arg === '--dry-run') {
			dryRun = true;
		} else if (arg === '--force') {
			force = true;
		} else if (arg === '--help' || arg === '-h') {
			console.log('Usage: npm run assets:bootstrap -- --spec site-spec.yaml [--dry-run] [--force]');
			process.exit(0);
		} else {
			fail(`Unknown option ${arg}.`);
		}
	}
	return { specPath, dryRun, force };
}

function isWithin(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSourceUrl(sourceUrl: string, sourceType: string, allowedOfficialHosts: Set<string>): URL {
	let parsed: URL;
	try {
		parsed = new URL(sourceUrl);
	} catch {
		fail(`sourceUrl must be an absolute URL: ${sourceUrl}`);
	}
	if (parsed.protocol !== 'https:') fail(`Only HTTPS asset URLs are allowed: ${sourceUrl}`);
	const hostname = parsed.hostname.toLowerCase();
	if (BLOCKED_SEARCH_HOSTS.has(hostname)) {
		fail(`Search-result hosts are not allowed for assets: ${sourceUrl}`);
	}
	if (sourceType === 'store') {
		const steamHost = [...STEAM_HOSTS].some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
		if (!steamHost) fail(`store assets must come from Steam or its official CDN: ${sourceUrl}`);
	} else {
		const officialHost = [...allowedOfficialHosts].some(
			(allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
		);
		if (!officialHost) {
			fail(`official and press-kit assets must match assetBootstrap.allowedHosts: ${sourceUrl}`);
		}
	}
	return parsed;
}

async function fetchImage(sourceUrl: string, sourceType: string, allowedOfficialHosts: Set<string>): Promise<Buffer> {
	let current = sourceUrl;
	for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
		assertSourceUrl(current, sourceType, allowedOfficialHosts);
		const response = await fetch(current, {
			redirect: 'manual',
			headers: { accept: 'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8' },
		});
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) fail(`Asset redirect has no Location header: ${current}`);
			if (redirectCount === 3) fail(`Too many redirects while downloading ${sourceUrl}`);
			current = new URL(location, current).href;
			continue;
		}
		if (!response.ok) fail(`Asset download failed (${response.status}) for ${current}`);
		const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
		if (!contentType?.startsWith('image/')) fail(`Remote asset is not an image (${contentType ?? 'unknown'}): ${current}`);
		const contentLength = Number(response.headers.get('content-length') ?? 0);
		if (contentLength > MAX_BYTES) fail(`Asset exceeds ${MAX_BYTES} bytes: ${current}`);
		const bytes = Buffer.from(await response.arrayBuffer());
		if (bytes.length === 0) fail(`Downloaded asset is empty: ${current}`);
		if (bytes.length > MAX_BYTES) fail(`Asset exceeds ${MAX_BYTES} bytes: ${current}`);
		return bytes;
	}
	fail(`Unable to download asset: ${sourceUrl}`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const rootDir = process.cwd();
	const specPath = path.resolve(rootDir, options.specPath);
	const specDir = path.dirname(specPath);
	const raw = parse(await readFile(specPath, 'utf8')) as { assets?: unknown; assetBootstrap?: RawAssetBootstrap };
	if (!Array.isArray(raw.assets)) {
		console.log('[assets:bootstrap] No assets declared; nothing to do.');
		return;
	}

	const inputAssetsDir = path.resolve(rootDir, 'site-input', 'assets');
	const allowedOfficialHosts = new Set(
		(Array.isArray(raw.assetBootstrap?.allowedHosts) ? raw.assetBootstrap.allowedHosts : [])
			.filter((host): host is string => typeof host === 'string')
			.map((host) => host.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')),
	);
	const candidates = raw.assets as RawAsset[];
	let downloaded = 0;
	let skipped = 0;
	for (const [index, asset] of candidates.entries()) {
		const sourceUrl = typeof asset.sourceUrl === 'string' ? asset.sourceUrl : undefined;
		if (!sourceUrl) continue;
		const id = typeof asset.id === 'string' ? asset.id : `assets[${index}]`;
		const sourceType = typeof asset.sourceType === 'string' ? asset.sourceType : '';
		if (!ALLOWED_SOURCE_TYPES.has(sourceType)) {
			fail(`${id} uses sourceType ${sourceType || '(missing)'}; bootstrap only accepts official, store, or press-kit.`);
		}
		const source = typeof asset.source === 'string' ? asset.source : '';
		if (!source) fail(`${id} needs a local source path before bootstrap.`);
		const destination = path.resolve(specDir, source);
		if (!isWithin(inputAssetsDir, destination)) {
			fail(`${id} source must stay under site-input/assets/: ${source}`);
		}
		const url = assertSourceUrl(sourceUrl, sourceType, allowedOfficialHosts);
		let existing = false;
		try {
			existing = (await stat(destination)).isFile();
		} catch {
			// Missing local source is the normal bootstrap case.
		}
		if (existing && !options.force) {
			console.log(`[assets:bootstrap] skip ${id}: ${path.relative(rootDir, destination)} already exists`);
			skipped += 1;
			continue;
		}
		console.log(`${options.dryRun ? '[assets:bootstrap] plan' : '[assets:bootstrap] fetch'} ${id} <- ${url.href}`);
		if (options.dryRun) continue;
		const bytes = await fetchImage(url.href, sourceType, allowedOfficialHosts);
		await mkdir(path.dirname(destination), { recursive: true });
		const temporary = `${destination}.download-${process.pid}-${index}`;
		await writeFile(temporary, bytes);
		await rename(temporary, destination);
		downloaded += 1;
	}
	console.log(`[assets:bootstrap] complete: downloaded=${downloaded} skipped=${skipped} dryRun=${options.dryRun}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
