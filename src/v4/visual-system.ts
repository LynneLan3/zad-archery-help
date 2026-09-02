export interface V4Theme {
	base: 'neutral-dark';
	accent: string;
	accentForeground: string;
	functionalEvidenceFirst: true;
	heroOptional: true;
	permanentDocsSidebar: false;
}

export function createV4Theme(accent = '#7dd3fc', accentForeground = '#07111a'): V4Theme {
	return {
		base: 'neutral-dark',
		accent,
		accentForeground,
		functionalEvidenceFirst: true,
		heroOptional: true,
		permanentDocsSidebar: false,
	};
}
