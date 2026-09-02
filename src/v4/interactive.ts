export type InteractiveRow = Record<string, string | number | boolean>;

export function filterPrimitiveRows(rows: readonly InteractiveRow[], query: string): readonly InteractiveRow[] {
	const normalized = query.trim().toLocaleLowerCase();
	if (!normalized) return rows;
	return rows.filter((row) => Object.values(row).some((value) => String(value).toLocaleLowerCase().includes(normalized)));
}

export function calculateLinear(base: number, rate: number, duration: number): number {
	return base + rate * duration;
}

export function selectMapMarker(markers: readonly InteractiveRow[], index: number): InteractiveRow | undefined {
	return markers[index];
}

export function togglePlannerSlot(slots: readonly string[], slot: string): readonly string[] {
	return slots.includes(slot) ? slots.filter((item) => item !== slot) : [...slots, slot];
}
