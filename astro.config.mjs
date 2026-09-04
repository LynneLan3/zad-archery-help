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
import { loadEnv } from 'vite';

/**
 * G027 V4 GA4 runtime — presentation-independent.
 * Injected via Astro config so V4→V5 UI page swaps do not drop analytics.
 * Sole input: PUBLIC_GA_MEASUREMENT_ID (Registry Measurement ID).
 * No Measurement ID → no script injection; builds remain valid.
 * @returns {import('astro').AstroIntegration}
 */
function gwGa4Runtime() {
	return {
		name: 'gw-ga4-runtime',
		hooks: {
			'astro:config:setup'(options) {
				const { injectScript, command } = options;
				const env = { ...loadEnv(process.env.NODE_ENV ?? '', process.cwd(), ''), ...process.env };
				const measurementId = String(env.PUBLIC_GA_MEASUREMENT_ID || '').trim();
				if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
				if (command === 'dev') return;
				const vercelEnv = String(env.VERCEL_ENV || '').trim();
				if (vercelEnv && vercelEnv !== 'production') return;
				const idLiteral = JSON.stringify(measurementId);
				injectScript(
					'head-inline',
					`(function(){if(window.__gwGa4Bootstrapped)return;window.__gwGa4Bootstrapped=true;var measurementId=${idLiteral};window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};if(!document.querySelector('script[data-gw-ga4-bootstrap]')){var s=document.createElement('script');s.async=true;s.dataset.gwGa4Bootstrap='true';s.src='https://www.googletagmanager.com/gtag/js?id='+measurementId;document.head.appendChild(s);}window.gtag('js',new Date());window.gtag('config',measurementId);document.addEventListener('click',function(event){var target=event.target;if(!target||!target.closest)return;var anchor=target.closest('a[href]');if(!anchor)return;var href=anchor.href||'';if(!href||href.indexOf(location.origin)===0)return;if(typeof window.gtag!=='function')return;window.gtag('event','outbound_click',{link_url:href,link_domain:(function(){try{return new URL(href).hostname;}catch(e){return'';}})(),link_text:(anchor.textContent||'').trim().slice(0,100),transport_type:'beacon'});},true);})();`,
				);
			},
		},
	};
}

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
		gwGa4Runtime(),
	],
	markdown: {
		rehypePlugins: [rehypeAffiliateLinks],
	},
});
