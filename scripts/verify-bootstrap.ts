#!/usr/bin/env node
/** Read-only precheck for a new, not-yet-bound generated-site workspace. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	formatRepoBootstrapReport,
	verifyRepoBootstrap,
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
			console.log('Usage: verify:bootstrap [--root <dir>]');
			process.exit(0);
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	return { root };
}

const result = verifyRepoBootstrap(parseArgs(process.argv.slice(2)).root);
console.log(formatRepoBootstrapReport(result));
if (!result.ok) {
	console.error('\nverify:bootstrap FAILED');
	process.exit(1);
}
console.log('verify:bootstrap OK');
