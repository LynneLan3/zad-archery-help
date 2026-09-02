#!/usr/bin/env node
/**
 * Repository identity + workspace context precheck for Codex / create-hotword-wiki.
 * Does not require site-spec.yaml. Does not mutate files, remotes, or git config.
 *
 * Usage:
 *   npm run verify:context
 *   npm run verify:context -- --root /path/to/checkout
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	formatRepoContextReport,
	verifyRepoContext,
} from './lib/verify-repo-context';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv: string[]) {
	let root = DEFAULT_ROOT;
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]!;
		if (arg === '--root') {
			root = path.resolve(argv[++i] ?? '');
			continue;
		}
		if (arg.startsWith('--root=')) {
			root = path.resolve(arg.slice('--root='.length));
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			console.log('Usage: verify:context [--root <dir>]');
			process.exit(0);
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	return { root };
}

function main() {
	const { root } = parseArgs(process.argv.slice(2));
	const result = verifyRepoContext(root);
	console.log(formatRepoContextReport(result));
	if (!result.ok) {
		console.error('\nverify:context FAILED');
		process.exit(1);
	}
	console.log('verify:context OK');
}

main();
