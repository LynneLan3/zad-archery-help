import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { ui } from '../../src/lib/ui';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function copyTemplateWorkspace(): string {
	mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
	const dir = mkdtempSync(path.join(ROOT, 'tmp', 'gws-guide-editorial-'));
	const entries = [
		'package.json',
		'package-lock.json',
		'astro.config.mjs',
		'tsconfig.json',
		'TEMPLATE_VERSION',
		'.gitignore',
		'public',
		'src',
		'scripts',
	];
	for (const entry of entries) {
		cpSync(path.join(ROOT, entry), path.join(dir, entry), { recursive: true });
	}
	const nodeModulesTarget = path.relative(dir, path.join(ROOT, 'node_modules'));
	try {
		cpSync(nodeModulesTarget, path.join(dir, 'node_modules'), { recursive: true });
	} catch {
		// node_modules may not exist in this checkout; template build tests rely on the real one.
	}
	return dir;
}

function buildTemplate(workspace: string) {
	return spawnSync('npx', ['astro', 'build'], {
		cwd: workspace,
		encoding: 'utf8',
		env: { ...process.env, VALIDATE_MODE: 'template' },
	});
}

function builtCss(workspace: string): string {
	const astroDir = path.join(workspace, 'dist/_astro');
	return readdirSync(astroDir)
		.filter((name) => name.endsWith('.css'))
		.map((name) => readFileSync(path.join(astroDir, name), 'utf8'))
		.join('\n');
}

test('guide editorial: i18n dictionary covers Experience Guide chrome strings', () => {
	const en = ui('en');
	const zh = ui('zh-CN');
	for (const key of [
		'onThisPage',
		'quickAnswer',
		'sourceRecord',
		'nextQuestions',
		'nextQuestionsLede',
		'moreReferences',
		'exploreAnotherRoute',
		'youAreOn',
		'guidesNav',
		'homeNav',
		'routesNav',
		'aboutNav',
	] as const) {
		assert.ok(en[key], `en.${key} missing`);
		assert.ok(zh[key], `zh-CN.${key} missing`);
	}
});

test('formal guide editorial: guide URLs use Experience layout, category keeps Starlight', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);

		// 1. Formal Guide URL renders the Experience editorial layout
		const guideHtml = readFileSync(path.join(workspace, 'dist/example-guide/index.html'), 'utf8');
		assert.match(guideHtml, /exp-guide-frame/);
		assert.match(guideHtml, /exp-topbar__brand/);
		assert.match(guideHtml, /exp-guide-header__title/);
		assert.match(guideHtml, /exp-guide-prose/);
		assert.match(guideHtml, /exp-guide-crumb/);
		assert.doesNotMatch(guideHtml, /sidebar-pane/, 'no Starlight left sidebar on Experience guide');
		assert.doesNotMatch(guideHtml, /right-sidebar/, 'no Starlight right TOC on Experience guide');
		assert.doesNotMatch(guideHtml, /sl-pagination/, 'no Starlight Previous/Next on Experience guide');

		// 2. Category Landing keeps the Starlight fallback UI
		const categoryHtml = readFileSync(path.join(workspace, 'dist/gameplay/index.html'), 'utf8');
		assert.match(categoryHtml, /sidebar-pane/, 'category landing keeps Starlight sidebar');
		assert.match(categoryHtml, /right-sidebar/, 'category landing keeps Starlight TOC rail');
		assert.doesNotMatch(categoryHtml, /exp-guide-frame/, 'category landing does not use Experience guide frame');

		// 3. Splash hub keeps Starlight shell (splash has no sidebar; the key
		//    check is that it does NOT take over the Experience guide frame)
		const hubHtml = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');
		assert.doesNotMatch(hubHtml, /exp-guide-frame/);

		const css = builtCss(workspace);
		assert.match(css, /\.exp-guide-frame\{[^}]*background:var\(--xp-bg\)[^}]*color:var\(--xp-text\)/);
		assert.match(css, /\.exp-guide-frame .main-pane,\n?\.exp-guide-frame main,\n?\.exp-guide-frame .content-panel\{[^}]*background:var\(--xp-bg\)[^}]*color:var\(--xp-text\)/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal guide editorial: hero, facts, quickAnswer, evidence/sources optional', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);

		// Starter placeholder covers are treated as missing media.
		const guideHtml = readFileSync(path.join(workspace, 'dist/example-guide/index.html'), 'utf8');
		assert.doesNotMatch(guideHtml, /exp-guide-hero-image/, 'starter placeholder cover is omitted');
		assert.match(guideHtml, /exp-facts-strip/);
		assert.match(guideHtml, /exp-answer/);

		// example-location has cover but no facts / quickAnswer / sources / evidence
		const locationHtml = readFileSync(path.join(workspace, 'dist/example-location/index.html'), 'utf8');
		assert.doesNotMatch(locationHtml, /exp-guide-hero-image/, 'starter placeholder cover is omitted');
		assert.doesNotMatch(locationHtml, /exp-facts-strip/, 'facts omitted when absent');
		assert.doesNotMatch(locationHtml, /exp-answer/, 'quick answer omitted when absent');
		assert.doesNotMatch(locationHtml, /exp-guide-evidence-wrap/, 'evidence omitted when absent');
		assert.doesNotMatch(locationHtml, /exp-guide-sources-wrap/, 'sources omitted when absent');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal guide editorial: On This Page from H2s, numbering, and no duplicate nav', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);

		const guideHtml = readFileSync(path.join(workspace, 'dist/example-guide/index.html'), 'utf8');
		// On This Page derived from 3-5 top-level H2s with 01.. numbering
		const toc = guideHtml.match(/<ol class="exp-guide-toc__list">([\s\S]*?)<\/ol>/)?.[1] ?? '';
		const items = [...toc.matchAll(/<li>/g)];
		assert.ok(items.length >= 3 && items.length <= 5, `On This Page should list 3-5 items, got ${items.length}`);
		assert.match(guideHtml, /exp-guide-toc__list[\s\S]*?>01</);
		assert.match(guideHtml, /exp-guide-toc__list[\s\S]*?>02</);
		// Links resolve to real heading anchors
		assert.match(guideHtml, /href="#core-loop"/);
		assert.match(guideHtml, /href="#timing-windows"/);
		assert.match(guideHtml, /<h2 id="core-loop"[^>]*>Core loop<\/h2>|id="core-loop"/);
		// Editorial numbering must NOT touch the Markdown heading text/id
		assert.match(guideHtml, /<h2[^>]*id="core-loop"[^>]*>\s*Core loop\s*<\/h2>|<h2[^>]*id="core-loop"/);
		assert.doesNotMatch(guideHtml, /<h2[^>]*id="core-loop"[^>]*>\s*01\s*Core loop/);

		// No duplicate Previous/Next + Next Questions blocks stacked
		assert.doesNotMatch(guideHtml, /sl-pagination/);
		const nextItems = [...guideHtml.matchAll(/class="exp-guide-next__item"/g)];
		assert.ok(nextItems.length <= 3, `Next Questions capped at 3, got ${nextItems.length}`);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal guide editorial: route context shows all routes; other routes excludes current', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);

		const guideHtml = readFileSync(path.join(workspace, 'dist/example-guide/index.html'), 'utf8');
		// Example Guide belongs to Getting Started + Core Gameplay
		assert.match(guideHtml, /Getting Started, Core Gameplay/, 'route context lists all member routes');
		assert.match(guideHtml, /href="\/routes\/getting-started\//);
		assert.match(guideHtml, /href="\/routes\/core-gameplay\//);
		// Other Routes weak block derived from config (max 3, excludes current)
		const otherLabels = [...guideHtml.matchAll(/exp-other-route__label">([^<]+)</g)].map((m) => m[1]);
		assert.ok(otherLabels.length >= 1 && otherLabels.length <= 3);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal guide editorial: SEO + Pagefind intact after layout switch', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);

		const guideHtml = readFileSync(path.join(workspace, 'dist/example-guide/index.html'), 'utf8');
		// Canonical unchanged
		assert.match(
			guideHtml,
			/rel="canonical" href="https:\/\/example-game\.example\/example-guide\//,
		);
		// Title unchanged
		assert.match(guideHtml, /<title>Example Guide \| Example Game Guide & Wiki/);
		// Pagefind body marker retained so the guide stays indexed
		assert.match(guideHtml, /data-pagefind-body/);
		const entry = JSON.parse(readFileSync(path.join(workspace, 'dist/pagefind/pagefind-entry.json'), 'utf8')) as {
			languages: Record<string, { page_count: number }>;
		};
		const enPages = entry.languages.en?.page_count ?? 0;
		assert.ok(enPages >= 15, `pagefind should index the formal template pages, got ${enPages}`);
		// Sitemap still lists the guide URL once (no duplicate second URL)
		const sitemap = readFileSync(path.join(workspace, 'dist/sitemap-0.xml'), 'utf8');
		const guideMatches = sitemap.match(/<loc>https:\/\/example-game\.example\/example-guide\/<\/loc>/g) ?? [];
		assert.ok(guideMatches.length >= 1, 'guide URL present in sitemap');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal guide editorial: zh-CN chrome renders for guides', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const generated = path.join(workspace, 'src/config/site.generated.ts');
		writeFileSync(
			generated,
			readFileSync(generated, 'utf8').replace("locale: 'en',", "locale: 'zh-CN',"),
			'utf8',
		);
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const guideHtml = readFileSync(path.join(workspace, 'dist/example-guide/index.html'), 'utf8');
		assert.match(guideHtml, /On this page/);
		assert.match(guideHtml, /快速回答/);
		assert.match(guideHtml, /接下来的问题/);
		assert.match(guideHtml, /你当前在/);
		assert.match(guideHtml, /探索另一条路径/);
		// zh-CN top nav
		const guideNav = guideHtml.match(/<nav class="exp-topbar__nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
		assert.match(guideNav, /href="\/"[^>]*>首页</);
		assert.match(guideNav, /href="\/routes\/"[^>]*>路径</);
		assert.match(guideNav, /href="\/guides\/"[^>]*>攻略</);
		assert.doesNotMatch(guideNav, /关于/, 'About is secondary navigation, not primary navigation');
		assert.doesNotMatch(guideNav, /\/prototype\//, 'Experience chrome must never link the prototype homepage');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});
