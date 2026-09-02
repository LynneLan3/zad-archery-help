#!/usr/bin/env node
/**
 * Template cleanliness checks for game-wiki-starter.
 * Ensures forbidden build/export artifacts are not Git-tracked
 * and that required source files exist for a clean `git archive` export.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function fail(message) {
	errors.push(message);
}

function gitLsFiles() {
	const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer' });
	if (result.status !== 0) {
		fail(`git ls-files failed: ${result.stderr?.toString() || 'unknown error'}`);
		return [];
	}
	return result.stdout
		.toString('utf8')
		.split('\0')
		.filter(Boolean);
}

const forbiddenPrefixes = [
	'node_modules/',
	'dist/',
	'.astro/',
	'.vercel/',
	'__MACOSX/',
	'.git/',
];

const forbiddenExact = new Set(['.DS_Store', '.env']);
const forbiddenPatterns = [
	/^\.env\./,
	/\.zip$/i,
	/\.tgz$/i,
	/^npm-debug\.log/,
	/^yarn-debug\.log/,
	/^yarn-error\.log/,
	/^pnpm-debug\.log/,
];

const requiredPaths = [
	'package.json',
	'package-lock.json',
	'astro.config.mjs',
	'src/config/game.ts',
	'src/config/game-types.ts',
	'src/config/site.generated.ts',
	'TEMPLATE_VERSION',
	'src/content.config.ts',
	'src/lib/assets.ts',
	'src/lib/paths.ts',
	'src/lib/ui.ts',
	'src/lib/validate-config.ts',
	'src/content/docs/index.mdx',
	'scripts/verify-template.mjs',
	'scripts/validate-site.mjs',
	'AGENTS.md',
	'REPOSITORY_ID',
	'site-spec.example.yaml',
	'scripts/generate-site.ts',
	'scripts/validate-generated-site.ts',
	'scripts/verify-context.ts',
	'scripts/template-demo-manifest.json',
	'.agents/skills/create-hotword-wiki/SKILL.md',
	'README.md',
	'.gitignore',
];

const tracked = gitLsFiles();
const trackedSet = new Set(tracked);
const warnings = [];

for (const file of tracked) {
	if (forbiddenPrefixes.some((prefix) => file === prefix.slice(0, -1) || file.startsWith(prefix))) {
		fail(`Forbidden path is Git-tracked: ${file}`);
	}
	if (forbiddenExact.has(path.basename(file)) || forbiddenExact.has(file)) {
		fail(`Forbidden file is Git-tracked: ${file}`);
	}
	if (forbiddenPatterns.some((pattern) => pattern.test(file) || pattern.test(path.basename(file)))) {
		fail(`Forbidden pattern is Git-tracked: ${file}`);
	}
}

for (const rel of requiredPaths) {
	const abs = path.join(root, rel);
	if (!existsSync(abs)) {
		fail(`Required path missing: ${rel}`);
	} else if (!trackedSet.has(rel.replace(/\\/g, '/'))) {
		warnings.push(
			`Required path exists but is not Git-tracked yet (git archive HEAD will omit it): ${rel}`,
		);
	}
}

if (!existsSync(path.join(root, 'package-lock.json'))) {
	fail('package-lock.json must exist for reproducible installs.');
}

console.log('verify:template — checking Git-tracked export safety…');
console.log(`  tracked files: ${tracked.length}`);

if (warnings.length > 0) {
	console.warn('\nverify:template warnings:');
	for (const warning of warnings) {
		console.warn(`  • ${warning}`);
	}
	console.warn('  Commit (or stage + commit) these before publishing a template zip via git archive.');
}

if (errors.length > 0) {
	console.error('\nverify:template FAILED:\n');
	for (const error of errors) {
		console.error(`  • ${error}`);
	}
	console.error('\nFix: untrack generated/secret files (`git rm --cached …`) and keep source + lockfile tracked.');
	console.error('Export tip: git archive --format=zip --output=game-wiki-starter.zip HEAD');
	process.exit(1);
}

console.log('verify:template OK');
console.log('Recommended clean export:');
console.log('  git archive --format=zip --output=game-wiki-starter.zip HEAD');
