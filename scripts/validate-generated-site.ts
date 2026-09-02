#!/usr/bin/env node
/**
 * CLI for `npm run validate:generated`.
 *
 * Generated-site mode only. Does not run verify:template / test:context / test:generator.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runValidateGenerated } from './lib/run-validate-generated';

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
			console.log('Usage: validate:generated [--root <dir>]');
			process.exit(0);
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	return { root };
}

function main() {
	const { root } = parseArgs(process.argv.slice(2));
	console.log(`validate:generated — root=${root}`);
	console.log('  steps: manifest → generator --check → validate:site --mode=generated-site → check → build → generated-structure');
	console.log('  skipped: verify:template, test:context, test:generator');

	const result = runValidateGenerated(root);
	if (!result.ok) {
		console.error('\nvalidate:generated FAILED:');
		console.error(`  failedStep: ${result.failedStep}`);
		console.error(result.message ?? 'Unknown failure');
		console.error(`  stepsRun: ${result.stepsRun.join(' → ')}`);
		process.exit(1);
	}

	console.log(`validate:generated OK (${result.stepsRun.join(' → ')})`);
}

try {
	main();
} catch (error) {
	console.error('validate:generated crashed:');
	console.error(error);
	process.exit(1);
}
