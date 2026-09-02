/**
 * On This Page — deterministic top-level H2 extraction.
 *
 * The inline On This Page is derived from the source Markdown's top-level H2
 * headings (never from a schema field). Only `## ` headings count; H3/H4 and
 * headings inside fenced code blocks are ignored.
 *
 * Heading ids are generated with the same GitHub-slugger-compatible algorithm
 * that Astro's Markdown renderer uses, so `#anchor` links land on the exact
 * `id` Starlight emits for each heading.
 *
 * D1 deterministic fallback: when a page has more than 5 top-level H2s, only
 * the first 5 are surfaced here. The full list still renders in the body.
 */

export interface GuideHeading {
	id: string;
	text: string;
}

/** Max headings surfaced in the inline On This Page (D1 deterministic fallback). */
export const MAX_ON_THIS_PAGE = 5;

/**
 * GitHub-slugger-compatible character removal.
 * Keeps letters, numbers, spaces, `.`, `_`, `/` and `-`; removes punctuation
 * and symbols — matching the regex `github-slugger` applies before replacing
 * spaces with dashes.
 */
const REMOVE_RE = /[^\p{L}\p{N}\s._/-]/gu;

/** Strip inline Markdown markers (`code`, bold/italic, links) for display text. */
function plainHeadingText(raw: string): string {
	return raw
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/[`*_~]/g, '')
		.trim();
}

/** Slug a single heading text the same way github-slugger slugs it. */
export function slugifyHeading(text: string): string {
	return text
		.toLowerCase()
		.replace(REMOVE_RE, '')
		.replace(/ /g, '-');
}

/**
 * Extract top-level H2 headings from a raw Markdown source string.
 * The returned id matches the heading id Astro/Starlight emits.
 */
export function topLevelHeadings(markdown: string): GuideHeading[] {
	const lines = markdown.split(/\r?\n/);
	const out: GuideHeading[] = [];
	const occurrences = new Map<string, number>();
	let inFence = false;

	for (const line of lines) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		const match = line.match(/^##\s+(.+?)\s*$/);
		if (!match) continue;

		const text = plainHeadingText(match[1]);
		if (!text) continue;

		let id = slugifyHeading(text);
		const count = occurrences.get(id) ?? 0;
		if (count > 0) {
			occurrences.set(id, count + 1);
			id = `${id}-${count + 1}`;
		} else {
			occurrences.set(id, 1);
		}
		out.push({ id, text });
	}

	return out.slice(0, MAX_ON_THIS_PAGE);
}
