import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { SiteSpec, SiteSpecAsset } from './site-spec';
import { resolveInputPath, SpecValidationError } from './site-spec';

export const ASSET_USAGES = ['homepageHero', 'guideCard', 'articleHero', 'inlineMedia'] as const;
export type AssetUsage = (typeof ASSET_USAGES)[number];

export interface IntrinsicAssetMetadata {
	width: number;
	height: number;
	aspectRatio: number;
	fileSize: number;
}

export interface AssetManifestEntry extends IntrinsicAssetMetadata {
	assetId: string;
	source: string;
	localPath: string;
	usage: AssetUsage[];
}

function failAsset(code: string, asset: SiteSpecAsset, detail: string): never {
	throw new SpecValidationError(`${code}: ${detail}`, `assets[id=${asset.id}]`, asset.id, `assets[id=${asset.id}]`, 'Provide a source image that satisfies its declared usage contract.');
}

function svgDimensions(buffer: Buffer): { width: number; height: number } | undefined {
	const text = buffer.toString('utf8', 0, Math.min(buffer.length, 8192));
	const viewBox = text.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
	const width = text.match(/\bwidth\s*=\s*["']\s*([\d.]+)/i)?.[1];
	const height = text.match(/\bheight\s*=\s*["']\s*([\d.]+)/i)?.[1];
	if (viewBox) return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
	if (width && height) return { width: Number(width), height: Number(height) };
	return undefined;
}

function intrinsicDimensions(filePath: string): IntrinsicAssetMetadata {
	const buffer = readFileSync(filePath);
	const ext = path.extname(filePath).toLowerCase();
	let dimensions: { width: number; height: number } | undefined;
	if (ext === '.svg') dimensions = svgDimensions(buffer);
	else if (ext === '.png' && buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) dimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
	else if (ext === '.webp' && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
		if (buffer.toString('ascii', 12, 16) === 'VP8X' && buffer.length >= 30) dimensions = { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
	}
	else if (ext === '.jpg' || ext === '.jpeg') {
		let offset = 2;
		while (offset + 9 < buffer.length) {
			if (buffer[offset] !== 0xff) { offset += 1; continue; }
			const marker = buffer[offset + 1]!;
			const length = buffer.readUInt16BE(offset + 2);
			if (marker >= 0xc0 && marker <= 0xc3) { dimensions = { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }; break; }
			offset += 2 + length;
		}
	}
	if (!dimensions || !Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height) || dimensions.width <= 0 || dimensions.height <= 0) {
		throw new Error(`Unable to read intrinsic dimensions for ${filePath}.`);
	}
	return { ...dimensions, aspectRatio: Number((dimensions.width / dimensions.height).toFixed(4)), fileSize: statSync(filePath).size };
}

function usagesForAsset(spec: SiteSpec, assetId: string): AssetUsage[] {
	const usages = new Set<AssetUsage>();
	if (spec.theme.heroAssetId === assetId) usages.add('homepageHero');
	for (const page of spec.pages) {
		if (page.coverAssetId === assetId) { usages.add('articleHero'); usages.add('guideCard'); }
		if (page.cardImageAssetId === assetId) usages.add('guideCard');
		if (page.evidence.some((item) => item.asset === spec.assets.find((asset) => asset.id === assetId)?.target)) usages.add('inlineMedia');
	}
	if (spec.homepage.evidence?.items.some((item) => item.assetId === assetId)) usages.add('inlineMedia');
	return [...usages];
}

export function validateAssetUsage(asset: SiteSpecAsset, metadata: IntrinsicAssetMetadata, usages: AssetUsage[]): void {
	for (const usage of usages) {
		if ((usage === 'homepageHero' && metadata.width < 1600) || (usage === 'articleHero' && metadata.width < 1200) || (usage === 'guideCard' && metadata.width < 800)) {
			failAsset(usage === 'homepageHero' ? 'HERO_ASSET_TOO_SMALL' : usage === 'guideCard' ? 'GUIDE_CARD_ASSET_TOO_SMALL' : 'ARTICLE_HERO_ASSET_TOO_SMALL', asset, `${metadata.width}x${metadata.height} is below the ${usage} minimum.`);
		}
		if ((usage === 'homepageHero' || usage === 'articleHero') && (metadata.aspectRatio < 1.45 || metadata.aspectRatio > 2.25)) failAsset('ASSET_ASPECT_INVALID', asset, `${metadata.aspectRatio} is outside the wide-image range.`);
		if (usage === 'guideCard' && Math.abs(metadata.aspectRatio - 16 / 9) > 0.35) failAsset('ASSET_ASPECT_INVALID', asset, `${metadata.aspectRatio} is not compatible with the 16:9 card slot.`);
	}
}

export function assetRenderWidth(usage: AssetUsage): number {
	return usage === 'homepageHero' ? 1920 : usage === 'articleHero' ? 1280 : usage === 'guideCard' ? 800 : 0;
}

export function assertNoAssetUpscale(asset: SiteSpecAsset, metadata: IntrinsicAssetMetadata, usages: AssetUsage[]): void {
	for (const usage of usages) {
		const renderWidth = assetRenderWidth(usage);
		if (renderWidth > 0 && metadata.width < renderWidth) {
			failAsset('ASSET_UPSCALE_REQUIRED', asset, `${usage} renders at up to ${renderWidth}px but the intrinsic source is only ${metadata.width}px wide.`);
		}
	}
}

export function buildAssetManifest(spec: SiteSpec, rootDir: string, specDir: string): AssetManifestEntry[] {
	return spec.assets.map((asset) => {
		const sourcePath = resolveInputPath(rootDir, specDir, asset.source);
		if (!existsSync(sourcePath)) failAsset('ASSET_SOURCE_MISSING', asset, asset.source);
		const metadata = intrinsicDimensions(sourcePath);
		const usage = usagesForAsset(spec, asset.id);
		validateAssetUsage(asset, metadata, usage);
		return { assetId: asset.id, source: asset.source, localPath: `src/assets/${asset.target}`, ...metadata, usage };
	});
}
