#!/usr/bin/env node
/**
 * Site configuration + content consistency checks.
 * Default mode is `template` (Example Game demo content is allowed).
 * Presence of site-spec.yaml with mode: generated-site selects generated-site checks.
 * Override with `--mode=template|generated-site`.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadTs(relPath) {
	const href = pathToFileURL(path.join(root, relPath)).href;
	return import(href);
}

function detectModeFromSpec() {
	const specPath = path.join(root, 'site-spec.yaml');
	if (!existsSync(specPath)) return null;
	try {
		const doc = parseYaml(readFileSync(specPath, 'utf8'));
		if (doc && typeof doc === 'object' && doc.mode === 'generated-site') {
			return 'generated-site';
		}
	} catch {
		// parse errors are handled in generated-site validation path
		return 'generated-site';
	}
	return null;
}

async function main() {
	const { game } = await loadTs('src/config/game.ts');
	const {
		resolveValidateMode,
		validateGameConfig,
		SiteValidationError,
	} = await loadTs('src/lib/validate-config.ts');
	const { validateGeneratedSiteExtras } = await loadTs('scripts/lib/validate-generated.ts');

	const argv = process.argv.slice(2);
	const hasExplicitMode = argv.some((arg) => arg.startsWith('--mode=')) || Boolean(process.env.VALIDATE_MODE);
	const mode = hasExplicitMode
		? resolveValidateMode(argv, process.env)
		: detectModeFromSpec() || resolveValidateMode(argv, process.env);

	console.log(`validate:site — mode=${mode}`);

	try {
		validateGameConfig(game, mode);
		if (mode === 'generated-site') {
			validateGeneratedSiteExtras(root);
		}
	} catch (error) {
		if (error instanceof SiteValidationError || error?.name === 'SiteValidationError') {
			console.error('\nvalidate:site FAILED:\n');
			console.error(String(error.message));
			process.exit(1);
		}
		throw error;
	}

	console.log('validate:site OK');
}

main().catch((error) => {
	console.error('validate:site crashed:');
	console.error(error);
	process.exit(1);
});
