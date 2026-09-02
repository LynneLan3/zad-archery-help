/**
 * Route (player-facing path) URL + reverse-lookup helpers.
 *
 * Routes are distinct from Categories:
 * - Category = backend organization / fallback browse / sidebar.
 * - Route = player frontend task path, `/{hubPath}/routes/{route.id}/`.
 *
 * Route membership lives only in `routes[].pages`. To find which routes a page
 * belongs to, compute it at runtime with `findRoutesForPage` — never persist
 * memberships back onto the page.
 */
import type { GameRoute } from '../config/game-types';
import { normalizeHubPath, PathConfigError } from './paths';

/**
 * Route landing href: `/{hubPath}/routes/{routeId}/`.
 * Examples: `/example-game/routes/getting-started/`, `/routes/getting-started/` (root hub).
 */
export function routeHref(hubPath: string, routeId: string): string {
	const id = routeId.replace(/^\/+|\/+$/g, '');
	if (!id || id.includes('/')) {
		throw new PathConfigError(
			'route id must be a single path segment.',
			'game.routes[].id',
			routeId,
			'Use kebab-case ids like getting-started, not nested paths.',
		);
	}
	const hub = normalizeHubPath(hubPath);
	return hub === '/' ? `/routes/${id}/` : `${hub}routes/${id}/`;
}

/**
 * All routes that contain `pageId`, in route config order.
 * Returns a new array — never writes memberships onto the page data.
 */
export function findRoutesForPage(pageId: string, routes: readonly GameRoute[]): GameRoute[] {
	return routes.filter((route) => route.pages.some((page) => page.pageId === pageId));
}
