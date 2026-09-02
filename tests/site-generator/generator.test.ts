import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { generateSite, SpecValidationError } from '../../scripts/lib/generator';
import { assertSafeAssetTarget } from '../../scripts/lib/site-spec';
import { CORE_TRUST_PAGE_KINDS, TRUST_PAGE_SLUGS } from '../../src/lib/trust';
import { countMetaByName, countMetaByProperty } from '../../src/lib/social';
import { ANALYTICS_PLACEMENTS, normalizeAnalyticsPath, resolveAnalyticsEnvironment, shouldLoadGa4, shouldLoadVercelAnalytics } from '../../src/lib/analytics';
import { CORE_INTERACTION_EVENTS, buildCoreInteractionEvent } from '../../src/lib/analytics-events';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = path.join(ROOT, 'tests/site-generator/fixtures');

function hashText(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

function copyTemplateWorkspace(): string {
	mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
	const dir = mkdtempSync(path.join(ROOT, 'tmp', 'gws-generator-'));
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
	symlinkSync(nodeModulesTarget, path.join(dir, 'node_modules'));
	return dir;
}

function installFixture(workspace: string, fixtureName: string) {
	const fixtureDir = path.join(FIXTURES, fixtureName);
	cpSync(path.join(fixtureDir, 'site-spec.yaml'), path.join(workspace, 'site-spec.yaml'));
	if (existsSync(path.join(fixtureDir, 'site-input'))) {
		cpSync(path.join(fixtureDir, 'site-input'), path.join(workspace, 'site-input'), { recursive: true });
	}
}

const TRUST_SPEC_BLOCK = `
trust:
  enabled: true
  about:
    enabled: true
    source: site-input/trust/about.md
  editorialMethod:
    enabled: true
    source: site-input/trust/editorial-method.md
  privacy:
    enabled: true
    source: site-input/trust/privacy.md
`;

function installTrustInputs(workspace: string) {
	cpSync(path.join(ROOT, 'site-input/trust'), path.join(workspace, 'site-input/trust'), { recursive: true });
}

function appendTrustSpec(workspace: string, block = TRUST_SPEC_BLOCK) {
	const specPath = path.join(workspace, 'site-spec.yaml');
	writeFileSync(specPath, `${readFileSync(specPath, 'utf8').trimEnd()}\n${block}\n`, 'utf8');
}

function appendSpecBlock(workspace: string, block: string) {
	const specPath = path.join(workspace, 'site-spec.yaml');
	writeFileSync(specPath, `${readFileSync(specPath, 'utf8').trimEnd()}\n${block}\n`, 'utf8');
}

function managedHashes(workspace: string): Record<string, string> {
	const manifest = JSON.parse(readFileSync(path.join(workspace, '.site-generator-manifest.json'), 'utf8')) as {
		managedFiles: Array<{ path: string; sha256: string }>;
	};
	const out: Record<string, string> = {};
	for (const file of manifest.managedFiles) {
		out[file.path] = file.sha256;
	}
	return out;
}

function listRelativeFiles(dir: string, base = dir, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist' || entry === '.astro') continue;
		const full = path.join(dir, entry);
		const rel = path.relative(base, full).replace(/\\/g, '/');
		if (statSync(full).isDirectory()) listRelativeFiles(full, base, out);
		else out.push(rel);
	}
	return out.sort();
}

test('11.1 successful generation + validate:site', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		writeFileSync(
			path.join(workspace, 'site-input/pages/beginner-guide.md'),
			`# Writer H1 that the article renderer must not inherit\n\n${readFileSync(path.join(workspace, 'site-input/pages/beginner-guide.md'), 'utf8')}`,
			'utf8',
		);
		const result = generateSite({
			specPath: path.join(workspace, 'site-spec.yaml'),
			rootDir: workspace,
		});
		assert.equal(result.ok, true);
		const generatedGuide = readFileSync(
			path.join(workspace, 'src/content/docs/gameplay/gameplay-overview.md'),
			'utf8',
		);
		assert.match(generatedGuide, /coverMedia:/, 'generated cover carries canonical media metadata');
		assert.ok(existsSync(path.join(workspace, 'src/content/docs/getting-started/beginner-guide.md')));
		assert.ok(existsSync(path.join(workspace, 'src/content/docs/game-info/system-requirements.md')));
		assert.ok(existsSync(path.join(workspace, 'src/content/docs/gameplay/gameplay-overview.md')));
		assert.ok(existsSync(path.join(workspace, 'src/assets/hero/main.svg')));
		assert.ok(existsSync(path.join(workspace, '.site-generator-manifest.json')));

		const beginner = readFileSync(
			path.join(workspace, 'src/content/docs/getting-started/beginner-guide.md'),
			'utf8',
		);
		assert.match(beginner, /\/fixture-game\/system-requirements\//);
		assert.match(beginner, /\/fixture-game\//);
		assert.doesNotMatch(beginner, /\{\{page:/);
		assert.doesNotMatch(beginner, /\{\{hub\}\}/);
		assert.doesNotMatch(beginner, /^#\s+/m, 'generated article body must not contain a Writer H1');
		assert.match(beginner, /^pageType: overview/m);
		assert.match(beginner, /^sections:/m);
		assert.match(beginner, /role: "?core"?/);
		assert.match(beginner, /assetType: "?article"?/);
		assert.doesNotMatch(beginner, /^sources:/m);
		assert.doesNotMatch(beginner, /^evidence:/m);
		assert.match(beginner, /getting-started/);
		assert.match(beginner, /type: "?next-step"?/);
		const relationBlocks = beginner.match(/type: "?related"?/g) ?? [];
		assert.equal(relationBlocks.length, 1, 'relations should emit one related entry alongside legacy related[]');

		const overview = readFileSync(
			path.join(workspace, 'src/content/docs/gameplay/gameplay-overview.md'),
			'utf8',
		);
		assert.match(overview, /assetType: "?comparison"?/);
		assert.match(overview, /type: "?official"?/);
		assert.match(overview, /asset: "?evidence\/gameplay.svg"?/);
		assert.match(overview, /sourceType: official/);
		assert.match(overview, /socialImage:/);
		assert.match(overview, /asset: social\/guide-og.svg/);
		assert.doesNotMatch(beginner, /socialImage:/);

		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /pages: \[/);
		assert.match(generated, /role: "core"/);
		assert.match(generated, /assetType: "article"/);
		assert.match(generated, /assetType: "comparison"/);
		assert.match(generated, /intents: \["getting-started"\]/);
		assert.match(generated, /title: "Fixture Game Wiki"/);
		assert.match(generated, /accentForeground: "#111111"/);
		assert.match(generated, /disclaimer: "非官方粉丝资料站。"/);
		assert.match(generated, /releaseStatus: "released"/);
		assert.match(generated, /locale: "zh-CN"/);
		assert.match(generated, /hubPath: "\/fixture-game\/"/);
		assert.match(generated, /asset: "social\/default-og.svg"/);
		assert.match(generated, /asset: "social\/guide-og.svg"/);
		assert.doesNotMatch(generated, /statusItems:/);

		const hub = readFileSync(path.join(workspace, 'src/content/docs/index.mdx'), 'utf8');
		assert.match(hub, /Fixture Game 攻略 Wiki/);

		const validate = spawnSync('npx', ['tsx', './scripts/validate-site.mjs', '--mode=generated-site'], {
			cwd: workspace,
			encoding: 'utf8',
		});
		assert.equal(validate.status, 0, validate.stdout + validate.stderr);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('V2.1 unknown pageType fails before generated output is written', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const specPath = path.join(workspace, 'site-spec.yaml');
		writeFileSync(specPath, readFileSync(specPath, 'utf8').replace('pageType: overview', 'pageType: spaceship'), 'utf8');
		assert.throws(
			() => generateSite({ specPath, rootDir: workspace }),
			(error: unknown) => /pageType|overview|registered/i.test(String((error as Error).message)),
		);
		assert.equal(existsSync(path.join(workspace, '.site-generator-manifest.json')), false);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.2 idempotent second generate', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const beforeFiles = listRelativeFiles(workspace);
		const beforeHashes = managedHashes(workspace);
		const beforeManifest = readFileSync(path.join(workspace, '.site-generator-manifest.json'), 'utf8');

		const second = generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		assert.equal(second.written.length, 0);
		assert.equal(second.deleted.length, 0);
		const afterHashes = managedHashes(workspace);
		assert.deepEqual(afterHashes, beforeHashes);
		assert.equal(readFileSync(path.join(workspace, '.site-generator-manifest.json'), 'utf8'), beforeManifest);
		assert.deepEqual(listRelativeFiles(workspace), beforeFiles);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.2a generated Hub frontmatter quotes YAML-sensitive strings and remains deterministic', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const specPath = path.join(workspace, 'site-spec.yaml');
		const spec = readFileSync(specPath, 'utf8')
			.replace('  title: Fixture Game Wiki', '  title: "Researcher\'s #1 guide"')
			.replace('  description: 用于生成器测试的虚构游戏 Wiki。', '  description: "Researcher\'s #1 guide"')
			.replace('  hubTitle: Fixture Game 攻略 Wiki', '  hubTitle: "Serious Sam: Shatterverse Guide"');
		writeFileSync(specPath, spec, 'utf8');

		const first = generateSite({ specPath, rootDir: workspace });
		const hubPath = path.join(workspace, 'src/content/docs/index.mdx');
		const hub = readFileSync(hubPath, 'utf8');
		const frontmatter = hub.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
		assert.ok(frontmatter, 'generated Hub must contain frontmatter');
		assert.deepEqual(parseYaml(frontmatter), {
			title: 'Serious Sam: Shatterverse Guide',
			description: "Researcher's #1 guide",
			template: 'splash',
			slug: 'fixture-game',
		});
		assert.match(hub, /^title: "Serious Sam: Shatterverse Guide"$/m);
		assert.match(hub, /^description: "Researcher's #1 guide"$/m);

		const before = readFileSync(hubPath, 'utf8');
		const second = generateSite({ specPath, rootDir: workspace });
		assert.equal(first.ok, true);
		assert.equal(second.written.length, 0);
		assert.equal(second.deleted.length, 0);
		assert.equal(readFileSync(hubPath, 'utf8'), before);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.2b Serious Sam title frontmatter is YAML-safe and Astro-checkable', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const specPath = path.join(workspace, 'site-spec.yaml');
		const title = 'Serious Sam: Shatterverse Guide — Characters, Weapons, Bosses & Co-op';
		const spec = readFileSync(specPath, 'utf8')
			.replace('  name: Fixture Game', '  name: "Serious Sam: Shatterverse"')
			.replace('  hubTitle: Fixture Game 攻略 Wiki', `  hubTitle: ${JSON.stringify(title)}`)
			.replace('  title: Fixture Game Wiki', `  title: ${JSON.stringify(title)}`);
		writeFileSync(specPath, spec, 'utf8');

		generateSite({ specPath, rootDir: workspace });
		const hubPath = path.join(workspace, 'src/content/docs/index.mdx');
		const hub = readFileSync(hubPath, 'utf8');
		const frontmatter = hub.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
		assert.ok(frontmatter, 'generated Hub must contain frontmatter');
		assert.deepEqual(parseYaml(frontmatter), {
			title,
			description: '用于生成器测试的虚构游戏 Wiki。',
			template: 'splash',
			slug: 'fixture-game',
		});
		assert.match(hub, new RegExp(`^title: ${JSON.stringify(title).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'm'));

		const astroCheck = spawnSync('npx', ['astro', 'check'], {
			cwd: workspace,
			encoding: 'utf8',
		});
		assert.equal(astroCheck.status, 0, `${astroCheck.stdout}\n${astroCheck.stderr}`);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.3 dry-run does not modify filesystem', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const before = listRelativeFiles(workspace).map((rel) => ({
			rel,
			hash: hashText(readFileSync(path.join(workspace, rel), 'utf8')),
		}));
		const result = generateSite({
			specPath: path.join(workspace, 'site-spec.yaml'),
			rootDir: workspace,
			dryRun: true,
		});
		assert.equal(result.dryRun, true);
		assert.ok(result.plan.items.length > 0);
		const after = listRelativeFiles(workspace).map((rel) => ({
			rel,
			hash: hashText(readFileSync(path.join(workspace, rel), 'utf8')),
		}));
		assert.deepEqual(after, before);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.4 missing page source fails before writes', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'invalid-missing-source');
		const before = listRelativeFiles(workspace);
		assert.throws(
			() => generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace }),
			(error: unknown) => {
				assert.ok(error instanceof SpecValidationError);
				assert.match(String(error.message), /beginner-guide|does-not-exist|source/i);
				return true;
			},
		);
		assert.deepEqual(listRelativeFiles(workspace), before);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.5b self relation in relations fails before writes', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'invalid-self-relation');
		assert.throws(
			() => generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace }),
			(error: unknown) => {
				assert.ok(error instanceof SpecValidationError);
				assert.match(String(error.message), /self|relations|beginner-guide/i);
				return true;
			},
		);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.5c invalid relation type fails before writes', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'invalid-relation-type');
		assert.throws(
			() => generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace }),
			(error: unknown) => {
				assert.ok(error instanceof SpecValidationError);
				assert.match(String(error.message), /relation\.type|invalid|winner/i);
				return true;
			},
		);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.5d page role defaults to supporting when omitted', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const specPath = path.join(workspace, 'site-spec.yaml');
		const specRaw = readFileSync(specPath, 'utf8').replace(/\n    role: supporting\n    intents:\n      - gameplay-loop\n/, '\n');
		writeFileSync(specPath, specRaw, 'utf8');
		generateSite({ specPath, rootDir: workspace });
		const overview = readFileSync(
			path.join(workspace, 'src/content/docs/gameplay/gameplay-overview.md'),
			'utf8',
		);
		assert.match(overview, /role: "?supporting"?/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

function expectPatchedSpecFail(mutate: (raw: string) => string, pattern: RegExp) {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const specPath = path.join(workspace, 'site-spec.yaml');
		writeFileSync(specPath, mutate(readFileSync(specPath, 'utf8')), 'utf8');
		assert.throws(
			() => generateSite({ specPath, rootDir: workspace }),
			(error: unknown) => {
				assert.ok(error instanceof SpecValidationError);
				assert.match(String(error.message), pattern);
				return true;
			},
		);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
}

test('11.5e assetType defaults to article when omitted', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const beginner = readFileSync(
			path.join(workspace, 'src/content/docs/getting-started/beginner-guide.md'),
			'utf8',
		);
		assert.match(beginner, /assetType: "?article"?/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.5f invalid assetType fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('assetType: comparison', 'assetType: winner'),
		/assetType|invalid|winner/i,
	);
});

test('11.5g invalid source type fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('type: steam', 'type: discord'),
		/source\.type|invalid|discord/i,
	);
});

test('11.5h missing source title fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('\n        title: Steam store page', ''),
		/title|source/i,
	);
});

test('11.5i invalid source URL fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('url: https://example.com/steam', 'url: not-a-url'),
		/url|valid/i,
	);
});

test('11.5j unknown evidence asset fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('asset: evidence/gameplay.svg', 'asset: evidence/missing.webp'),
		/evidence|assets\[\]\.target|missing/i,
	);
});

test('11.5k empty evidence alt fails before writes', () => {
	expectPatchedSpecFail(
		(raw) =>
			raw.replace(
				'alt: Fixture Game gameplay still used as comparison evidence',
				'alt: ""',
			),
		/alt|empty/i,
	);
});

test('11.5l invalid evidence sourceType fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('sourceType: official', 'sourceType: wiki'),
		/evidence\.sourceType|invalid|wiki/i,
	);
});

test('11.5m invalid evidence sourceUrl fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('sourceUrl: https://example.com/press', 'sourceUrl: ftp://example.com/press'),
		/sourceUrl|http/i,
	);
});

test('11.5n facts exceeding 4 items fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => {
			const anchor = '    related:\n      - beginner-guide\n    changeSummary:';
			return raw.replace(anchor,
				'    facts:\n      - label: A\n        value: a\n      - label: B\n        value: b\n      - label: C\n        value: c\n      - label: D\n        value: d\n      - label: E\n        value: e\n' + anchor);
		},
		/facts|at most 4/i,
	);
});

test('11.5o facts with empty label fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => {
			const anchor = '    related:\n      - beginner-guide\n    changeSummary:';
			return raw.replace(anchor,
				'    facts:\n      - label: ""\n        value: something\n' + anchor);
		},
		/label|empty/i,
	);
});

test('11.5p facts with empty value fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => {
			const anchor = '    related:\n      - beginner-guide\n    changeSummary:';
			return raw.replace(anchor,
				'    facts:\n      - label: Location\n        value: ""\n' + anchor);
		},
		/value|empty/i,
	);
});

test('11.5 broken page id reference fails before writes', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'invalid-broken-reference');
		const before = listRelativeFiles(workspace);
		assert.throws(
			() => generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace }),
			(error: unknown) => {
				assert.ok(error instanceof SpecValidationError);
				assert.match(String(error.message), /unknown page|related|pageId|does-not-exist|system-requirements/i);
				return true;
			},
		);
		assert.deepEqual(listRelativeFiles(workspace), before);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.6 missing asset source fails before writes', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'invalid-missing-asset');
		const before = listRelativeFiles(workspace);
		assert.throws(
			() => generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace }),
			(error: unknown) => {
				assert.ok(error instanceof SpecValidationError);
				assert.match(String(error.message), /asset source|missing-hero|hero/i);
				return true;
			},
		);
		assert.deepEqual(listRelativeFiles(workspace), before);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.7 path traversal asset target fails', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'path-traversal');
		assert.throws(
			() => generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace }),
			(error: unknown) => {
				assert.ok(error instanceof SpecValidationError);
				assert.match(String(error.message), /escapes|traversal|\.\./i);
				return true;
			},
		);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.7b backslash and absolute asset targets fail', () => {
	assert.throws(() => assertSafeAssetTarget('..\\outside.jpg', 'target', 'test'), SpecValidationError);
	assert.throws(() => assertSafeAssetTarget('/tmp/outside.jpg', 'target', 'test'), SpecValidationError);
	assert.throws(() => assertSafeAssetTarget('C:\\Windows\\outside.jpg', 'target', 'test'), SpecValidationError);
});

test('11.8 unmanaged file collision fails', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'unmanaged-collision');
		const collisionPath = path.join(workspace, 'src/content/docs/getting-started/beginner-guide.md');
		mkdirSync(path.dirname(collisionPath), { recursive: true });
		writeFileSync(collisionPath, '# hand-written unmanaged file\n', 'utf8');
		assert.throws(
			() => generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace }),
			(error: unknown) => {
				assert.ok(error instanceof SpecValidationError);
				assert.match(String(error.message), /non-managed|collision|overwrite/i);
				return true;
			},
		);
		assert.equal(readFileSync(collisionPath, 'utf8'), '# hand-written unmanaged file\n');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.9 generated file drift fails --check', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const target = path.join(workspace, 'src/config/site.generated.ts');
		writeFileSync(target, `${readFileSync(target, 'utf8')}\n// drifted\n`, 'utf8');
		const check = generateSite({
			specPath: path.join(workspace, 'site-spec.yaml'),
			rootDir: workspace,
			check: true,
		});
		assert.equal(check.ok, false);
		assert.ok(check.drift.includes('src/config/site.generated.ts'));
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('11.10 template workspace not polluted by fixtures', () => {
	const marker = path.join(ROOT, 'src/content/docs/getting-started/beginner-guide.md');
	assert.equal(existsSync(marker), false);
	assert.equal(existsSync(path.join(ROOT, 'site-spec.yaml')), false);
	assert.equal(existsSync(path.join(ROOT, '.site-generator-manifest.json')), false);
});

test('generated-site rejects Example Game residue after valid generate', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		writeFileSync(
			path.join(workspace, 'src/config/site.generated.ts'),
			generated.replace('Fixture Game', 'Example Game'),
			'utf8',
		);
		// Drift check should fail first when validate extras run; also residue check on game config.
		const validate = spawnSync('npx', ['tsx', './scripts/validate-site.mjs', '--mode=generated-site'], {
			cwd: workspace,
			encoding: 'utf8',
		});
		assert.notEqual(validate.status, 0);
		assert.match(validate.stderr + validate.stdout, /Example Game|drift|managed/i);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('integration build for generated fixture site', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site', PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123456', VERCEL_ENV: 'production' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		assert.ok(existsSync(path.join(workspace, 'dist/fixture-game/index.html')));
		assert.ok(existsSync(path.join(workspace, 'dist/fixture-game/beginner-guide/index.html')));
		const hubHtml = readFileSync(path.join(workspace, 'dist/fixture-game/index.html'), 'utf8');
		assert.match(hubHtml, /--game-accent-foreground:\s*#111111/);
	assert.match(hubHtml, /非官方粉丝资料站/);
	assert.match(hubHtml, /已发售/);
	// Experience Homepage replaces the legacy GamePortal card grid on the hub splash.
	assert.match(hubHtml, /exp-home-hero/);
	assert.match(hubHtml, /exp-home-status/);
	// Fixture spec has no routes: Choose Your Route must not render at all.
	assert.doesNotMatch(hubHtml, /exp-home-routes/);
	assert.doesNotMatch(hubHtml, /exp-route-entry/);
	// Homepage presentation uses the fixed player-task shell; Start Here is not
	// emitted as a separate document-style section.
	assert.doesNotMatch(hubHtml, /exp-start-item/);
	// Popular Questions render as a lightweight section, not a giant FAQ list.
	assert.match(hubHtml, /exp-question/);
	assert.match(hubHtml, /新手应该先做什么/);
	// Featured spread derives from the featured:true role:core guide with a cover.
	assert.match(hubHtml, /exp-featured/);
	// Evidence grid keeps the modest placement.
	assert.match(hubHtml, /exp-evidence/);
	// About section carries the #about anchor used by the About nav link.
	assert.match(hubHtml, /id="about"/);
		const beginnerHtml = readFileSync(
			path.join(workspace, 'dist/fixture-game/beginner-guide/index.html'),
			'utf8',
		);
		assert.match(beginnerHtml, /Next Questions|接下来的问题/);
		// UI dedupe: related guides should not repeat whatever Next Questions already renders.
		assert.doesNotMatch(beginnerHtml, /Related Guides|相关攻略/);
		// Experience editorial layout classes replace the old Starlight-guide classes.
		assert.match(beginnerHtml, /exp-guide-header__eyebrow|exp-eyebrow/);
		assert.match(beginnerHtml, /第一次进入 Fixture Game 时应优先了解的内容。/);
		assert.match(beginnerHtml, /Starter Route/);
		assert.match(beginnerHtml, /exp-facts-strip/);
		assert.match(beginnerHtml, /15 分钟/);
		assert.doesNotMatch(beginnerHtml, /id="gw-sources-heading"/);
		assert.doesNotMatch(beginnerHtml, /id="gw-guide-evidence-heading"/);
		const overviewHtml = readFileSync(
			path.join(workspace, 'dist/fixture-game/gameplay-overview/index.html'),
			'utf8',
		);
		assert.match(overviewHtml, /id="gw-guide-evidence-heading"/);
		assert.match(overviewHtml, /id="gw-sources-heading"/);
		assert.match(overviewHtml, /Core Systems/);
		assert.match(overviewHtml, /探索 → 战斗 → 升级/);
		assert.match(overviewHtml, /Fixture Game FAQ/);
		assert.match(overviewHtml, /evidence\/gameplay|gameplay\.svg|_astro\//);
		assert.match(overviewHtml, /data-outbound-kind="source"/);
		assert.match(overviewHtml, /data-outbound-kind="evidence"/);
		assert.doesNotMatch(hubHtml, /gw-analytics-config/);
		assert.doesNotMatch(hubHtml, /googletagmanager\.com/);
		assert.match(hubHtml, /property="og:image"/);
		assert.match(hubHtml, /content="https:\/\/fixture-wiki\.example\/[^"]+"/);
		assert.match(hubHtml, /Fixture Game guides and wiki/);
		assert.equal(countMetaByProperty(hubHtml, 'og:image'), 1);
		assert.equal(countMetaByProperty(hubHtml, 'og:title'), 1);
		assert.equal(countMetaByProperty(hubHtml, 'og:image:alt'), 1);
		assert.equal(countMetaByName(hubHtml, 'twitter:card'), 1);
		assert.equal(countMetaByName(hubHtml, 'twitter:image'), 1);
		assert.match(hubHtml, /name="twitter:card"[^>]*content="summary_large_image"|content="summary_large_image"[^>]*name="twitter:card"/);
		assert.match(overviewHtml, /Fixture Game gameplay overview social preview/);
		assert.doesNotMatch(overviewHtml, /Fixture Game guides and wiki/);
		assert.doesNotMatch(hubHtml, /data-ad-slot=/);
		assert.doesNotMatch(beginnerHtml, /data-ad-slot=/);
		assert.doesNotMatch(hubHtml, /adsbygoogle|googlesyndication|ezoic|mediavine|raptive/i);
		assert.doesNotMatch(hubHtml, /Affiliate Disclosure|联盟披露/);
		assert.equal(existsSync(path.join(workspace, 'dist/fixture-game/affiliate-disclosure/index.html')), false);
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.doesNotMatch(generated, /\bmonetization:\s*\{/);
		assert.doesNotMatch(overviewHtml, /Fixture Game guides and wiki/);
		const beginnerHtmlSocial = readFileSync(
			path.join(workspace, 'dist/fixture-game/beginner-guide/index.html'),
			'utf8',
		);
		assert.match(beginnerHtmlSocial, /Fixture Game guides and wiki/);
		assert.match(beginnerHtmlSocial, /property="og:url"[^>]*content="https:\/\/fixture-wiki\.example\/fixture-game\/beginner-guide\/"|content="https:\/\/fixture-wiki\.example\/fixture-game\/beginner-guide\/"[^>]*property="og:url"/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('12.1 valid-site without trust config does not generate trust pages', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		assert.equal(existsSync(path.join(workspace, 'src/content/trust/about.md')), false);
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.doesNotMatch(generated, /\btrust:\s*\{/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('12.2 all trust pages generate managed markdown and runtime config', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		for (const kind of CORE_TRUST_PAGE_KINDS) {
			const file = path.join(workspace, `src/content/trust/${TRUST_PAGE_SLUGS[kind]}.md`);
			assert.ok(existsSync(file), kind);
			const raw = readFileSync(file, 'utf8');
			assert.match(raw, /trustType: /);
			assert.doesNotMatch(raw, /^category:/m);
			assert.doesNotMatch(raw, /^role:/m);
		}
		const about = readFileSync(path.join(workspace, 'src/content/trust/about.md'), 'utf8');
		assert.match(about, /robots: "?index,follow"?/);
		const privacy = readFileSync(path.join(workspace, 'src/content/trust/privacy.md'), 'utf8');
		assert.match(privacy, /robots: "?noindex,follow"?/);
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /trust:\s*\{/);
		assert.match(generated, /path: "\/fixture-game\/about\/"/);
		assert.match(generated, /robots: "noindex,follow"/);
		const hashes = managedHashes(workspace);
		assert.ok(hashes['src/content/trust/about.md']);
		assert.ok(hashes['src/content/trust/privacy.md']);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('12.3 trust.enabled false does not generate trust pages', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(
			workspace,
			`
trust:
  enabled: false
  about:
    enabled: true
    source: site-input/trust/about.md
`,
		);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		assert.equal(existsSync(path.join(workspace, 'src/content/trust/about.md')), false);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('12.4 about-only trust generates a single managed page', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(
			workspace,
			`
trust:
  enabled: true
  about:
    enabled: true
    source: site-input/trust/about.md
`,
		);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		assert.ok(existsSync(path.join(workspace, 'src/content/trust/about.md')));
		assert.equal(existsSync(path.join(workspace, 'src/content/trust/privacy.md')), false);
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /about:\s*\{/);
		assert.doesNotMatch(generated, /privacy:\s*\{/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('12.5 missing trust source fails before writes', () => {
	expectPatchedSpecFail(
		(raw) => `${raw.trimEnd()}\n${TRUST_SPEC_BLOCK.replace('site-input/trust/about.md', 'site-input/trust/missing-about.md')}\n`,
		/trust source|does not exist|missing-about/i,
	);
});

test('12.6 trust source path traversal fails before writes', () => {
	expectPatchedSpecFail(
		(raw) =>
			`${raw.trimEnd()}\ntrust:\n  enabled: true\n  about:\n    enabled: true\n    source: site-input/../README.md\n`,
		/trust source|escapes|site-input/i,
	);
});

test('12.7 disabling trust removes stale generated trust files', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace);
		const specPath = path.join(workspace, 'site-spec.yaml');
		generateSite({ specPath, rootDir: workspace });
		assert.ok(existsSync(path.join(workspace, 'src/content/trust/about.md')));
		const disabled = readFileSync(specPath, 'utf8').replace('trust:\n  enabled: true', 'trust:\n  enabled: false');
		writeFileSync(specPath, disabled, 'utf8');
		generateSite({ specPath, rootDir: workspace });
		assert.equal(existsSync(path.join(workspace, 'src/content/trust/about.md')), false);
		const hashes = managedHashes(workspace);
		assert.equal(hashes['src/content/trust/about.md'], undefined);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('12.8 root hubPath emits root-level trust URLs in generated config', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		const specPath = path.join(workspace, 'site-spec.yaml');
		let specRaw = readFileSync(specPath, 'utf8').replace('hubPath: /fixture-game/', 'hubPath: /');
		specRaw = `${specRaw.trimEnd()}\n${TRUST_SPEC_BLOCK}\n`;
		writeFileSync(specPath, specRaw, 'utf8');
		generateSite({ specPath, rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /path: "\/about\/"/);
		assert.match(generated, /path: "\/privacy\/"/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('12.9 standalone Hub preserves a nested legacy Guide slug', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const specPath = path.join(workspace, 'site-spec.yaml');
		let specRaw = readFileSync(specPath, 'utf8')
			.replace('  mode: hub', '  mode: standalone')
			.replace('  hubPath: /fixture-game/', '  hubPath: /')
			.replace(
				'    slug: beginner-guide',
				[
					'    slug: legacy-game/classes',
					'    lastUpdated: 2026-08-13',
					'    sidebarLabel: Classes & School System',
					'    sidebarBadge: Confirmed',
					'    head:',
					'      - tag: title',
					'        content: Legacy Classes',
					'      - tag: meta',
					'        attrs:',
					'          property: og:title',
					'          content: Legacy Classes',
					'      - tag: script',
					'        attrs:',
					'          type: application/ld+json',
					'        content: |-',
					'          {"@context":"https://schema.org","@type":"BreadcrumbList"}',
					'      - tag: script',
					'        attrs:',
					'          type: application/ld+json',
					'        content: |-',
					'          {"@context":"https://schema.org","@type":"FAQPage"}',
				].join('\n'),
			);
		specRaw = `${specRaw.trimEnd()}\n\nroutes:\n  - id: getting-started\n    title: Getting Started\n    description: The first route.\n    pages:\n      - beginner-guide\n`;
		writeFileSync(specPath, specRaw, 'utf8');
		generateSite({ specPath, rootDir: workspace });

		const generatedPagePath = path.join(
			workspace,
			'src/content/docs/getting-started/legacy-game/classes.md',
		);
		assert.ok(existsSync(generatedPagePath));
		const generatedPage = readFileSync(generatedPagePath, 'utf8');
		assert.match(generatedPage, /slug: "?legacy-game\/classes"?/);
		assert.match(generatedPage, /lastUpdated: "?2026-08-13"?/);
		assert.match(generatedPage, /label: "Classes & School System"/);
		assert.match(generatedPage, /order: 1/);
		assert.match(generatedPage, /badge: "?Confirmed"?/);
		assert.match(generatedPage, /tag: "?title"?/);
		assert.match(generatedPage, /property: "?og:title"?/);
		assert.match(generatedPage, /BreadcrumbList/);
		assert.match(generatedPage, /FAQPage/);
		const relatedSource = readFileSync(
			path.join(workspace, 'src/content/docs/game-info/system-requirements.md'),
			'utf8',
		);
		assert.match(relatedSource, /\/legacy-game\/classes\//);

		const generatedConfig = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generatedConfig, /slug: "legacy-game\/classes"/);
		assert.match(generatedConfig, /href: "\/legacy-game\/classes\/"/);
		assert.match(generatedConfig, /href: "\/routes\/getting-started\/"/);

		const hub = readFileSync(path.join(workspace, 'src/content/docs/index.mdx'), 'utf8');
		assert.doesNotMatch(hub, /^slug:/m);

		const validation = spawnSync(
			'npx',
			['tsx', path.join(ROOT, 'scripts/validate-generated-site.ts'), '--root', workspace],
			{ cwd: ROOT, encoding: 'utf8' },
		);
		assert.equal(validation.status, 0, validation.stdout + validation.stderr);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('12.10 guide slugs cannot replace reserved Experience paths', () => {
	for (const reservedSlug of ['guides', 'routes', 'gameplay']) {
		expectPatchedSpecFail(
			(raw) => raw.replace('    slug: beginner-guide', `    slug: ${reservedSlug}`),
			/collides with reserved|collision|reserved/i,
		);
	}
});

test('12.11 legacy frontmatter parity validates optional fields', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('    slug: beginner-guide', '    slug: beginner-guide\n    lastUpdated: 2026-13-99'),
		/lastUpdated|calendar date/i,
	);
	expectPatchedSpecFail(
		(raw) => raw.replace('    slug: beginner-guide', '    slug: beginner-guide\n    sidebarLabel: "   "'),
		/sidebarLabel|must not be empty/i,
	);
	expectPatchedSpecFail(
		(raw) => raw.replace('    slug: beginner-guide', '    slug: beginner-guide\n    head: title'),
		/head|array|list/i,
	);
});

test('12.12 page trust metadata generates, preserves editorial dates, and validates its contract', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const specPath = path.join(workspace, 'site-spec.yaml');
		let raw = readFileSync(specPath, 'utf8');
		raw = raw.replace('    slug: beginner-guide', [
			'    slug: beginner-guide',
			'    lastUpdated: 2026-08-20',
			'    trust:',
			'      status: verified',
			'      lastVerified: 2026-08-13',
			'      appliesTo:',
			'        - PC',
			'        - "Early Access 0.6"',
			'      sources:',
			'        - label: Official patch notes',
			'          type: official',
			'          url: https://example.com/patch-notes',
			'        - label: Direct gameplay observation',
			'          type: first-party',
			'        - label: Player discussion report',
			'          type: community',
			'        - label: Reference guide',
			'          type: secondary',
		].join('\n'));
		writeFileSync(specPath, raw, 'utf8');
		generateSite({ specPath, rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/content/docs/getting-started/beginner-guide.md'), 'utf8');
		assert.match(generated, /lastUpdated: "?2026-08-20"?/);
		assert.match(generated, /trust:/);
		assert.match(generated, /lastVerified: "?2026-08-13"?/);
		assert.match(generated, /label: "?Direct gameplay observation"?/);
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site', PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123456', VERCEL_ENV: 'production' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const html = readFileSync(path.join(workspace, 'dist/fixture-game/beginner-guide/index.html'), 'utf8');
		assert.match(html, /Content trust/);
		assert.match(html, /Verified/);
		assert.match(html, /Early Access 0\.6/);
		assert.match(html, /Official patch notes/);
		assert.match(html, /Direct gameplay observation/);
		assert.match(html, /Player discussion report/);
		assert.match(html, /Reference guide/);
		assert.match(html, /rel="noopener noreferrer"/);
		for (const status of ['provisional', 'outdated'] as const) {
			const statusSpec = raw.replace('      status: verified', `      status: ${status}`);
			writeFileSync(specPath, statusSpec, 'utf8');
			generateSite({ specPath, rootDir: workspace });
			const statusPage = readFileSync(path.join(workspace, 'src/content/docs/getting-started/beginner-guide.md'), 'utf8');
			assert.match(statusPage, new RegExp(`status: "?${status}"?`));
		}
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
	for (const [fragment, pattern] of [
		['status: unknown', /trust\.status|invalid/i],
		['lastVerified: 2026-02-30', /lastVerified|calendar date/i],
		['appliesTo:\n        - ""', /appliesTo|non-empty/i],
		['sources:\n        - label: Missing type', /trust source type|type/i],
		['sources:\n        - type: official', /label|required/i],
		['sources:\n        - label: Bad URL\n          type: official\n          url: nope', /URL|url/i],
	] as const) {
		expectPatchedSpecFail((raw) => raw.replace('    slug: beginner-guide', `    slug: beginner-guide\n    trust:\n      ${fragment.replace(/\n        /g, '\n      ')}`), pattern);
	}
});

test('integration build includes trust pages when enabled', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const aboutHtml = readFileSync(path.join(workspace, 'dist/fixture-game/about/index.html'), 'utf8');
		const privacyHtml = readFileSync(path.join(workspace, 'dist/fixture-game/privacy/index.html'), 'utf8');
		const hubHtml = readFileSync(path.join(workspace, 'dist/fixture-game/index.html'), 'utf8');
		assert.doesNotMatch(aboutHtml, /content="noindex/i);
		assert.match(privacyHtml, /content="noindex,follow"/i);
		assert.doesNotMatch(aboutHtml, /Related Guides|相关攻略/);
		assert.doesNotMatch(aboutHtml, /class="gw-crumb"/);
		assert.doesNotMatch(aboutHtml, /class="gw-article-meta"/);
		assert.match(hubHtml, /关于本站/);
		assert.match(hubHtml, /隐私说明/);
		const sitemap = readFileSync(path.join(workspace, 'dist/sitemap-0.xml'), 'utf8');
		assert.match(sitemap, /\/fixture-game\/about\//);
		assert.match(sitemap, /\/fixture-game\/editorial-method\//);
		assert.doesNotMatch(sitemap, /\/fixture-game\/privacy\//);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

const ANALYTICS_ENABLED_BLOCK = `
analytics:
  enabled: true
  ga4:
    enabled: true
`;

test('13.1 no analytics config omits runtime analytics', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.doesNotMatch(generated, /\banalytics:\s*\{/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('13.2 analytics.enabled false omits runtime analytics', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		appendTrustSpec(
			workspace,
			`
analytics:
  enabled: false
`,
		);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.doesNotMatch(generated, /\banalytics:\s*\{/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('13.3 enabled ga4 with privacy emits the environment-driven runtime switch', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace);
		appendTrustSpec(workspace, ANALYTICS_ENABLED_BLOCK);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /ga4: \{ enabled: true \}/);
		assert.doesNotMatch(generated, /measurementId/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('13.4 missing measurementId fails before writes', () => {
	expectPatchedSpecFail(
		(raw) =>
			`${raw.trimEnd()}\n${TRUST_SPEC_BLOCK}\nanalytics:\n  enabled: true\n  provider: ga4\n`,
		/measurementId/i,
	);
});

test('13.5 invalid analytics provider fails before writes', () => {
	expectPatchedSpecFail(
		(raw) =>
			`${raw.trimEnd()}\n${TRUST_SPEC_BLOCK}\nanalytics:\n  enabled: true\n  provider: plausible\n  measurementId: G-TEST123456\n`,
		/provider|ga4|plausible/i,
	);
});

test('13.6 invalid GA4 measurementId fails before writes', () => {
	expectPatchedSpecFail(
		(raw) =>
			`${raw.trimEnd()}\n${TRUST_SPEC_BLOCK}\nanalytics:\n  enabled: true\n  provider: ga4\n  measurementId: UA-123456\n`,
		/measurementId|GA4/i,
	);
});

test('13.7 GA4 enabled without Privacy fails', () => {
	expectPatchedSpecFail(
		(raw) => `${raw.trimEnd()}\n${ANALYTICS_ENABLED_BLOCK}\n`,
		/GA4 analytics requires an enabled Privacy page/i,
	);
});

test('13.8 trackOutbound false is preserved in generated config', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace);
		appendTrustSpec(
			workspace,
			`
analytics:
  enabled: true
  provider: ga4
  measurementId: G-TEST123456
  trackOutbound: false
`,
		);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /trackOutbound: false/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('integration build includes GA4 config only when enabled', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace);
		appendTrustSpec(workspace, ANALYTICS_ENABLED_BLOCK);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site', PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123456', VERCEL_ENV: 'production' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const hubHtml = readFileSync(path.join(workspace, 'dist/fixture-game/index.html'), 'utf8');
		const overviewHtml = readFileSync(
			path.join(workspace, 'dist/fixture-game/gameplay-overview/index.html'),
			'utf8',
		);
		assert.match(hubHtml, /id="gw-analytics-config"/);
		assert.match(hubHtml, /G-TEST123456/);
		assert.match(hubHtml, /googletagmanager\.com/);
		assert.equal((hubHtml.match(/googletagmanager\.com/g) ?? []).length, 1);
		assert.equal((hubHtml.match(/gtag\('config'/g) ?? []).length, 1);
		assert.doesNotMatch(hubHtml, /page_view/);
		assert.doesNotMatch(hubHtml, /"trackOutbound"/);
		assert.match(overviewHtml, /data-outbound-kind="source"/);
		assert.match(overviewHtml, /data-outbound-kind="evidence"/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('integration build omits outbound script when trackOutbound is false', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace);
		appendTrustSpec(
			workspace,
			`
analytics:
  enabled: true
  provider: ga4
  measurementId: G-TEST123456
  trackOutbound: false
`,
		);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site', PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123456', VERCEL_ENV: 'production' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const hubHtml = readFileSync(path.join(workspace, 'dist/fixture-game/index.html'), 'utf8');
		assert.match(hubHtml, /id="gw-analytics-config"/);
		assert.match(hubHtml, /"trackOutbound":false/);
		assert.doesNotMatch(hubHtml, /attachOutboundTracking/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('integration fixture suppresses GA4 for disabled, missing-ID, preview, and development builds', { timeout: 240_000 }, () => {
	for (const scenario of [
		{ name: 'disabled', block: '\nanalytics:\n  enabled: false\n', env: { PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123456', VERCEL_ENV: 'production' } },
		{ name: 'missing-id', block: ANALYTICS_ENABLED_BLOCK, env: { VERCEL_ENV: 'production' } },
		{ name: 'preview', block: ANALYTICS_ENABLED_BLOCK, env: { PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123456', VERCEL_ENV: 'preview' } },
	] as const) {
		const workspace = copyTemplateWorkspace();
		try {
			installFixture(workspace, 'valid-site');
			installTrustInputs(workspace);
			appendTrustSpec(workspace);
			appendSpecBlock(workspace, scenario.block);
			generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
			const build = spawnSync('npx', ['astro', 'build'], {
				cwd: workspace,
				encoding: 'utf8',
				env: { ...process.env, VALIDATE_MODE: 'generated-site', ...scenario.env },
			});
			assert.equal(build.status, 0, `${scenario.name}: ${build.stdout}\n${build.stderr}`);
			const hubHtml = readFileSync(path.join(workspace, 'dist/fixture-game/index.html'), 'utf8');
			assert.doesNotMatch(hubHtml, /gw-analytics-config|googletagmanager\.com/, scenario.name);
		} finally {
			rmSync(workspace, { recursive: true, force: true });
		}
	}
});

test('13.9 G014 analytics contract propagates identity and provider switches without IDs', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace);
		appendSpecBlock(workspace, `
analytics:
  siteId: fixture-game
  gameSlug: fixture-game
  templateVersion: game-wiki-starter-v2.0.1
  launchDate: 2026-08-29
  ga4:
    enabled: true
  vercelAnalytics:
    enabled: false
`);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /siteId: "fixture-game"/);
		assert.match(generated, /gameSlug: "fixture-game"/);
		assert.match(generated, /templateVersion: "game-wiki-starter-v2\.0\.1"/);
		assert.match(generated, /launchDate: "2026-08-29"/);
		assert.match(generated, /ga4: \{ enabled: true \}/);
		assert.match(generated, /vercelAnalytics: \{ enabled: false \}/);
		assert.doesNotMatch(generated, /measurementId/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('13.10 analytics contract rejects invalid identity and provider types', () => {
	for (const [field, value, pattern] of [
		['siteId', 'Not Stable', /siteId|kebab/i],
		['gameSlug', 42, /gameSlug|string/i],
		['templateVersion', '2/0/1', /templateVersion/i],
		['launchDate', '2026-02-30', /launchDate|YYYY-MM-DD/i],
		['ga4', 'yes', /ga4|mapping/i],
		['vercelAnalytics', [], /vercelAnalytics|mapping/i],
	] as const) {
		expectPatchedSpecFail(
			(raw) => `${raw.trimEnd()}\nanalytics:\n  siteId: fixture-game\n  gameSlug: fixture-game\n  templateVersion: game-wiki-starter-v2.0.1\n  launchDate: 2026-08-29\n  ga4:\n    enabled: false\n  vercelAnalytics:\n    enabled: false\n`.replace(new RegExp(`  ${field}:.*\\n`), `  ${field}: ${typeof value === 'string' ? value : JSON.stringify(value)}\n`),
			pattern,
		);
	}
});

test('13.11 placement vocabulary and page-path normalization are centralized', () => {
	assert.deepEqual([...ANALYTICS_PLACEMENTS], [
		'hero', 'popular_questions', 'start_here', 'browse_guides',
		'recently_updated', 'guide_internal_link', 'navigation',
	]);
	assert.equal(normalizeAnalyticsPath('guide?ref=nav'), '/guide/');
	assert.equal(normalizeAnalyticsPath('/'), '/');
});

test('13.12 GA4 enablement is production-only and ID-safe', () => {
	assert.equal(resolveAnalyticsEnvironment({ isProd: false }), 'development');
	assert.equal(resolveAnalyticsEnvironment({ isProd: true, vercelEnv: 'preview' }), 'preview');
	assert.equal(resolveAnalyticsEnvironment({ isProd: true, vercelEnv: 'production' }), 'production');
	assert.equal(shouldLoadGa4({ analyticsEnabled: true, ga4Enabled: true, measurementId: 'G-TEST123456', environment: 'production' }), true);
	assert.equal(shouldLoadGa4({ analyticsEnabled: false, ga4Enabled: true, measurementId: 'G-TEST123456', environment: 'production' }), false);
	assert.equal(shouldLoadGa4({ analyticsEnabled: true, ga4Enabled: true, measurementId: undefined, environment: 'production' }), false);
	assert.equal(shouldLoadGa4({ analyticsEnabled: true, ga4Enabled: true, measurementId: 'G-TEST123456', environment: 'preview' }), false);
	assert.equal(shouldLoadGa4({ analyticsEnabled: true, ga4Enabled: true, measurementId: 'G-TEST123456', environment: 'development' }), false);
});

test('13.13 Vercel Analytics enablement is production-only', () => {
	assert.equal(shouldLoadVercelAnalytics({ analyticsEnabled: true, vercelAnalyticsEnabled: true, environment: 'production' }), true);
	assert.equal(shouldLoadVercelAnalytics({ analyticsEnabled: false, vercelAnalyticsEnabled: true, environment: 'production' }), false);
	assert.equal(shouldLoadVercelAnalytics({ analyticsEnabled: true, vercelAnalyticsEnabled: true, environment: 'preview' }), false);
	assert.equal(shouldLoadVercelAnalytics({ analyticsEnabled: true, vercelAnalyticsEnabled: true, environment: 'development' }), false);
});

test('13.14 core interaction adapter validates identity, title, path, and placement', () => {
	assert.deepEqual([...CORE_INTERACTION_EVENTS], ['guide_click', 'popular_question_click', 'start_here_click']);
	const identity = { siteId: 'fixture-game', gameSlug: 'fixture-game', templateVersion: 'game-wiki-starter-v2.0.1' };
	for (const [eventName, placement] of [
		['guide_click', 'browse_guides'],
		['popular_question_click', 'popular_questions'],
		['start_here_click', 'start_here'],
	] as const) {
		const event = buildCoreInteractionEvent({
			eventName,
			identity,
			linkTitle: '  Example title  ',
			targetPath: '/fixture-game/example-guide?ref=home',
			placement,
		});
		assert.deepEqual(event, {
			name: eventName,
			params: {
				site_id: 'fixture-game',
				game_slug: 'fixture-game',
				template_version: 'game-wiki-starter-v2.0.1',
				link_title: 'Example title',
				target_path: '/fixture-game/example-guide/',
				placement,
			},
		});
	}
	assert.equal(buildCoreInteractionEvent({ eventName: 'guide_click', identity, linkTitle: 'Guide', targetPath: '/guide/', placement: 'popular_questions' })?.name, 'guide_click');
	assert.equal(buildCoreInteractionEvent({ eventName: 'unknown', identity, linkTitle: 'Guide', targetPath: '/guide/', placement: 'browse_guides' }), null);
	assert.equal(buildCoreInteractionEvent({ eventName: 'guide_click', identity: {}, linkTitle: 'Guide', targetPath: '/guide/', placement: 'browse_guides' }), null);
});

test('integration fixture emits core interaction hooks through the GA4 path', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace);
		appendSpecBlock(workspace, `
analytics:
  siteId: fixture-game
  gameSlug: fixture-game
  templateVersion: game-wiki-starter-v2.0.1
  launchDate: 2026-08-29
  ga4:
    enabled: true
  vercelAnalytics:
    enabled: false
`);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site', PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123456', VERCEL_ENV: 'production' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const hubHtml = readFileSync(path.join(workspace, 'dist/fixture-game/index.html'), 'utf8');
		assert.match(hubHtml, /data-analytics-event="popular_question_click"/);
		assert.doesNotMatch(hubHtml, /data-analytics-event="start_here_click"/);
		assert.match(hubHtml, /data-analytics-event="guide_click"/);
		assert.match(hubHtml, /siteId.*fixture-game/);
		assert.match(hubHtml, /site_id/);
		assert.match(hubHtml, /popular_question_click/);
		assert.doesNotMatch(hubHtml, /data-analytics-event="start_here_click"/);
		assert.match(hubHtml, /guide_click/);
		assert.doesNotMatch(hubHtml, /track\(/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('integration fixture renders Vercel Analytics once only in production', { timeout: 180_000 }, () => {
	for (const scenario of [
		{ name: 'production', block: '\nanalytics:\n  enabled: true\n  vercelAnalytics:\n    enabled: true\n', env: { VERCEL_ENV: 'production' }, expected: true },
		{ name: 'disabled', block: '\nanalytics:\n  enabled: false\n', env: { VERCEL_ENV: 'production' }, expected: false },
		{ name: 'preview', block: '\nanalytics:\n  enabled: true\n  vercelAnalytics:\n    enabled: true\n', env: { VERCEL_ENV: 'preview' }, expected: false },
	] as const) {
		const workspace = copyTemplateWorkspace();
		try {
			installFixture(workspace, 'valid-site');
			appendSpecBlock(workspace, scenario.block);
			generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
			const build = spawnSync('npx', ['astro', 'build'], {
				cwd: workspace,
				encoding: 'utf8',
				env: { ...process.env, VALIDATE_MODE: 'generated-site', ...scenario.env },
			});
			assert.equal(build.status, 0, `${scenario.name}: ${build.stdout}\n${build.stderr}`);
			const hubHtml = readFileSync(path.join(workspace, 'dist/fixture-game/index.html'), 'utf8');
			if (scenario.expected) {
				assert.equal((hubHtml.match(/<vercel-analytics/g) ?? []).length, 1);
				assert.match(hubHtml, /vercel-analytics/);
			} else {
				assert.doesNotMatch(hubHtml, /<vercel-analytics|_vercel\/insights\//);
			}
		} finally {
			rmSync(workspace, { recursive: true, force: true });
		}
	}
});

test('14.1 social config omitted still generates', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const specPath = path.join(workspace, 'site-spec.yaml');
		let spec = readFileSync(specPath, 'utf8');
		spec = spec.replace(/\n    socialImage:\n      asset: social\/guide-og.svg\n      alt: Fixture Game gameplay overview social preview/, '');
		spec = spec.replace(/\n  - id: default-og[\s\S]*?usageStatus: approved\n  - id: guide-og[\s\S]*?usageStatus: approved/, '');
		spec = spec.replace(/\nsocial:\n  defaultImage:\n    asset: social\/default-og.svg\n    alt: Fixture Game guides and wiki/, '');
		writeFileSync(specPath, spec, 'utf8');
		generateSite({ specPath, rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.doesNotMatch(generated, /\bsocial:\s*\{/);
		assert.doesNotMatch(generated, /socialImage:/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('14.2 unknown default social asset fails', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('asset: social/default-og.svg', 'asset: social/missing.webp'),
		/defaultImage|assets\[\]\.target|missing/i,
	);
});

test('14.3 empty default social alt fails', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('alt: Fixture Game guides and wiki', 'alt: ""'),
		/alt|empty/i,
	);
});

test('14.4 unknown page socialImage asset fails', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('asset: social/guide-og.svg', 'asset: social/missing-guide.webp'),
		/socialImage|assets\[\]\.target|missing/i,
	);
});

test('14.5 empty page socialImage alt fails', () => {
	expectPatchedSpecFail(
		(raw) => raw.replace('alt: Fixture Game gameplay overview social preview', 'alt: ""'),
		/alt|empty/i,
	);
});

test('14.6 no social image omits og:image in HTML', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		const specPath = path.join(workspace, 'site-spec.yaml');
		let spec = readFileSync(specPath, 'utf8');
		spec = spec.replace(/\n    socialImage:\n      asset: social\/guide-og.svg\n      alt: Fixture Game gameplay overview social preview/, '');
		spec = spec.replace(/\nsocial:\n  defaultImage:\n    asset: social\/default-og.svg\n    alt: Fixture Game guides and wiki/, '');
		writeFileSync(specPath, spec, 'utf8');
		generateSite({ specPath, rootDir: workspace });
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const hubHtml = readFileSync(path.join(workspace, 'dist/fixture-game/index.html'), 'utf8');
		assert.doesNotMatch(hubHtml, /property="og:image"/);
		assert.doesNotMatch(hubHtml, /name="twitter:image"/);
		assert.equal(countMetaByName(hubHtml, 'twitter:card'), 1);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('14.7 root hubPath social URLs stay absolute and public', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		const specPath = path.join(workspace, 'site-spec.yaml');
		let specRaw = readFileSync(specPath, 'utf8').replace('hubPath: /fixture-game/', 'hubPath: /');
		specRaw = `${specRaw.trimEnd()}\n${TRUST_SPEC_BLOCK}\n`;
		writeFileSync(specPath, specRaw, 'utf8');
		generateSite({ specPath, rootDir: workspace });
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const guideHtml = readFileSync(path.join(workspace, 'dist/gameplay-overview/index.html'), 'utf8');
		const hubHtml = readFileSync(path.join(workspace, 'dist/index.html'), 'utf8');
		const aboutHtml = readFileSync(path.join(workspace, 'dist/about/index.html'), 'utf8');
		assert.match(guideHtml, /property="og:image"/);
		assert.match(guideHtml, /content="https:\/\/fixture-wiki\.example\//);
		assert.match(guideHtml, /Fixture Game gameplay overview social preview/);
		assert.match(hubHtml, /Fixture Game guides and wiki/);
		assert.match(aboutHtml, /Fixture Game guides and wiki/);
		assert.equal(countMetaByProperty(guideHtml, 'og:image'), 1);
		assert.match(
			guideHtml,
			/property="og:url"[^>]*content="https:\/\/fixture-wiki\.example\/gameplay-overview\/"|content="https:\/\/fixture-wiki\.example\/gameplay-overview\/"[^>]*property="og:url"/,
		);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

const MONETIZATION_ENABLED_BLOCK = `
monetization:
  enabled: true
  affiliate:
    enabled: true
    disclosure: true
    source: site-input/trust/affiliate-disclosure.md
  ads:
    enabled: true
`;

test('15.1 no monetization config omits runtime monetization', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.doesNotMatch(generated, /\bmonetization:\s*\{/);
		assert.equal(existsSync(path.join(workspace, 'src/content/trust/affiliate-disclosure.md')), false);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('15.2 monetization.enabled false omits commercial output', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		appendTrustSpec(
			workspace,
			`
monetization:
  enabled: false
  affiliate:
    enabled: true
    disclosure: true
  ads:
    enabled: true
`,
		);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.doesNotMatch(generated, /\bmonetization:\s*\{/);
		assert.equal(existsSync(path.join(workspace, 'src/content/trust/affiliate-disclosure.md')), false);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('15.3 affiliate disclosure generates page and runtime trust entry', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		appendTrustSpec(workspace, MONETIZATION_ENABLED_BLOCK);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		assert.ok(existsSync(path.join(workspace, 'src/content/trust/affiliate-disclosure.md')));
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /monetization:\s*\{/);
		assert.match(generated, /affiliateDisclosure:\s*\{/);
		assert.match(generated, /path: "\/fixture-game\/affiliate-disclosure\/"/);
		assert.match(generated, /ads:\s*\{\s*enabled: true/);
		const disclosure = readFileSync(path.join(workspace, 'src/content/trust/affiliate-disclosure.md'), 'utf8');
		assert.match(disclosure, /trustType: "?affiliateDisclosure"?/);
		assert.match(disclosure, /robots: "?noindex,follow"?/);
		assert.match(disclosure, /may earn a commission/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('15.4 affiliate disclosure without source fails before writes', () => {
	expectPatchedSpecFail(
		(raw) =>
			`${raw.trimEnd()}\nmonetization:\n  enabled: true\n  affiliate:\n    enabled: true\n    disclosure: true\n`,
		/source/i,
	);
});

test('15.5 affiliate enabled with disclosure false does not require source', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		appendTrustSpec(
			workspace,
			`
monetization:
  enabled: true
  affiliate:
    enabled: true
    disclosure: false
  ads:
    enabled: false
`,
		);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /disclosure: false/);
		assert.doesNotMatch(generated, /affiliateDisclosure:\s*\{/);
		assert.equal(existsSync(path.join(workspace, 'src/content/trust/affiliate-disclosure.md')), false);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('integration build includes monetization hooks when enabled', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		installTrustInputs(workspace);
		writeFileSync(
			path.join(workspace, 'site-input/pages/beginner-guide.md'),
			`${readFileSync(path.join(workspace, 'site-input/pages/beginner-guide.md'), 'utf8').trimEnd()}\n\n[Steam](https://store.steampowered.com/app/1/ "affiliate")\n`,
			'utf8',
		);
		appendTrustSpec(workspace, MONETIZATION_ENABLED_BLOCK);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		const hubHtml = readFileSync(path.join(workspace, 'dist/fixture-game/index.html'), 'utf8');
		const beginnerHtml = readFileSync(
			path.join(workspace, 'dist/fixture-game/beginner-guide/index.html'),
			'utf8',
		);
		const disclosureHtml = readFileSync(
			path.join(workspace, 'dist/fixture-game/affiliate-disclosure/index.html'),
			'utf8',
		);
		assert.match(hubHtml, /联盟披露|Affiliate Disclosure/);
		assert.match(hubHtml, /data-ad-slot="hub-after-start-here"/);
		assert.doesNotMatch(hubHtml, /adsbygoogle|googlesyndication|ezoic|mediavine|raptive/i);
		assert.match(beginnerHtml, /data-ad-slot="guide-before-related"/);
		assert.match(beginnerHtml, /rel="sponsored"/);
		assert.match(beginnerHtml, /data-outbound-kind="affiliate"/);
		assert.match(beginnerHtml, /href="https:\/\/store\.steampowered\.com\/app\/1\/"/);
		assert.doesNotMatch(beginnerHtml, /gw-analytics-config/);
		const answerAt = beginnerHtml.indexOf('exp-quick-answer');
		const adAt = beginnerHtml.indexOf('data-ad-slot="guide-before-related"');
		assert.ok(answerAt >= 0 && adAt > answerAt, 'ad slot must come after Quick Answer');
		assert.match(disclosureHtml, /content="noindex,follow"/);
		assert.doesNotMatch(disclosureHtml, /Related Guides|相关攻略/);
		const sitemap = readFileSync(path.join(workspace, 'dist/sitemap-0.xml'), 'utf8');
		assert.doesNotMatch(sitemap, /\/fixture-game\/affiliate-disclosure\//);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

const ROUTES_SPEC_BLOCK = `
routes:
  - id: getting-started
    eyebrow: New Player Route
    title: Getting Started
    description: Everything you need before your first serious run.
    fastAnswers:
      - question: How do I get started?
        answer: Begin with the Beginner Guide.
        pageId: beginner-guide
      - question: What should I check first?
        answer: Confirm the system requirements first.
        pageId: system-requirements
      - question: What should I learn first?
        answer: Understand the core gameplay loop.
        pageId: gameplay-overview
    pages:
      - beginner-guide
      - system-requirements
      - gameplay-overview
  - id: core-gameplay
    title: Core Gameplay
    description: The gameplay loop and the systems behind encounters.
    pages:
      - gameplay-overview
      - beginner-guide
  - id: world-exploration
    title: World & Exploration
    description: How to move through the world.
    visualAssetId: gameplay-still
    pages:
      - gameplay-overview
`;

test('16.1 routes parse and generate resolved runtime config', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		appendSpecBlock(workspace, ROUTES_SPEC_BLOCK);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /\broutes: \[/);
		assert.match(generated, /id: "getting-started"/);
		assert.match(generated, /eyebrow: "New Player Route"/);
		assert.match(generated, /title: "Getting Started"/);
		assert.match(generated, /href: "\/fixture-game\/routes\/getting-started\/"/);
		assert.match(generated, /href: "\/fixture-game\/routes\/core-gameplay\/"/);
		assert.match(generated, /href: "\/fixture-game\/routes\/world-exploration\/"/);
		// Resolved page view model: pageId + href + title + description + eyebrow.
		assert.match(generated, /pageId: "beginner-guide"/);
		assert.match(generated, /href: "\/fixture-game\/beginner-guide\/"/);
		assert.match(generated, /title: "新手入门指南"/);
		assert.match(generated, /eyebrow: "Starter Route"/);
		// gameplay-overview cover resolves from coverAssetId: gameplay-still → evidence/gameplay.svg.
		assert.match(generated, /image: "evidence\/gameplay\.svg"/);
		// Route visual resolves from visualAssetId: gameplay-still.
		assert.match(generated, /visual: "evidence\/gameplay\.svg"/);
		// Fast answers carry question / answer / pageId / href.
		assert.match(generated, /fastAnswers: \[/);
		assert.match(generated, /question: "How do I get started\?"/);
		assert.match(generated, /answer: "Begin with the Beginner Guide\."/);
		assert.match(generated, /href: "\/fixture-game\/system-requirements\/"/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('16.2 route page order is preserved (no alphabetic sort)', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		appendSpecBlock(workspace, ROUTES_SPEC_BLOCK);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		const routesStart = generated.indexOf('routes: [');
		const nextRoute = generated.indexOf('id: "core-gameplay"', routesStart);
		const section = generated.slice(routesStart, nextRoute);
		const beginner = section.indexOf('pageId: "beginner-guide"');
		const system = section.indexOf('pageId: "system-requirements"');
		const gameplay = section.indexOf('pageId: "gameplay-overview"');
		assert.ok(beginner >= 0 && system > beginner && gameplay > system, 'route pages must keep spec order');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('16.3 a page can belong to multiple routes', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		appendSpecBlock(workspace, ROUTES_SPEC_BLOCK);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		// gameplay-overview is in getting-started, core-gameplay, and world-exploration.
		assert.ok(generated.match(/pageId: "gameplay-overview"/g)!.length >= 3, 'gameplay-overview must appear in 3 routes');
		// beginner-guide is in getting-started and core-gameplay.
		assert.ok(generated.match(/pageId: "beginner-guide"/g)!.length >= 2, 'beginner-guide must appear in 2 routes');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('16.4 backward compatibility: spec without routes emits no routes config', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.doesNotMatch(generated, /\broutes:\s*\[/);
		const second = generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		assert.equal(second.written.length, 0, 'no routes output keeps generation idempotent');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

function expectRoutesSpecFail(block: string, pattern: RegExp) {
	expectPatchedSpecFail((raw) => `${raw.trimEnd()}\n${block}\n`, pattern);
}

test('16.5 duplicate route id fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: First.
    pages:
      - beginner-guide
  - id: getting-started
    title: Second Route
    description: Second.
    pages:
      - system-requirements
`,
		/Duplicate route id/i,
	);
});

test('16.6 invalid kebab-case route id fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: Getting Started
    title: A Route
    description: Its description.
    pages:
      - beginner-guide
`,
		/kebab-case/i,
	);
});

test('16.7 empty route title fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: ""
    description: Its description.
    pages:
      - beginner-guide
`,
		/title|empty/i,
	);
});

test('16.8 empty route description fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: ""
    pages:
      - beginner-guide
`,
		/description|empty/i,
	);
});

test('16.9 empty route pages fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: Its description.
    pages: []
`,
		/at least 1|pages/i,
	);
});

test('16.10 unknown page in route pages fails before writes', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: Its description.
    pages:
      - fake-guide
`,
		/unknown pageId|fake-guide/i,
	);
});

test('16.11 unknown fastAnswer pageId fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: Its description.
    fastAnswers:
      - question: Q
        answer: A
        pageId: fake-guide
    pages:
      - beginner-guide
`,
		/unknown pageId|fake-guide/i,
	);
});

test('16.12 fastAnswer target outside route pages fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: Its description.
    fastAnswers:
      - question: Q
        answer: A
        pageId: system-requirements
    pages:
      - beginner-guide
`,
		/not in that route's pages|system-requirements/i,
	);
});

test('16.13 more than 3 fastAnswers fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: Its description.
    fastAnswers:
      - question: Q1
        answer: A1
        pageId: beginner-guide
      - question: Q2
        answer: A2
        pageId: beginner-guide
      - question: Q3
        answer: A3
        pageId: beginner-guide
      - question: Q4
        answer: A4
        pageId: beginner-guide
    pages:
      - beginner-guide
`,
		/at most 3/i,
	);
});

test('16.14 empty fastAnswer question fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: Its description.
    fastAnswers:
      - question: ""
        answer: A
        pageId: beginner-guide
    pages:
      - beginner-guide
`,
		/question|empty/i,
	);
});

test('16.15 empty fastAnswer answer fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: Its description.
    fastAnswers:
      - question: Q
        answer: ""
        pageId: beginner-guide
    pages:
      - beginner-guide
`,
		/answer|empty/i,
	);
});

test('16.16 unknown route visualAssetId fails', () => {
	expectRoutesSpecFail(
		`routes:
  - id: getting-started
    title: A Route
    description: Its description.
    visualAssetId: missing-asset
    pages:
      - beginner-guide
`,
		/unknown asset|missing-asset/i,
	);
});

test('16.17 visualAssetId null is allowed (content-only route)', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		appendSpecBlock(
			workspace,
			`routes:
  - id: content-only-route
    title: A Route
    description: Its description.
    visualAssetId: null
    pages:
      - beginner-guide
`,
		);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const generated = readFileSync(path.join(workspace, 'src/config/site.generated.ts'), 'utf8');
		assert.match(generated, /id: "content-only-route"/);
		assert.doesNotMatch(generated, /visual:/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('integration build passes when generated config includes routes', { timeout: 180_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		appendSpecBlock(workspace, ROUTES_SPEC_BLOCK);
		generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
		const build = spawnSync('npx', ['astro', 'build'], {
			cwd: workspace,
			encoding: 'utf8',
			env: { ...process.env, VALIDATE_MODE: 'generated-site' },
		});
		assert.equal(build.status, 0, build.stdout + build.stderr);
		// Hub mode retains the path-prefixed Route Hub output.
		assert.ok(existsSync(path.join(workspace, 'dist/fixture-game/routes/getting-started/index.html')));
		assert.ok(existsSync(path.join(workspace, 'dist/routes/getting-started/index.html')));
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});
