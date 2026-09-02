#!/usr/bin/env node
/**
 * IndexNow URL submission CLI.
 *
 * Usage:
 *   npm run indexnow -- --url https://example.com/page/
 *   npm run indexnow -- --url https://a.com/ --url https://b.com/
 *   npm run indexnow -- --urls-file changed-urls.txt
 *   npm run indexnow -- --dry-run --url https://example.com/page/
 *
 * Requires a previously generated IndexNow key (src/config/indexnow-key.json).
 * Does NOT submit by default — explicit --url or --urls-file is required.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	readIndexNowKey,
	validateUrls,
	deduplicateUrls,
	submitToIndexNow,
} from '../src/lib/indexnow';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
	urls: string[];
	dryRun: boolean;
	help: boolean;
} {
	const urls: string[] = [];
	let dryRun = false;
	let help = false;

	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--url' || arg === '-u') {
			const next = argv[++i];
			if (next) urls.push(next);
			continue;
		}
		if (arg.startsWith('--url=')) {
			urls.push(arg.slice('--url='.length));
			continue;
		}
		if (arg === '--urls-file' || arg === '-f') {
			const next = argv[++i];
			if (next) {
				const abs = path.resolve(ROOT, next);
				const content = readFileSync(abs, 'utf8');
				for (const line of content.split(/\r?\n/)) {
					const trimmed = line.trim();
					if (trimmed && !trimmed.startsWith('#')) {
						urls.push(trimmed);
					}
				}
			}
			continue;
		}
		if (arg === '--dry-run' || arg === '-d') {
			dryRun = true;
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			help = true;
			continue;
		}
		console.error(`Unknown argument: ${arg}`);
		process.exit(1);
	}

	return { urls, dryRun, help };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const { urls, dryRun, help } = parseArgs(process.argv);

	if (help) {
		console.log(`IndexNow URL submission CLI

Usage:
  npm run indexnow -- --url <URL>                Submit one URL
  npm run indexnow -- --url <A> --url <B>        Submit multiple URLs
  npm run indexnow -- --urls-file <file>          Submit URLs from file (one per line)
  npm run indexnow -- --dry-run --url <URL>       Dry-run (no network request)

Options:
  --url, -u       URL to submit (repeatable)
  --urls-file, -f File with one URL per line (# comments allowed)
  --dry-run, -d   Print payload summary without sending
  --help, -h      Show this help

Requires src/config/indexnow-key.json (run site:generate first).
No arguments → error. Use --url or --urls-file to specify URLs.`);
		process.exit(0);
	}

	// --- Require explicit URLs ---
	if (urls.length === 0) {
		console.error('Error: No URLs specified. Use --url <URL> or --urls-file <file>.');
		console.error('Run with --help for usage.');
		process.exit(1);
	}

	// --- Read key ---
	const keyData = readIndexNowKey(ROOT);
	if (!keyData) {
		console.error('Error: No IndexNow key found. Run site:generate first.');
		process.exit(1);
	}

	// --- Extract canonical host ---
	let canonicalHost: string;
	try {
		canonicalHost = new URL(keyData.siteUrl).hostname;
	} catch {
		console.error(`Error: Invalid siteUrl in indexnow-key.json: "${keyData.siteUrl}"`);
		process.exit(1);
	}

	// --- Dedup ---
	const uniqueUrls = deduplicateUrls(urls);

	// --- Validate ---
	const errors = validateUrls(uniqueUrls, canonicalHost);
	if (errors.length > 0) {
		console.error('URL validation errors:');
		for (const e of errors) {
			console.error(`  ✗ ${e.url} — ${e.reason}`);
		}
		process.exit(1);
	}

	// --- Dry-run output ---
	if (dryRun) {
		const keyPreview = keyData.key.slice(0, 8) + '…';
		const keyRedacted = keyData.key.slice(0, 8) + '[redacted]';
		console.log(`IndexNow dry-run`);
		console.log(`  host:        ${canonicalHost}`);
		console.log(`  key:         ${keyPreview}`);
		console.log(`  keyLocation: https://${canonicalHost}/${keyRedacted}.txt`);
		console.log(`  urls (${uniqueUrls.length}):`);
		for (const url of uniqueUrls) {
			console.log(`    • ${url}`);
		}
		const result = await submitToIndexNow({
			canonicalHost,
			key: keyData.key,
			urls: uniqueUrls,
			dryRun: true,
		});
		console.log(`  result: ${result.message}`);
		return;
	}

	// --- Submit ---
	console.log(`Submitting ${uniqueUrls.length} URL(s) to IndexNow...`);
	const result = await submitToIndexNow({
		canonicalHost,
		key: keyData.key,
		urls: uniqueUrls,
	});

	if (result.ok) {
		console.log(`✓ ${result.message}`);
	} else {
		console.error(`✗ ${result.message}`);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error('indexnow-submit crashed:', error);
	process.exit(1);
});
