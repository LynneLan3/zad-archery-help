import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateV4File } from '../../scripts/v4/generate-v4';

const fixture = JSON.parse(readFileSync(path.resolve('tests/v4/fixtures/sucker-for-love-crush-landing-failure.json'), 'utf8'));

test('Sucker for Love failure input renders verified facts through primitiveData and composition', () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'sucker-v4-regression-'));
	try {
		const input = path.join(directory, 'input.json');
		const output = path.join(directory, 'generated.json');
		writeFileSync(input, `${JSON.stringify(fixture)}\n`);
		const generated = generateV4File(input, output);
		const page = generated.pages[0]!;
		assert.equal(page.pageData.facts.length, 1);
		assert.ok(page.pageData.primitiveData.some((item) => item.primitiveId === 'A01'));
		assert.ok(page.pageData.primitiveData.some((item) => item.primitiveId === 'E01'));
		assert.ok(page.composition.primitives.some((primitive) => primitive.id === 'E01'));
		assert.equal((page.composition.primitives.find((primitive) => primitive.id === 'E01')?.payload as { facts: Array<{ value: string }> }).facts[0]?.value, 'A sentient comet named Hheily crash-lands in an apartment.');
		assert.equal(generated.navigation.primary[0]?.href, '/');
		assert.equal(page.href, '/overview/');
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
