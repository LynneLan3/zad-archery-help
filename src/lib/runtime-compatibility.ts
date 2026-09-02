/** Stable capabilities used by legacy adoption before generation is allowed. */
export const RUNTIME_COMPATIBILITY = {
	generatorContract: '2.1.0',
	experienceRenderer: '2.1.0',
	pageSchema: '2.1.0',
	navigationShell: '2.1.0',
	guideLibrary: '2.1.0',
	articleContract: '2.1.0',
} as const;

export const RUNTIME_COMPATIBILITY_FINGERPRINT = Object.entries(RUNTIME_COMPATIBILITY)
	.map(([key, value]) => `${key}=${value}`)
	.join('|');
