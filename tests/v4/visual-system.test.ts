import assert from 'node:assert/strict';
import test from 'node:test';
import { createV4Theme } from '../../src/v4/visual-system';

test('visual system is Neutral Dark with adaptive game accent', () => {
	const theme = createV4Theme('#f59e0b', '#1c1202');
	assert.equal(theme.base, 'neutral-dark');
	assert.equal(theme.accent, '#f59e0b');
	assert.equal(theme.functionalEvidenceFirst, true);
	assert.equal(theme.heroOptional, true);
	assert.equal(theme.permanentDocsSidebar, false);
});
