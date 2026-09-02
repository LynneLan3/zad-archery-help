/** Starter-only placeholders are not production Experience media. */
export function isPlaceholderAssetPath(relativePath: string | undefined): boolean {
	return Boolean(relativePath && /(?:^|\/)(?:placeholder|default-og)(?:[.-]|\/|$)/i.test(relativePath));
}
