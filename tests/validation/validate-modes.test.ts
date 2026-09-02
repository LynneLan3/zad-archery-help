import assert from 'node:assert/strict';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { generateSite } from '../../scripts/lib/generator';
import { runValidateGenerated } from '../../scripts/lib/run-validate-generated';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = path.join(ROOT, 'tests/site-generator/fixtures');

function copyTemplateWorkspace(): string {
	mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
	const dir = mkdtempSync(path.join(ROOT, 'tmp', 'gws-validation-'));
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
	symlinkSync(path.relative(dir, path.join(ROOT, 'node_modules')), path.join(dir, 'node_modules'));
	return dir;
}

function installFixture(workspace: string, fixtureName: string) {
	const fixtureDir = path.join(FIXTURES, fixtureName);
	cpSync(path.join(fixtureDir, 'site-spec.yaml'), path.join(workspace, 'site-spec.yaml'));
	if (existsSync(path.join(fixtureDir, 'site-input'))) {
		cpSync(path.join(fixtureDir, 'site-input'), path.join(workspace, 'site-input'), { recursive: true });
	}
}

test('validate:generated workflow source never invokes verify:template', () => {
	const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
		scripts: Record<string, string>;
	};
	assert.equal(pkg.scripts.validate, 'npm run validate:template');
	assert.match(pkg.scripts['validate:template']!, /verify:template/);
	assert.equal(pkg.scripts['validate:generated'], 'tsx ./scripts/validate-generated-site.ts');

	const cli = readFileSync(path.join(ROOT, 'scripts/validate-generated-site.ts'), 'utf8');
	const lib = readFileSync(path.join(ROOT, 'scripts/lib/run-validate-generated.ts'), 'utf8');
	assert.match(cli, /skipped: verify:template/);
	assert.doesNotMatch(cli, /npm run verify:template|verify-template\.mjs/);
	assert.doesNotMatch(lib, /npm run verify:template|verify-template\.mjs/);
	assert.doesNotMatch(lib, /npm run test:context|npm run test:generator/);
	assert.equal((lib.match(/runNpmScript\(/g) ?? []).length, 4); // 1 definition + 3 call sites
	assert.match(lib, /\['validate:site', '--', '--mode=generated-site'\]/);
	assert.match(lib, /runNpmScript\(absRoot, \['check'\], stepsRun, 'astro-check'\)/);
	assert.match(lib, /runNpmScript\(absRoot, \['build'\], stepsRun, 'astro-build'\)/);
	assert.doesNotMatch(lib, /runNpmScript\([^)]*verify:template/);
	assert.doesNotMatch(lib, /runNpmScript\([^)]*test:context/);
	assert.doesNotMatch(lib, /runNpmScript\([^)]*test:generator/);
});

test('missing manifest fails validate:generated before Astro steps', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		assert.equal(existsSync(path.join(workspace, '.site-generator-manifest.json')), false);
		const result = runValidateGenerated(workspace, {
			runAstroCheck: false,
			runAstroBuild: false,
		});
		assert.equal(result.ok, false);
		assert.equal(result.failedStep, 'assert-manifest');
		assert.match(result.message ?? '', /Missing \.site-generator-manifest\.json/);
		assert.deepEqual(result.stepsRun, ['assert-manifest']);
		assert.ok(!result.stepsRun.includes('verify:template'));
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('managed output drift fails validate:generated', () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({
			specPath: path.join(workspace, 'site-spec.yaml'),
			rootDir: workspace,
		});
		const target = path.join(workspace, 'src/config/site.generated.ts');
		writeFileSync(target, `${readFileSync(target, 'utf8')}\n// drifted\n`, 'utf8');

		const result = runValidateGenerated(workspace, {
			runAstroCheck: false,
			runAstroBuild: false,
		});
		assert.equal(result.ok, false);
		assert.equal(result.failedStep, 'generator-check');
		assert.match(result.message ?? '', /drift|site\.generated\.ts/i);
		assert.ok(result.stepsRun.includes('assert-manifest'));
		assert.ok(result.stepsRun.includes('generator-check'));
		assert.ok(!result.stepsRun.includes('verify:template'));
		assert.ok(!result.stepsRun.includes('astro-check'));
		assert.ok(!result.stepsRun.includes('astro-build'));
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('validate:generated succeeds for valid-site fixture and never calls verify:template', {
	timeout: 180_000,
}, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installFixture(workspace, 'valid-site');
		generateSite({
			specPath: path.join(workspace, 'site-spec.yaml'),
			rootDir: workspace,
		});

		// Poison verify:template so any accidental call would fail loudly.
		writeFileSync(
			path.join(workspace, 'scripts/verify-template.mjs'),
			[
				'#!/usr/bin/env node',
				'import { writeFileSync } from "node:fs";',
				'writeFileSync(new URL("./verify-template-was-called", import.meta.url), "called\\n");',
				'console.error("verify:template must not run in validate:generated");',
				'process.exit(1);',
				'',
			].join('\n'),
			'utf8',
		);

		const result = runValidateGenerated(workspace);
		assert.equal(result.ok, true, result.message ?? 'validate:generated failed');
		assert.deepEqual(result.stepsRun, [
			'assert-manifest',
			'generator-check',
			'validate:site:generated-site',
			'astro-check',
			'astro-build',
			'generated-structure',
		]);
		assert.equal(existsSync(path.join(workspace, 'scripts/verify-template-was-called')), false);
		assert.ok(existsSync(path.join(workspace, 'dist/fixture-game/index.html')));
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('clean template validate:template succeeds', { timeout: 180_000 }, () => {
	assert.equal(existsSync(path.join(ROOT, 'site-spec.yaml')), false);
	assert.equal(existsSync(path.join(ROOT, '.site-generator-manifest.json')), false);
	const result = spawnSync('npm', ['run', 'validate:template'], {
		cwd: ROOT,
		encoding: 'utf8',
		env: process.env,
	});
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.match(result.stdout, /verify:template OK/);
	assert.match(result.stdout, /validate:site — mode=template/);
});
