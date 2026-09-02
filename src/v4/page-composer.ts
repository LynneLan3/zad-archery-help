import type { PageData } from './page-data-contract';
import { renderIncludedPrimitives } from './primitives';
import type { PrimitiveView } from './primitives';

export interface ComposedPage {
	surface: 'answer';
	showHero: boolean;
	hasPermanentDocsSidebar: false;
	primitives: readonly PrimitiveView[];
}

const ORDER_BY_PROTOTYPE: Record<string, readonly string[]> = {
	P1: ['A01', 'A02', 'E01', 'N01'], P2: ['A01', 'E02', 'X01', 'X02', 'E03'], P3: ['A01', 'S02', 'D01', 'D03', 'D02'],
	// G024 uses the existing Primitive vocabulary but lets a filled Blueprint order
	// every available structured slot.  No generic Article fallback is introduced.
	P4: ['A01', 'A02', 'E01', 'P01', 'P02', 'P04', 'E03', 'N01'],
	P5: ['A01', 'A02', 'L01', 'L02', 'L03', 'P02', 'P04', 'E03', 'D03', 'N01', 'E01'],
	P6: ['A01', 'A02', 'E01', 'P03', 'P02', 'P04', 'D03', 'N01'],
	P7: ['A01', 'A02', 'A03', 'E01', 'E03', 'X03', 'D03', 'P04', 'N01'], P8: ['A01', 'S01', 'S03', 'S04', 'D02', 'D01'],
	P9: ['A01', 'X05', 'X01', 'X02', 'E03'], P10: ['A01', 'S03', 'S04', 'N01'],
};

export function composePage(page: PageData): ComposedPage {
	const order = ORDER_BY_PROTOTYPE[page.intent.prototype] ?? [];
	const position = new Map(order.map((behavior, index) => [behavior, index]));
	const primitives = [...renderIncludedPrimitives(page)].sort(
	(a, b) => (position.get(a.id) ?? order.length) - (position.get(b.id) ?? order.length),
	);
	return {
		surface: 'answer',
		showHero: page.assets.some((asset) => asset.role === 'hero'),
		hasPermanentDocsSidebar: false,
		primitives,
	};
}
