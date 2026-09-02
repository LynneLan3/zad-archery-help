/**
 * Experience layout detection for Starlight shell overrides.
 *
 * Two experience variants exist:
 * - Experience Homepage — the Hub splash entry (`template: 'splash'`) at
 *   `/{hubPath}/` renders `ExperienceHomepage` inside the GameShell chrome.
 * - Experience Guide — Guide content pages (Markdown entries rendered by the
 *   Starlight docs route) render the Experience editorial layout.
 *
 * Everything else (Category Landings, Trust pages, 404, fallback docs) keeps
 * the default Starlight shell.
 *
 * Judgment basis (no new schema fields):
 * - `template: 'splash'`              → Experience Homepage.
 * - entry id containing 404           → error page, keep Starlight shell.
 * - path matches a Category Landing   → keep Starlight fallback UI.
 * - path matches a Trust page         → keep Starlight fallback UI.
 * - anything else                     → Guide content page → Experience layout.
 *
 * Category Landings and Trust pages are rendered through `StarlightPage` which
 * also composes the overridable shell components, so they MUST be excluded by
 * pathname here — `template` alone cannot distinguish them from guides.
 */

import { isCategoryLandingPath } from './category-url';
import { isTrustPath } from './trust';

interface GuideEntryLike {
	id: string;
	data: { template?: string };
}

/** Hub homepage (`/` or `/{hubPath}/`) rendered from the splash entry. */
export function isExperienceHomepage(entry: GuideEntryLike): boolean {
	return entry.data.template === 'splash';
}

export function isExperienceGuide(entry: GuideEntryLike, pathname: string): boolean {
	if (isExperienceHomepage(entry)) return false;
	if (entry.id === '404' || entry.id.endsWith('/404')) return false;
	if (isCategoryLandingPath(pathname)) return false;
	if (isTrustPath(pathname)) return false;
	return true;
}
