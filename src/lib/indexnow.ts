/**
 * IndexNow key management + URL submission.
 *
 * Each generated site owns a stable IndexNow key stored in
 * `src/config/indexnow-key.json`. The key is created on first
 * `site:generate` and reused on every subsequent run.
 *
 * The key is also materialised as `public/{KEY}.txt` so that
 * search engines can verify ownership via the IndexNow protocol.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IndexNowKeyData {
	/** The IndexNow verification key (UUID v4). */
	key: string;
	/** ISO-8601 timestamp of key creation. */
	createdAt: string;
	/** The canonical siteUrl this key was created for. */
	siteUrl: string;
}

export interface IndexNowSubmissionResult {
	ok: boolean;
	status: number;
	message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

const LOCALHOST_PATTERNS = [
	'localhost',
	'127.0.0.1',
	'0.0.0.0',
	'[::1]',
	'::1',
];

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Relative path (from project root) for the key metadata file. */
export const INDEXNOW_KEY_REL = 'src/config/indexnow-key.json';

/** Relative path (from project root) for the public verification file. */
export function indexnowKeyFileRel(key: string): string {
	return `public/${key}.txt`;
}

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

export function readIndexNowKey(rootDir: string): IndexNowKeyData | null {
	const abs = path.join(rootDir, INDEXNOW_KEY_REL);
	if (!existsSync(abs)) return null;
	return JSON.parse(readFileSync(abs, 'utf8')) as IndexNowKeyData;
}

function writeIndexNowKey(rootDir: string, data: IndexNowKeyData): void {
	const abs = path.join(rootDir, INDEXNOW_KEY_REL);
	mkdirSync(path.dirname(abs), { recursive: true });
	writeFileSync(abs, JSON.stringify(data, null, '\t') + '\n', 'utf8');
}

function writeKeyFile(rootDir: string, key: string): void {
	const abs = path.join(rootDir, indexnowKeyFileRel(key));
	mkdirSync(path.dirname(abs), { recursive: true });
	writeFileSync(abs, key, 'utf8');
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

export interface IndexNowKeyResult {
	/** The resolved key data (always present when ok is true). */
	keyData: IndexNowKeyData;
	/** Whether the key was created in this call. */
	created: boolean;
}

/**
 * Resolve the IndexNow key for a site.
 *
 * - If a key exists and its siteUrl matches → reuse.
 * - If a key exists but siteUrl differs → create new key.
 * - If no key exists and `allowCreate` is true → create new key.
 * - If no key exists and `allowCreate` is false → return null.
 */
export function resolveIndexNowKey(
	rootDir: string,
	siteUrl: string,
	allowCreate: boolean,
): IndexNowKeyResult | null {
	const existing = readIndexNowKey(rootDir);

	if (existing) {
		if (existing.siteUrl === siteUrl) {
			return { keyData: existing, created: false };
		}
		// siteUrl changed — create a new key for the new host.
		if (!allowCreate) return null;
		const keyData: IndexNowKeyData = {
			key: randomUUID(),
			createdAt: new Date().toISOString(),
			siteUrl,
		};
		writeIndexNowKey(rootDir, keyData);
		writeKeyFile(rootDir, keyData.key);
		return { keyData, created: true };
	}

	// No existing key.
	if (!allowCreate) return null;
	const keyData: IndexNowKeyData = {
		key: randomUUID(),
		createdAt: new Date().toISOString(),
		siteUrl,
	};
	writeIndexNowKey(rootDir, keyData);
	writeKeyFile(rootDir, keyData.key);
	return { keyData, created: true };
}

// ---------------------------------------------------------------------------
// Public key file ensure (for existing keys)
// ---------------------------------------------------------------------------

/**
 * Ensure `public/{KEY}.txt` exists on disk for an already-resolved key.
 * Called during applyPlan so that the verification file is always present
 * after a normal generate.
 */
export function ensureKeyFile(rootDir: string, key: string): void {
	const abs = path.join(rootDir, indexnowKeyFileRel(key));
	if (existsSync(abs)) return;
	writeKeyFile(rootDir, key);
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

export interface UrlValidationError {
	url: string;
	reason: string;
}

/**
 * Validate a list of URLs against the canonical host.
 * Returns errors for invalid URLs; empty array means all valid.
 */
export function validateUrls(urls: string[], canonicalHost: string): UrlValidationError[] {
	const errors: UrlValidationError[] = [];
	for (const raw of urls) {
		const trimmed = raw.trim();
		if (!trimmed) continue;

		let parsed: URL;
		try {
			parsed = new URL(trimmed);
		} catch {
			errors.push({ url: trimmed, reason: 'Malformed URL — must be an absolute URL with protocol.' });
			continue;
		}

		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			errors.push({ url: trimmed, reason: `Unsupported protocol "${parsed.protocol}" — only http/https allowed.` });
			continue;
		}

		if (LOCALHOST_PATTERNS.includes(parsed.hostname)) {
			errors.push({ url: trimmed, reason: 'Localhost URL — cannot submit to IndexNow in production.' });
			continue;
		}

		if (parsed.hostname !== canonicalHost) {
			errors.push({ url: trimmed, reason: `Cross-host URL — host "${parsed.hostname}" does not match canonical "${canonicalHost}".` });
			continue;
		}
	}
	return errors;
}

/**
 * Filter out localhost URLs (allowed in validation, blocked in submit).
 */
export function filterLocalhost(urls: string[]): string[] {
	return urls.filter((raw) => {
		const trimmed = raw.trim();
		if (!trimmed) return false;
		try {
			const parsed = new URL(trimmed);
			return !LOCALHOST_PATTERNS.includes(parsed.hostname);
		} catch {
			return false;
		}
	});
}

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

/**
 * Deduplicate URLs by normalised form (trailing-slash-stripped, lowercased host).
 */
export function deduplicateUrls(urls: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of urls) {
		const trimmed = raw.trim();
		if (!trimmed) continue;
		try {
			const parsed = new URL(trimmed);
			const normalised = parsed.origin + parsed.pathname.replace(/\/+$/, '') + parsed.search + parsed.hash;
			if (seen.has(normalised)) continue;
			seen.add(normalised);
			result.push(trimmed);
		} catch {
			// Malformed URLs pass through — validation will catch them later.
			if (!seen.has(trimmed)) {
				seen.add(trimmed);
				result.push(trimmed);
			}
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export interface IndexNowPayload {
	host: string;
	key: string;
	keyLocation: string;
	urlList: string[];
}

export function buildPayload(canonicalHost: string, key: string, urls: string[]): IndexNowPayload {
	return {
		host: canonicalHost,
		key,
		keyLocation: `https://${canonicalHost}/${key}.txt`,
		urlList: urls,
	};
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export interface SubmitOptions {
	/** Canonical host (from siteUrl). */
	canonicalHost: string;
	/** The IndexNow key string. */
	key: string;
	/** Validated, deduplicated URLs to submit. */
	urls: string[];
	/** If true, print payload but do not send. */
	dryRun?: boolean;
	/** Custom fetch implementation (for testing). */
	fetchImpl?: typeof fetch;
}

export async function submitToIndexNow(options: SubmitOptions): Promise<IndexNowSubmissionResult> {
	const { canonicalHost, key, urls, dryRun, fetchImpl } = options;
	const payload = buildPayload(canonicalHost, key, urls);
	const fetchFn = fetchImpl ?? globalThis.fetch;

	if (dryRun) {
		return {
			ok: true,
			status: 0,
			message: `dry-run: would POST ${urls.length} URL(s) to ${INDEXNOW_ENDPOINT}`,
		};
	}

	let response: Response;
	try {
		response = await fetchFn(INDEXNOW_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify(payload),
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return { ok: false, status: 0, message: `Network error: ${msg}` };
	}

	const status = response.status;

	if (status === 200 || status === 202) {
		return { ok: true, status, message: `IndexNow submission received (${status})` };
	}

	if (status === 400) {
		return { ok: false, status, message: 'IndexNow rejected: bad request (400). Check payload format.' };
	}
	if (status === 403) {
		return { ok: false, status, message: 'IndexNow rejected: forbidden (403). Key verification failed.' };
	}
	if (status === 422) {
		return { ok: false, status, message: 'IndexNow rejected: unprocessable (422). Check URL format and host.' };
	}
	if (status === 429) {
		return { ok: false, status, message: 'IndexNow rejected: rate limited (429). Retry later.' };
	}

	return { ok: false, status, message: `IndexNow rejected: HTTP ${status}` };
}
