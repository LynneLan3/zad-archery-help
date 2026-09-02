import { game } from '../config/game';
import type { GameTrustPageConfig } from '../config/game-types';
import { canonicalizePath, pageHref } from './paths';

export const CORE_TRUST_PAGE_KINDS = ['about', 'editorialMethod', 'privacy'] as const;
export const TRUST_PAGE_KINDS = [...CORE_TRUST_PAGE_KINDS, 'affiliateDisclosure'] as const;
export type CoreTrustPageKind = (typeof CORE_TRUST_PAGE_KINDS)[number];
export type TrustPageKind = (typeof TRUST_PAGE_KINDS)[number];

export const TRUST_PAGE_SLUGS: Record<TrustPageKind, string> = {
	about: 'about',
	editorialMethod: 'editorial-method',
	privacy: 'privacy',
	affiliateDisclosure: 'affiliate-disclosure',
};

export type EnabledTrustPage = GameTrustPageConfig & { kind: TrustPageKind };

export function trustTitleForLocale(kind: TrustPageKind, locale: string | undefined): string {
	const resolved = locale === 'zh-CN' ? 'zh-CN' : 'en';
	const titles: Record<TrustPageKind, Record<'en' | 'zh-CN', string>> = {
		about: { en: 'About', 'zh-CN': '关于本站' },
		editorialMethod: { en: 'Editorial Method', 'zh-CN': '内容方法' },
		privacy: { en: 'Privacy', 'zh-CN': '隐私说明' },
		affiliateDisclosure: { en: 'Affiliate Disclosure', 'zh-CN': '联盟披露' },
	};
	return titles[kind][resolved];
}

export function trustDescriptionForLocale(
	kind: TrustPageKind,
	locale: string | undefined,
	gameName: string,
): string {
	const resolved = locale === 'zh-CN' ? 'zh-CN' : 'en';
	const descriptions: Record<TrustPageKind, Record<'en' | 'zh-CN', string>> = {
		about: {
			en: `What ${gameName} Guide & Wiki is and how this independent resource site is meant to be used.`,
			'zh-CN': `${gameName} 攻略 Wiki 的定位，以及本独立资料站的用途说明。`,
		},
		editorialMethod: {
			en: `How ${gameName} guide pages are researched, reviewed, and updated on this site.`,
			'zh-CN': `本站的 ${gameName} 攻略内容如何取材、核对与更新。`,
		},
		privacy: {
			en: `Starter privacy copy for ${gameName} Guide & Wiki. Update before adding analytics, ads, or affiliate links.`,
			'zh-CN': `${gameName} 攻略 Wiki 的 starter 隐私说明。接入统计、广告或 Affiliate 前请按实际用途修改。`,
		},
		affiliateDisclosure: {
			en: `Starter affiliate disclosure for ${gameName} Guide & Wiki. Replace before enabling real affiliate links.`,
			'zh-CN': `${gameName} 攻略 Wiki 的联盟披露 starter 文案。启用真实联盟链接前请替换。`,
		},
	};
	return descriptions[kind][resolved];
}

export function trustRobotsForKind(kind: TrustPageKind): 'index,follow' | 'noindex,follow' {
	return kind === 'privacy' || kind === 'affiliateDisclosure' ? 'noindex,follow' : 'index,follow';
}

/** Public href for a trust page under the current hubPath. */
export function trustHref(kind: TrustPageKind): string {
	return pageHref(game.hubPath, TRUST_PAGE_SLUGS[kind]);
}

/** Rest-route param segment(s) for `[...categoryLanding].astro`. */
export function trustPageParam(kind: TrustPageKind): string {
	return trustHref(kind).replace(/^\/+|\/+$/g, '');
}

export function enabledTrustPages(): EnabledTrustPage[] {
	if (!game.trust?.enabled) return [];
	return TRUST_PAGE_KINDS.flatMap((kind) => {
		const page = game.trust!.pages[kind];
		if (!page?.enabled) return [];
		return [{ kind, ...page }];
	});
}

export function resolveTrustPageKind(pathname: string): TrustPageKind | undefined {
	if (!game.trust?.enabled) return undefined;
	const path = canonicalizePath(pathname);
	for (const kind of TRUST_PAGE_KINDS) {
		const page = game.trust.pages[kind];
		if (!page?.enabled) continue;
		if (canonicalizePath(page.path) === path) return kind;
	}
	return undefined;
}

export function isTrustPath(pathname: string): boolean {
	return resolveTrustPageKind(pathname) !== undefined;
}

export function isPrivacyTrustPath(pathname: string): boolean {
	return resolveTrustPageKind(pathname) === 'privacy';
}

export function isNoindexTrustPath(pathname: string): boolean {
	const kind = resolveTrustPageKind(pathname);
	return kind === 'privacy' || kind === 'affiliateDisclosure';
}
