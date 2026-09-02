/**
 * This file is generated from site-spec.yaml.
 * Do not edit directly.
 * Run npm run site:generate instead.
 */
import type { GameConfig } from './game-types';

export const siteConfig: GameConfig = {
	presentationVersion: 3,
	name: "Zad Archery",
	shortName: "Zad Archery",
	title: "Zad Archery Help",
	description: "Verified guides for Zad Archery progression, platforms, achievements and launch updates.",
	tagline: "Every arrow, answered.",
	siteUrl: "https://zadarchery.help",
	siteMode: "standalone",
	hubPath: "/",
	hubTitle: "Zad Archery Help",
	locale: "en",
	releaseStatus: "released",
	releaseDate: "2026-09-01",
	developer: "Samharia Studios",
	publisher: "Samharia Studios",
	platforms: ["Windows", "macOS", "Linux", "Steam Deck", "iOS", "Android"],
	assets: [
		{
			assetId: "zad-hero",
			source: "public/zad-archery/10_steam_library_hero.jpg",
			localPath: "src/assets/zad-archery/hero.jpg",
			width: 3840,
			height: 1240,
			aspectRatio: 3.0968,
			fileSize: 1019813,
			usage: [],
		},
	],
	runtimeCompatibility: {
		generatorContract: "2.1.0",
		experienceRenderer: "2.1.0",
		pageSchema: "2.1.0",
		navigationShell: "2.1.0",
		guideLibrary: "2.1.0",
		articleContract: "2.1.0",
		fingerprint: "generatorContract=2.1.0|experienceRenderer=2.1.0|pageSchema=2.1.0|navigationShell=2.1.0|guideLibrary=2.1.0|articleContract=2.1.0",
	},
	accentColor: "#d49a22",
	accentForeground: "#23170d",
	heroAlt: "Zad Archery",
	heroPosition: "center",
	disclaimer: "Independent fan guide for Zad Archery.",
	portal: {
		showRecentlyUpdated: true,
		maxRecent: 3,
	},
	categories: [
		{
			id: "guides",
			label: "Guides",
			description: "Verified Zad Archery answers.",
			icon: "information",
			order: 1,
		},
	],
	pages: [
		{
			id: "zad-archery-guide-index",
			pageType: "how-to",
			sections: [
				{ id: "scope", title: "Guide scope" },
			],
			slug: "zad-archery-guide-index",
			role: "core",
			assetType: "article",
			intents: ["getting-started"],
			relations: [
			],
			sources: [
			],
			evidence: [
			],
		},
	],
};
