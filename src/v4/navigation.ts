export interface V4NavigationItem {
	id: string;
	label: string;
	href: string;
	pageId?: string;
}

export interface V4NavigationGroup {
	id: string;
	label: string;
	items: readonly V4NavigationItem[];
}

export interface V4NavigationCategory extends V4NavigationItem {
	groups?: readonly V4NavigationGroup[];
}

export interface V4Navigation {
	primary: readonly V4NavigationCategory[];
	utilities?: readonly V4NavigationItem[];
}

export interface V4Breadcrumb {
	label: string;
	href?: string;
}

export function getNavigationTrail(navigation: V4Navigation, pageId: string): V4Breadcrumb[] {
	for (const category of navigation.primary) {
		for (const group of category.groups ?? []) {
			const item = group.items.find((entry) => entry.pageId === pageId);
			if (item) return [{ label: category.label, href: category.href }, { label: group.label }, { label: item.label }];
		}
		if (category.pageId === pageId) return [{ label: category.label }];
	}
	return [];
}
