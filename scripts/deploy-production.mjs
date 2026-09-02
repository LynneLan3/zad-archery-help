#!/usr/bin/env node
/**
 * Production deploy with explicit Vercel Deployment Identity.
 *
 * Reads site-spec.yaml, checks branch / org / project / production URL,
 * then deploys with VERCEL_ORG_ID and VERCEL_PROJECT_ID from the spec,
 * always scoped to lynnelan3s-projects for new hotword sites.
 *
 * Usage:
 *   npm run deploy:check
 *   npm run deploy:production
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDeployCli } from './lib/deployment-identity.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');

function parseArgs(argv) {
	let root = DEFAULT_ROOT;
	let checkOnly = false;
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--check') {
			checkOnly = true;
			continue;
		}
		if (arg === '--root') {
			root = path.resolve(argv[++i] ?? '');
			continue;
		}
		if (arg.startsWith('--root=')) {
			root = path.resolve(arg.slice('--root='.length));
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			console.log('Usage: deploy:production [--check] [--root <dir>]');
			process.exit(0);
		}
		console.error(`Unknown argument: ${arg}`);
		process.exit(1);
	}
	return { root, checkOnly };
}

const options = parseArgs(process.argv.slice(2));
const { code } = await runDeployCli({
	rootDir: options.root,
	checkOnly: options.checkOnly,
});
process.exit(code);
