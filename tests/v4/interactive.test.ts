import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLinear, filterPrimitiveRows, selectMapMarker, togglePlannerSlot } from '../../src/v4/interactive';

test('minimum-working filter, calculator, map, and planner behaviors are executable', () => {
	const rows = [{ name: 'Cinder Axe', class: 'Warden' }, { name: 'Frost Staff', class: 'Arcanist' }];
	assert.deepEqual(filterPrimitiveRows(rows, 'warden'), [rows[0]]);
	assert.equal(calculateLinear(2, 3, 4), 14);
	assert.deepEqual(selectMapMarker([{ label: 'Vein' }], 0), { label: 'Vein' });
	assert.deepEqual(togglePlannerSlot([], 'primary'), ['primary']);
	assert.deepEqual(togglePlannerSlot(['primary'], 'primary'), []);
});
