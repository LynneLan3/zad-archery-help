import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { generateSite } from '../../scripts/lib/generator';
import { readIndexNowKey, INDEXNOW_KEY_REL } from '../../src/lib/indexnow';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TMP_DIR = path.join(ROOT, 'tmp');

function createWorkspace(): string {
	mkdirSync(TMP_DIR, { recursive: true });
	const dir = mkdtempSync(path.join(TMP_DIR, 'indexnow-'));
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

function installFixture(workspace: string) {
	const fixtureDir = path.join(ROOT, 'tests/site-generator/fixtures/valid-site');
	cpSync(path.join(fixtureDir, 'site-spec.yaml'), path.join(workspace, 'site-spec.yaml'));
	if (existsSync(path.join(fixtureDir, 'site-input'))) {
		cpSync(path.join(fixtureDir, 'site-input'), path.join(workspace, 'site-input'), { recursive: true });
	}
}

function specPath(workspace: string): string {
	return path.join(workspace, 'site-spec.yaml');
}

// ── Key lifecycle ──────────────────────────────────────────────────────

test('new site normal generate creates key', () => {
	const workspace = createWorkspace();
	try {
		installFixture(workspace);
		const result = generateSite({ specPath: specPath(workspace), rootDir: workspace });
		assert.equal(result.ok, true);

		const keyFile = path.join(workspace, INDEXNOW_KEY_REL);
		assert.ok(existsSync(keyFile), 'indexnow-key.json should exist');

		const keyData = readIndexNowKey(workspace);
		assert.ok(keyData, 'key data should be readable');
		assert.ok(keyData!.key, 'key should have a value');
		assert.ok(keyData!.createdAt, 'key should have createdAt');
		assert.ok(keyData!.siteUrl, 'key should have siteUrl');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('public/{KEY}.txt is created', () => {
	const workspace = createWorkspace();
	try {
		installFixture(workspace);
		generateSite({ specPath: specPath(workspace), rootDir: workspace });
		const keyData = readIndexNowKey(workspace)!;
		const keyTxt = path.join(workspace, `public/${keyData.key}.txt`);
		assert.ok(existsSync(keyTxt), 'public/{KEY}.txt should exist');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('key txt content equals key string', () => {
	const workspace = createWorkspace();
	try {
		installFixture(workspace);
		generateSite({ specPath: specPath(workspace), rootDir: workspace });
		const keyData = readIndexNowKey(workspace)!;
		const keyTxt = path.join(workspace, `public/${keyData.key}.txt`);
		const content = readFileSync(keyTxt, 'utf8');
		assert.equal(content, keyData.key);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('regenerate reuses key', () => {
	const workspace = createWorkspace();
	try {
		installFixture(workspace);
		generateSite({ specPath: specPath(workspace), rootDir: workspace });
		const key1 = readIndexNowKey(workspace)!;

		generateSite({ specPath: specPath(workspace), rootDir: workspace });
		const key2 = readIndexNowKey(workspace)!;

		assert.equal(key1.key, key2.key, 'key should be stable across regenerations');
		assert.equal(key1.createdAt, key2.createdAt, 'createdAt should be stable');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('repeated generate keeps key stable', () => {
	const workspace = createWorkspace();
	try {
		installFixture(workspace);
		generateSite({ specPath: specPath(workspace), rootDir: workspace });
		const key1 = readIndexNowKey(workspace)!.key;

		for (let i = 0; i < 3; i++) {
			generateSite({ specPath: specPath(workspace), rootDir: workspace });
		}
		const key2 = readIndexNowKey(workspace)!.key;

		assert.equal(key1, key2, 'key should remain stable after multiple regenerations');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

// ── siteUrl change ─────────────────────────────────────────────────────

test('siteUrl host change creates new key', () => {
	const workspace = createWorkspace();
	try {
		installFixture(workspace);
		// First generate with original siteUrl
		generateSite({ specPath: specPath(workspace), rootDir: workspace });
		const key1 = readIndexNowKey(workspace)!;

		// Modify site-spec.yaml to change siteUrl
		const specFile = specPath(workspace);
		let spec = readFileSync(specFile, 'utf8');
		spec = spec.replace('https://fixture-wiki.example', 'https://new-host.example');
		writeFileSync(specFile, spec, 'utf8');

		// Regenerate
		generateSite({ specPath: specPath(workspace), rootDir: workspace });
		const key2 = readIndexNowKey(workspace)!;

		assert.notEqual(key1.key, key2.key, 'key should change when siteUrl host changes');
		assert.equal(key2.siteUrl, 'https://new-host.example');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

// ── dry-run / check ────────────────────────────────────────────────────

test('dry-run does not write key', () => {
	const workspace = createWorkspace();
	try {
		installFixture(workspace);
		const result = generateSite({ specPath: specPath(workspace), rootDir: workspace, dryRun: true });
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, true);

		const keyFile = path.join(workspace, INDEXNOW_KEY_REL);
		assert.ok(!existsSync(keyFile), 'key file should NOT exist after dry-run');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('check mode passes when key exists', () => {
	const workspace = createWorkspace();
	try {
		installFixture(workspace);
		generateSite({ specPath: specPath(workspace), rootDir: workspace });

		const checkResult = generateSite({ specPath: specPath(workspace), rootDir: workspace, check: true });
		assert.equal(checkResult.ok, true, 'check should pass when key exists');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});

test('check mode reports drift when key is missing', () => {
	const workspace = createWorkspace();
	try {
		installFixture(workspace);
		generateSite({ specPath: specPath(workspace), rootDir: workspace });

		// Delete the key file
		unlinkSync(path.join(workspace, INDEXNOW_KEY_REL));

		// Check should report drift
		const checkResult = generateSite({ specPath: specPath(workspace), rootDir: workspace, check: true });
		assert.equal(checkResult.ok, false, 'check should fail when key is missing');
		assert.ok(checkResult.drift.includes(INDEXNOW_KEY_REL), 'drift should include key file');
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});
