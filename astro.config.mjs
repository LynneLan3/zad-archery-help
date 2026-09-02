// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import { game } from './src/config/game.ts';
import { sidebarFromCategories } from './src/config/sidebar.ts';
import { categoryHref } from './src/lib/category-url.ts';
import { pageHref } from './src/lib/paths.ts';
import { isNoindexTrustPath } from './src/lib/trust.ts';
import { rehypeAffiliateLinks } from './src/lib/affiliate-link.ts';
import { validateGameConfig } from './src/lib/validate-config.ts';

validateGameConfig(game, process.env.VALIDATE_MODE === 'generated-site' ? 'generated-site' : 'template');

/** @param {string} page */
function isCategoryLandingUrl(page) {
	const path = new URL(page).pathname.replace(/\/+$/, '') || '/';
	return game.categories.some((category) => {
		const href = categoryHref(category.id).replace(/\/+$/, '') || '/';
		return path === href;
	});
}

/** @param {string} page */
function isExcludedFromSitemap(page) {
	if (isCategoryLandingUrl(page)) return true;
	const pathname = new URL(page).pathname;
	const routesPath = new URL(pageHref(game.hubPath, 'routes'), game.siteUrl).pathname;
	if ((game.routes?.length ?? 0) === 0 && pathname === routesPath) return true;
	return isNoindexTrustPath(pathname);
}

// https://astro.build/config
export default defineConfig({
	site: game.siteUrl,
	vite: {
		envPrefix: ['PUBLIC_', 'VERCEL_'],
	},
	integrations: [
		starlight({
			title: game.title ?? game.shortName,
			description: game.description,
			lastUpdated: true,
			...(game.logoImage
				? { logo: { src: `./src/assets/${game.logoImage}`, alt: game.name } }
				: {}),
			customCss: ['./src/styles/custom.css', './src/styles/readiness.css'],
			head: [
				{
					tag: 'style',
					content: `:root { --game-accent: ${game.accentColor}; --game-accent-foreground: ${game.accentForeground ?? '#041012'}; }`,
				},
			],
			sidebar: sidebarFromCategories(),
			components: {
				PageTitle: './src/components/overrides/PageTitle.astro',
				Footer: './src/components/overrides/Footer.astro',
				SiteTitle: './src/components/overrides/SiteTitle.astro',
				Header: './src/components/overrides/Header.astro',
				MarkdownContent: './src/components/overrides/MarkdownContent.astro',
				Head: './src/components/overrides/Head.astro',
				Sidebar: './src/components/overrides/Sidebar.astro',
				PageSidebar: './src/components/overrides/PageSidebar.astro',
				PageFrame: './src/components/overrides/PageFrame.astro',
				TwoColumnContent: './src/components/overrides/TwoColumnContent.astro',
			},
		}),
		sitemap({
			filter: (page) => !isExcludedFromSitemap(page),
		}),
	],
	markdown: {
		rehypePlugins: [rehypeAffiliateLinks],
	},
});
