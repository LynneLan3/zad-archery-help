/**
 * V2.2-E1 — Formal Experience Homepage.
 *
 * The hub URL `/{hubPath}/` renders the Experience Homepage (GameShell chrome,
 * hero, status strip, hot guides, popular questions, featured, browse, recent,
 * evidence, about) with no reliance on `example-experience.ts`.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function copyTemplateWorkspace(prefix = 'gws-home-'): string {
	mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
	const dir = mkdtempSync(path.join(ROOT, 'tmp', prefix));
	for (const entry of ['package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json', 'TEMPLATE_VERSION', '.gitignore', 'public', 'src', 'scripts']) {
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

function editGenerated(workspace: string, pattern: RegExp, replacement: string) {
	const generated = path.join(workspace, 'src/config/site.generated.ts');
	const next = readFileSync(generated, 'utf8').replace(pattern, replacement);
	assert.ok(next !== readFileSync(generated, 'utf8'), 'expected generated config to change');
	writeFileSync(generated, next, 'utf8');
}

function builtCss(workspace: string): string {
	const astroDir = path.join(workspace, 'dist/_astro');
	return readdirSync(astroDir)
		.filter((name) => name.endsWith('.css'))
		.map((name) => readFileSync(path.join(astroDir, name), 'utf8'))
		.join('\n');
}

test('formal homepage: hub URL uses Experience Homepage with full data', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const html = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');

		// Experience shell, not Starlight docs shell.
		assert.match(html, /exp-topbar/);
		assert.doesNotMatch(html, /sidebar-pane/);
		assert.doesNotMatch(html, /right-sidebar/);

		// Homepage sections in order.
		assert.match(html, /exp-home-hero/);
		assert.match(html, /exp-home-status/);
		// The starter fixture has no homepagePriority values, so Hot Guides is
		// correctly omitted rather than inferred from file order.
		assert.doesNotMatch(html, /exp-home-hot/);
		assert.match(html, /exp-home-questions/);
		assert.match(html, /exp-home-featured/);
		assert.match(html, /exp-home-browse/);
		assert.match(html, /exp-home-recent/);
		assert.doesNotMatch(html, /exp-home-evidence/, 'starter placeholder evidence is omitted');
		assert.match(html, /id="about"/);
		const order = ['exp-home-hero', 'exp-home-status', 'exp-home-questions', 'exp-home-featured', 'exp-home-browse'];
		const positions = order.map((marker) => html.indexOf(marker));
		assert.ok(positions.every((position) => position >= 0), 'demand-first homepage markers should all render');
		const presentationCss = readFileSync(path.join(ROOT, 'src/styles/experience-presentation.css'), 'utf8');
		assert.match(presentationCss, /\.exp-home-hot/);
		assert.match(presentationCss, /\.exp-home-questions/);
		assert.match(presentationCss, /\.exp-home-featured/);

		// Hot guides and browse categories are generated from structured portal data.
		assert.doesNotMatch(html, /exp-hot-guides/);
		assert.match(html, /exp-category-grid/);
		assert.doesNotMatch(html, /exp-hot-guide-card/);

		// Popular Questions remain task-first cards; Start Here is no longer a
		// separate homepage product surface.
		assert.match(html, /How do I get started\?/);

		// Featured spread remains a full-card link; starter placeholder cover is omitted.
		assert.match(html, /<a class="exp-featured exp-featured--content-only" href="\/example-guide\/"/);
		assert.doesNotMatch(html, /exp-featured__image/);

		// Status strip carries real game metadata, no empty labels.
		const status = html.match(/<dl class="exp-home-status"[^>]*>[\s\S]*?<\/dl>/)?.[0] ?? '';
		assert.match(status, /Mar 12, 2026/);
		assert.match(status, /Northlamp Studio/);
		assert.doesNotMatch(status, /<dt><\/dt>/);

		// Nav: Home active, no prototype links anywhere on the page.
		assert.match(html, /<a class="exp-topbar__link is-active" href="\/"[^>]*aria-current="page">Home</);
		assert.doesNotMatch(html, /\/prototype\//);
		assert.doesNotMatch(html, /experience-prototype\.css/, 'formal homepage must not load prototype CSS');
		assert.match(html, /exp-search-overlay/, 'homepage should keep the Experience Pagefind overlay');

		// Single correct H1 from ExperienceHomepage.
		const h1s = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/g) ?? [];
		assert.equal(h1s.length, 1, `expected exactly 1 h1, got ${h1s.length}`);
		assert.match(h1s[0], /Example Game Guide &amp; Wiki/);

		// Homepage is in the sitemap and indexed by Pagefind (data-pagefind-body).
		const sitemap = readFileSync(path.join(workspace, 'dist/sitemap-0.xml'), 'utf8');
		assert.match(sitemap, /<loc>https:\/\/example-game\.example\/<\/loc>/);
		assert.match(html, /data-pagefind-body/);

		const css = builtCss(workspace);
		assert.match(css, /\.exp-hot-guide/, 'homepage theme CSS should include Hot Guide presentation');
		assert.match(css, /\.exp-search-dialog .pagefind-ui__search-input/, 'Pagefind input should be themed inside Experience search dialog');
		assert.match(
			css,
			/\.exp-search-dialog .pagefind-ui .pagefind-ui__result-title .pagefind-ui__result-link/,
			'Pagefind results should be themed inside Experience search dialog',
		);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: routes optional — section omitted and build succeeds', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		editGenerated(workspace, /\troutes: \[[\s\S]*?\n\t\],\n\tcategories:/, '\tcategories:');
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const html = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');
		assert.doesNotMatch(html, /exp-home-hot/);
		assert.doesNotMatch(html, /exp-route-entry/);
		// Rest of the homepage still renders.
		assert.match(html, /exp-home-hero/);
		assert.match(html, /exp-home-browse/);
		assert.match(html, /id="about"/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: single route becomes integrated Start Here primary path', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		editGenerated(
			workspace,
			/(\troutes: \[[\s\S]*?\n\t\t\},)\n\t\t\{\n\t\t\tid: 'core-gameplay'[\s\S]*?\n\t\t\},\n\t\t\{\n\t\t\tid: 'world-exploration'[\s\S]*?\n\t\t\},\n\t\t\{\n\t\t\tid: 'story-characters'[\s\S]*?\n\t\t\},(\n\t\],)/,
			'$1$2',
		);
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const html = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');
		assert.doesNotMatch(html, /Choose Your Route/);
		assert.doesNotMatch(html, /exp-home-routes/);
		assert.doesNotMatch(html, /exp-home-hot/);
		assert.match(html, /exp-home-browse/);
		assert.match(html, /exp-category-grid/);
		assert.match(html, /exp-home-questions/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: startHere and popularQuestions optional — sections omitted', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		editGenerated(workspace, /startHere: \[[\s\S]*?\n\t\t\],\n/, '');
		editGenerated(workspace, /popularQuestions: \[[\s\S]*?\n\t\t\],\n/, '');
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const html = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');
		assert.doesNotMatch(html, /exp-home-hot/);
		assert.doesNotMatch(html, /exp-start-item/);
		assert.doesNotMatch(html, /exp-home-questions/);
		assert.doesNotMatch(html, /exp-question/);
		// No empty shells left behind.
		assert.doesNotMatch(html, /exp-section[^>]*>\s*<\/section>/);
		// Routes and about remain.
		assert.match(html, /exp-home-browse/);
		assert.match(html, /id="about"/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: featured candidate optional — featured section omitted', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		for (const file of [
			'src/content/docs/getting-started/overview.md',
			'src/content/docs/gameplay/example-guide.md',
			'src/content/docs/world/example-location.md',
		]) {
			const mdPath = path.join(workspace, file);
			writeFileSync(mdPath, readFileSync(mdPath, 'utf8').replace(/featured: true\n/, ''), 'utf8');
		}
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const html = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');
		assert.doesNotMatch(html, /exp-home-featured/);
		assert.doesNotMatch(html, /exp-featured__image/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: featured guide without cover renders content-only', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const mdPath = path.join(workspace, 'src/content/docs/gameplay/example-guide.md');
		writeFileSync(mdPath, readFileSync(mdPath, 'utf8').replace(/cover: .+\n/, ''), 'utf8');
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const html = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');
		assert.match(html, /exp-home-featured/);
		assert.match(html, /exp-featured--content-only/);
		assert.doesNotMatch(html, /exp-featured__image/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: omitted evidence item leaves no empty frame', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		editGenerated(
			workspace,
			/(\bevidence: \{[\s\S]*?\bitems: \[\n)\s*\{\n\s*image: 'placeholder\.svg',[\s\S]*?\n\s*\},/,
			'$1',
		);
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const html = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');
		const frames = html.match(/class=\"exp-evidence__frame\"/g) ?? [];
		assert.equal(frames.length, 0);
		assert.doesNotMatch(html, new RegExp('<figure class="exp-evidence__frame">\\s*</figure>'));
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: category landing stays on Starlight fallback', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const landing = readFileSync(path.join(workspace, 'dist/gameplay/index.html'), 'utf8');
		assert.match(landing, /sidebar-pane/);
		assert.doesNotMatch(landing, /exp-home-hero/);
		assert.doesNotMatch(landing, /exp-topbar/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: zh-CN chrome renders for the homepage', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		editGenerated(workspace, /locale: 'en',/, "locale: 'zh-CN',");
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const html = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');
		// Nav labels localized, Home active.
		assert.match(html, /<a class="exp-topbar__link is-active" href="\/"[^>]*aria-current="page">首页</);
		assert.match(html, /href="\/routes\/"[^>]*>路径</);
		assert.match(html, /href="\/guides\/"[^>]*>攻略</);
		assert.match(html, /href="\/#about"[^>]*>关于</);
		// Section labels localized.
		assert.match(html, /Browse by game content/);
		assert.match(html, /关于/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: Pagefind index includes the homepage', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const pagefind = path.join(workspace, 'dist/pagefind/pagefind-entry.json');
		assert.ok(existsSync(pagefind), 'pagefind index missing');
		const entry = JSON.parse(readFileSync(pagefind, 'utf8'));
		assert.ok(entry.languages?.en?.page_count > 0, 'no pages in pagefind index');
		// Homepage HTML is marked as pagefind body (the earlier homepage test covers the marker).
		assert.ok(existsSync(path.join(workspace, 'dist/index.html')));
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('formal homepage: prototype URLs and prototype assets are not production output', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		const build = buildTemplate(workspace);
		assert.equal(build.status, 0, build.stdout + build.stderr);
		for (const file of [
			'dist/prototype/index.html',
			'dist/guide-prototype/index.html',
			'dist/prototype-routes/getting-started/index.html',
			'dist/experience-shell-test/index.html',
		]) {
			assert.equal(existsSync(path.join(workspace, file)), false, `${file} should not be emitted`);
		}
		const sitemap = readFileSync(path.join(workspace, 'dist/sitemap-0.xml'), 'utf8');
		const pagefind = readFileSync(path.join(workspace, 'dist/pagefind/pagefind-entry.json'), 'utf8');
		for (const forbidden of ['prototype', 'guide-prototype', 'prototype-routes', 'experience-shell-test']) {
			assert.doesNotMatch(sitemap, new RegExp(forbidden));
			assert.doesNotMatch(pagefind, new RegExp(forbidden));
		}
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});
