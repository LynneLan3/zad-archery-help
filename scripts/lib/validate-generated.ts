import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { SiteValidationError } from '../../src/lib/validate-config';
import { CORE_TRUST_PAGE_KINDS, TRUST_PAGE_SLUGS } from '../../src/lib/trust';
import { buildPlan, checkPlan } from './generator';
import { findOrphanPages, formatOrphanWarning } from './link-graph';
import { manifestPath, readManifest } from './managed-files';
import { isAffiliateDisclosureEnabled, loadSiteSpec, MANIFEST_FILENAME, readTemplateVersion, SpecValidationError } from './site-spec';
import { rendererForPageType } from '../../src/lib/page-types';

function walkFiles(dir: string, extensions: Set<string>, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			walkFiles(full, extensions, out);
			continue;
		}
		if (extensions.has(path.extname(entry).toLowerCase())) out.push(full);
	}
	return out;
}

function toError(error: SpecValidationError): SiteValidationError {
	return new SiteValidationError(error.message.split('\n')[0]!, error.field, error.value, error.location, error.hint);
}

function rawTitle(filePath: string): string {
	const raw = readFileSync(filePath, 'utf8');
	const match = raw.match(/^title:\s*(.+)$/m);
	return match?.[1]?.replace(/^['"]|['"]$/g, '') ?? '';
}

function requireContractFile(rootDir: string, relativePath: string, patterns: RegExp[], message: string): void {
	const filePath = path.join(rootDir, relativePath);
	const raw = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
	if (!raw || patterns.some((pattern) => !pattern.test(raw))) {
		throw new SiteValidationError(message, 'renderer-contract', relativePath, relativePath, 'Restore the shared V2.1 component contract.');
	}
}

export function validateRendererContracts(rootDir: string): void {
	requireContractFile(rootDir, 'src/components/GuideGrid.astro', [/GuideCard/], 'Guide Library must render through GuideGrid and GuideCard.');
	requireContractFile(rootDir, 'src/components/GuideCard.astro', [/<a\b/, /gw-card/], 'GuideCard must be a full-card link.');
	requireContractFile(rootDir, 'src/lib/experience-nav.ts', [/primaryNav/, /return/], 'Primary navigation must come from the shared experience navigation config.');
	requireContractFile(rootDir, 'src/components/overrides/Header.astro', [/GameShellTopbar/, /Every route uses the same shell/], 'All routes must use the unified GameShellTopbar shell.');

	for (const page of (loadSiteSpec(path.join(rootDir, 'site-spec.yaml'), rootDir)).spec.pages) {
		try {
			rendererForPageType(page.pageType);
		} catch {
			throw new SiteValidationError('Unknown pageType has no registered renderer.', 'pageType', page.pageType, 'site-spec.yaml', 'Use one of the registered V2.1 page types.');
		}
		if (page.sections.length >= 3) {
			const generated = path.join(rootDir, 'src/content/docs', page.category, `${page.slug}.md`);
			const raw = existsSync(generated) ? readFileSync(generated, 'utf8') : '';
			if (!/^sections:\s*$/m.test(raw)) {
				throw new SiteValidationError('Articles with three or more sections must declare structured sections for TOC generation.', 'sections', page.sections, path.relative(rootDir, generated), 'Add typed sections to the site spec and regenerate.');
			}
		}
	}
}

export function validateGeneratedHtml(rootDir: string): void {
	const generatedConfig = path.join(rootDir, 'src/config/site.generated.ts');
	const configRaw = existsSync(generatedConfig) ? readFileSync(generatedConfig, 'utf8') : '';
	if (!/runtimeCompatibility:\s*\{/.test(configRaw) || !/fingerprint:/.test(configRaw)) {
		throw new SiteValidationError('RUNTIME_COMPATIBLE: generated config has no runtime compatibility fingerprint.', 'runtimeCompatibility', undefined, 'src/config/site.generated.ts', 'Regenerate with a V2.1-compatible starter.');
	}
	if (!/generatorContract:\s*['"]2\.1\./.test(configRaw) || !/articleContract:\s*['"]2\.1\./.test(configRaw)) {
		throw new SiteValidationError('TEMPLATE_VERSION_MATCH: generated runtime contract is not the required V2.1 version.', 'runtimeCompatibility', undefined, 'src/config/site.generated.ts', 'Regenerate with the current template runtime.');
	}
	const cssFiles = walkFiles(path.join(rootDir, 'dist'), new Set(['.css']));
	const css = cssFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
	if (!/exp-home-hero__visual[^}]*aspect-ratio/i.test(css) || !/exp-home-hero__visual img[^}]*object-fit:\s*cover/i.test(css)) {
		throw new SiteValidationError('HERO_ASSET_DIMENSION_VALID: homepage hero has no bounded crop contract.', 'hero', undefined, 'dist', 'Use the shared homepage hero renderer.');
	}
	if (!/gw-media--hero[^}]*aspect-ratio/i.test(css) || !/gw-media--hero img[^}]*object-fit:\s*cover/i.test(css)) {
		throw new SiteValidationError('ARTICLE_MEDIA_BOUNDS_VALID: article hero has no fixed media bounds.', 'articleHero', undefined, 'dist', 'Use the shared MediaFigure hero renderer.');
	}
	if (!/exp-mobile-contents[^}]*position:\s*sticky/i.test(css)) {
		throw new SiteValidationError('MOBILE_TOC_CONTRACT_VALID: mobile TOC may obscure article content.', 'toc', undefined, 'dist', 'Use the shared non-overlay mobile TOC contract.');
	}
	if (!/exp-mobile-contents summary[^}]*padding:/i.test(css) || !/min-height:\s*3rem|height:\s*3rem/i.test(css)) {
		throw new SiteValidationError('MOBILE_CLICK_TARGET_CONTRACT_VALID: mobile navigation target is below the 48px contract.', 'click-target', undefined, 'dist', 'Keep mobile controls at least 48px tall.');
	}
	if (!/overflow-x:\s*(?:hidden|clip)/i.test(css)) {
		throw new SiteValidationError('MOBILE_NO_GLOBAL_HORIZONTAL_OVERFLOW: global overflow guard is missing.', 'overflow', undefined, 'dist', 'Add the shared mobile overflow contract.');
	}
	const htmlFiles = walkFiles(path.join(rootDir, 'dist'), new Set(['.html']));
	for (const file of htmlFiles) {
		const raw = readFileSync(file, 'utf8');
		const h1Count = raw.match(/<h1\b/gi)?.length ?? 0;
		const isGeneratedContentPage = path.basename(file) !== '404.html' && (raw.includes('exp-home-hero') || raw.includes('exp-guide-prose') || raw.includes('exp-index-hero'));
		if (isGeneratedContentPage && h1Count > 1) {
			throw new SiteValidationError('H1_OWNERSHIP: generated page contains multiple H1 elements.', 'h1', h1Count, path.relative(rootDir, file), 'The article renderer owns the only H1.');
		}
		if (raw.includes('data-exp-guide-article') && raw.includes('data-exp-section-anchor')) {
			const sectionCount = raw.match(/data-exp-section-anchor/g)?.length ?? 0;
			if (sectionCount >= 3 && !raw.includes('exp-guide-toc')) {
				throw new SiteValidationError('MOBILE_TOC_CONTRACT_VALID: article with three or more sections is missing the generated TOC.', 'toc', sectionCount, path.relative(rootDir, file), 'Use the shared structured section model.');
			}
		}
		const assetTags = [...raw.matchAll(/<img\b[^>]*data-asset-width="(\d+)"[^>]*data-asset-height="(\d+)"[^>]*data-asset-usage="([^"]+)"[^>]*>/g)];
		for (const match of assetTags) {
			const width = Number(match[1]);
			const usage = match[3];
			if ((usage === 'homepageHero' && width < 1600) || (usage === 'guideCard' && width < 800) || (usage === 'articleHero' && width < 1200)) {
				const code = usage === 'homepageHero' ? 'HERO_ASSET_DIMENSION_VALID' : usage === 'guideCard' ? 'GUIDE_MEDIA_DIMENSION_VALID' : 'ARTICLE_MEDIA_BOUNDS_VALID';
				throw new SiteValidationError(code, 'asset', width, path.relative(rootDir, file), 'Use an intrinsically large enough source image.');
			}
			const renderedWidth = Number(match[0].match(/\bwidth="(\d+)"/)?.[1] ?? 0);
			if (renderedWidth > width) throw new SiteValidationError('NO_ASSET_UPSCALE: generated image width exceeds intrinsic source width.', 'asset', renderedWidth, path.relative(rootDir, file), 'Do not upscale source media.');
		}
		if (raw.includes('data-media-bounds="fixed"') && !raw.includes('gw-media--hero')) {
			throw new SiteValidationError('ARTICLE_MEDIA_BOUNDS_VALID: media bounds marker is detached from the shared article media renderer.', 'articleHero', undefined, path.relative(rootDir, file), 'Use MediaFigure for article media.');
		}
	}
}

export function reportOrphanPageWarnings(spec: import('./site-spec').SiteSpec): void {
	for (const page of findOrphanPages(spec)) {
		console.warn(`validate:site warning: ${formatOrphanWarning(page)}`);
	}
}

export function validateGeneratedSiteExtras(rootDir: string): void {
	const specPath = path.join(rootDir, 'site-spec.yaml');
	if (!existsSync(specPath)) {
		throw new SiteValidationError(
			'generated-site mode requires site-spec.yaml at the repository root.',
			'site-spec.yaml',
			undefined,
			'site-spec.yaml',
			'Create site-spec.yaml and run npm run site:generate.',
		);
	}

	let loaded;
	try {
		loaded = loadSiteSpec(specPath, rootDir);
	} catch (error) {
		if (error instanceof SpecValidationError) throw toError(error);
		throw error;
	}

	const templateVersion = readTemplateVersion(rootDir);
	if (loaded.spec.templateVersion !== templateVersion) {
		throw new SiteValidationError(
			'templateVersion is incompatible with TEMPLATE_VERSION.',
			'templateVersion',
			loaded.spec.templateVersion,
			'site-spec.yaml',
			`Set templateVersion to ${templateVersion}.`,
		);
	}

	if (!existsSync(manifestPath(rootDir))) {
		throw new SiteValidationError(
			'Managed-files manifest is missing.',
			MANIFEST_FILENAME,
			undefined,
			MANIFEST_FILENAME,
			'Run npm run site:generate to create .site-generator-manifest.json.',
		);
	}

	const manifest = readManifest(rootDir);
	if (!manifest) {
		throw new SiteValidationError(
			'Managed-files manifest could not be read.',
			MANIFEST_FILENAME,
			undefined,
			MANIFEST_FILENAME,
			'Repair or regenerate .site-generator-manifest.json.',
		);
	}
	if (manifest.specHash !== loaded.specHash) {
		throw new SiteValidationError(
			'Manifest specHash does not match site-spec.yaml.',
			'specHash',
			manifest.specHash,
			MANIFEST_FILENAME,
			'Re-run npm run site:generate after changing site-spec.yaml.',
		);
	}

	let plan;
	try {
		plan = buildPlan(loaded);
	} catch (error) {
		if (error instanceof SpecValidationError) throw toError(error);
		throw error;
	}
	const check = checkPlan(loaded, plan);
	if (!check.ok) {
		throw new SiteValidationError(
			'Managed generated files drifted from site-spec.yaml.',
			'managed-files',
			check.drift.join(', '),
			check.drift[0] ?? MANIFEST_FILENAME,
			'Do not hand-edit generated files. Re-run npm run site:generate or restore the drifted files.',
		);
	}
	validateRendererContracts(rootDir);

	const docsDir = path.join(rootDir, 'src/content/docs');
	const docs = walkFiles(docsDir, new Set(['.md', '.mdx']));
	for (const file of docs) {
		const raw = readFileSync(file, 'utf8');
		if (/\{\{page:[^}]+\}\}/.test(raw) || /\{\{hub\}\}/.test(raw)) {
			throw new SiteValidationError(
				'Unresolved generator placeholders found in content.',
				'placeholder',
				raw.match(/\{\{(?:page:[^}]+|hub)\}\}/)?.[0],
				path.relative(rootDir, file),
				'Re-run the generator; placeholders must be resolved before shipping.',
			);
		}
	}

	const expectedPageFiles = new Set(
		loaded.spec.pages.map((page) =>
			path.join('src/content/docs', page.category, `${page.slug}.md`).replace(/\\/g, '/'),
		),
	);
	expectedPageFiles.add('src/content/docs/index.mdx');

	for (const file of docs) {
		const rel = path.relative(rootDir, file).replace(/\\/g, '/');
		if (expectedPageFiles.has(rel)) continue;
		const title = rawTitle(file);
		if (/example-/i.test(path.basename(rel)) || /example game/i.test(title)) {
			throw new SiteValidationError(
				'Demo Example Game page remains in a generated site.',
				'content',
				rel,
				rel,
				'Remove leftover demo pages or regenerate from site-spec.yaml.',
			);
		}
		if (!manifest.managedFiles.some((entry) => entry.path === rel)) {
			throw new SiteValidationError(
				'Found a guide page that is not part of the current site-spec.',
				'content',
				rel,
				rel,
				'Delete the unexpected page or declare it in site-spec.yaml and regenerate.',
			);
		}
	}

	const trustDir = path.join(rootDir, 'src/content/trust');
	const trustFiles = walkFiles(trustDir, new Set(['.md', '.mdx']));
	const expectedTrustFiles = new Set<string>();
	if (loaded.spec.trust?.enabled) {
		for (const kind of CORE_TRUST_PAGE_KINDS) {
			const page = loaded.spec.trust[kind];
			if (!page?.enabled) continue;
			expectedTrustFiles.add(`src/content/trust/${TRUST_PAGE_SLUGS[kind]}.md`);
		}
	}
	if (isAffiliateDisclosureEnabled(loaded.spec)) {
		expectedTrustFiles.add(`src/content/trust/${TRUST_PAGE_SLUGS.affiliateDisclosure}.md`);
	}
	for (const file of trustFiles) {
		const rel = path.relative(rootDir, file).replace(/\\/g, '/');
		if (rel.endsWith('/.gitkeep')) continue;
		if (expectedTrustFiles.has(rel)) continue;
		if (!manifest.managedFiles.some((entry) => entry.path === rel)) {
			throw new SiteValidationError(
				'Found a trust page that is not part of the current site-spec.',
				'content',
				rel,
				rel,
				'Delete the unexpected trust page or disable it in site-spec.yaml and regenerate.',
			);
		}
	}

	reportOrphanPageWarnings(loaded.spec);
}
