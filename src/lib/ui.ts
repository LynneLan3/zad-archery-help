import { game, type ReleaseStatus, type UiLocale } from '../config/game';
import type { EvidenceSourceType, PageSourceType } from './page-evidence';
import type { GuideStatusValue } from './status';

export type { UiLocale };

type UiDictionary = {
	guideAndWiki: string;
	release: string;
	releaseStatus: string;
	platforms: string;
	developer: string;
	publisher: string;
	popularQuestions: string;
	readGuide: string;
	playerPath: string;
	homeNav: string;
	aboutNav: string;
	playerRoutes: string;
	chooseWhatYoureTryingLede: string;
	routesNav: string;
	allGuides: string;
	fieldGuide: string;
	chooseRouteLede: string;
	openRoute: (title: string) => string;
	routeNumberLabel: (number: string) => string;
	chooseYourRoute: string;
	chooseYourRouteTitle: string;
	routeGroupsLede: string;
	startHereTitle: string;
	startHereSectionLede: string;
	popularQuestionsLede: string;
	fieldNotes: string;
	moreToExplore: string;
	fieldNotesLede: string;
	featuredEyebrow: string;
	fastAnswers: string;
	commonQuestionsLede: string;
	followTheRoute: string;
	followTheRouteLede: string;
	followTheRouteStepLede: string;
	otherRoutes: string;
	chooseAnotherRoute: string;
	read: string;
	youAreOn: string;
	backToRoute: string;
	chooseAnotherRouteAction: string;
	startHere: string;
	startHereLede: string;
	explore: string;
	browseGuides: string;
	browseGuidesLede: string;
	gameWikiEyebrow: string;
	updated: string;
	keepReading: string;
	moreGuides: string;
	moreGuidesLede: string;
	editorial: string;
	recentlyUpdated: string;
	recentlyUpdatedLede: string;
	relatedGuides: string;
	nextStepGuide: string;
	nextQuestions: string;
	nextQuestionsLede: string;
	sourcesHeading: string;
	sourceRecord: string;
	guideEvidenceHeading: string;
	evidenceSourceLink: string;
	onThisPage: string;
	moreReferences: string;
	exploreAnotherRoute: string;
	pageSourceTypes: Record<PageSourceType, string>;
	evidenceSourceTypes: Record<EvidenceSourceType, string>;
	quickAnswer: string;
	gameFacts: string;
	guideCategories: string;
	breadcrumb: string;
	guidesNav: string;
	aboutGame: (name: string) => string;
	guidesInCategory: (label: string) => string;
	guideCount: (count: number) => string;
	moreGuidesCount: (extra: number) => string;
	viewCategory: (label: string) => string;
	updatedOn: (dateLabel: string) => string;
	seeGameInAction: string;
	backToHub: string;
	trustFooterLabel: string;
	trustAbout: string;
	trustEditorialMethod: string;
	trustPrivacy: string;
	trustAffiliateDisclosure: string;
	status: Record<GuideStatusValue, string>;
	releaseStatuses: Record<ReleaseStatus, string>;
};

const en: UiDictionary = {
	guideAndWiki: 'Guide & Wiki',
	release: 'Release',
	releaseStatus: 'Status',
	platforms: 'Platforms',
	developer: 'Developer',
	publisher: 'Publisher',
	popularQuestions: 'Popular Questions',
	readGuide: 'Read guide →',
	playerPath: 'Player path',
	homeNav: 'Home',
	aboutNav: 'About',
	playerRoutes: 'Player Routes',
	chooseWhatYoureTryingLede: "Choose what you're trying to do.",
	routesNav: 'Routes',
	allGuides: 'All Guides',
	fieldGuide: 'Field Guide',
	chooseRouteLede: 'Choose a route instead of browsing at random.',
	openRoute: (title) => `Open ${title} route →`,
	routeNumberLabel: (number) => `Route ${number}`,
	chooseYourRoute: 'Choose Your Route',
	chooseYourRouteTitle: "Start with what you're trying to do.",
	routeGroupsLede: 'Each route groups the guides most relevant to a specific player goal.',
	startHereTitle: 'Jump straight to an answer.',
	startHereSectionLede: 'The guides most players open first.',
	popularQuestionsLede: 'Quick answers to what players ask first.',
	fieldNotes: 'Field Notes',
	moreToExplore: 'More to Explore',
	fieldNotesLede: "Other guides worth reading once you've found your route.",
	featuredEyebrow: 'Featured',
	fastAnswers: 'Fast Answers',
	commonQuestionsLede: 'Common questions, short answers.',
	followTheRoute: 'Follow the Route',
	followTheRouteLede: 'Read these guides in order.',
	followTheRouteStepLede: 'Each step builds on the last. Start at the top and work your way down.',
	otherRoutes: 'Other Routes',
	chooseAnotherRoute: 'Choose another route.',
	read: 'Read',
	youAreOn: "You're on",
	backToRoute: 'Back to route',
	chooseAnotherRouteAction: 'Choose another route →',
	startHere: 'Start Here',
	startHereLede: 'Four high-priority ways into the game — pick the task you need first.',
	explore: 'Explore',
	browseGuides: 'Browse Guides',
	browseGuidesLede: 'Jump by topic. Category landings stay navigational; guides stay indexable.',
	gameWikiEyebrow: 'Game / Wiki',
	updated: 'Updated',
	keepReading: 'Keep reading',
	moreGuides: 'More Guides',
	moreGuidesLede: 'Additional pages beyond the Start Here path.',
	editorial: 'Editorial',
	recentlyUpdated: 'Recently Updated',
	recentlyUpdatedLede: 'What changed — not only which page moved.',
	relatedGuides: 'Related Guides',
	nextStepGuide: 'Next Step',
	nextQuestions: 'Next Questions',
	nextQuestionsLede: 'Continue with the question most likely to come next.',
	sourcesHeading: 'Sources',
	sourceRecord: 'Source Record',
	guideEvidenceHeading: 'Evidence',
	evidenceSourceLink: 'View source',
	onThisPage: 'On This Page',
	moreReferences: 'More References',
	exploreAnotherRoute: 'Explore Another Route',
	pageSourceTypes: {
		official: 'Official',
		steam: 'Steam',
		reddit: 'Reddit',
		youtube: 'YouTube',
		other: 'Other',
	},
	evidenceSourceTypes: {
		firsthand: 'Firsthand',
		official: 'Official',
		community: 'Community',
	},
	quickAnswer: 'Quick Answer',
	gameFacts: 'Game facts',
	guideCategories: 'Guide categories',
	breadcrumb: 'Breadcrumb',
	guidesNav: 'Guides',
	aboutGame: (name) => `About ${name}`,
	guidesInCategory: (label) => `Guides in ${label}`,
	guideCount: (count) => (count === 1 ? '1 guide' : `${count} guides`),
	moreGuidesCount: (extra) => `+ ${extra} more guides`,
	viewCategory: (label) => `View ${label} →`,
	updatedOn: (dateLabel) => `Updated ${dateLabel}`,
	seeGameInAction: 'See the Game in Action',
	backToHub: 'Back to Hub',
	trustFooterLabel: 'Trust and legal',
	trustAbout: 'About',
	trustEditorialMethod: 'Editorial Method',
	trustPrivacy: 'Privacy',
	trustAffiliateDisclosure: 'Affiliate Disclosure',
	status: {
		'pre-release': 'Pre-release',
		confirmed: 'Confirmed',
		verified: 'Verified',
		'needs-verification': 'Needs Verification',
	},
	releaseStatuses: {
		announced: 'Announced',
		'pre-release': 'Pre-release',
		'early-access': 'Early Access',
		released: 'Released',
		unknown: 'Unknown',
	},
};

const zhCN: UiDictionary = {
	guideAndWiki: '攻略与 Wiki',
	release: '发售',
	releaseStatus: '状态',
	platforms: '平台',
	developer: '开发商',
	publisher: '发行商',
	popularQuestions: '热门问题',
	readGuide: '阅读攻略 →',
	playerPath: '玩家路径',
	homeNav: '首页',
	aboutNav: '关于',
	playerRoutes: '玩家路径',
	chooseWhatYoureTryingLede: '选择你现在想做的事。',
	routesNav: '路径',
	allGuides: '全部攻略',
	fieldGuide: '实地指南',
	chooseRouteLede: '与其随机翻找，不如选择一条路径。',
	openRoute: (title) => `打开 ${title} 路径 →`,
	routeNumberLabel: (number) => `路径 ${number}`,
	chooseYourRoute: '选择你的路径',
	chooseYourRouteTitle: '从你想做的事开始。',
	routeGroupsLede: '每条路径汇集了与某个玩家目标最相关的攻略。',
	startHereTitle: '直接找到答案。',
	startHereSectionLede: '玩家最常先打开的攻略。',
	popularQuestionsLede: '玩家最先提问的常见问题快速解答。',
	fieldNotes: '实地记录',
	moreToExplore: '更多内容',
	fieldNotesLede: '找到你的路径后，其他值得一读的攻略。',
	featuredEyebrow: '精选',
	fastAnswers: '快速解答',
	commonQuestionsLede: '常见问题，简短回答。',
	followTheRoute: '跟随路径',
	followTheRouteLede: '按顺序阅读这些攻略。',
	followTheRouteStepLede: '每一步都建立在前一步之上，从顶部开始依次往下阅读。',
	otherRoutes: '其他路径',
	chooseAnotherRoute: '选择另一条路径。',
	read: '阅读',
	youAreOn: '你当前在',
	backToRoute: '返回路径',
	chooseAnotherRouteAction: '选择另一条路径 →',
	startHere: '从这里开始',
	startHereLede: '四条优先入口——先选你现在最需要的任务。',
	explore: '浏览',
	browseGuides: '浏览攻略',
	browseGuidesLede: '按主题跳转。分类页只做导航；攻略页可被收录。',
	gameWikiEyebrow: '游戏 / Wiki',
	updated: '更新',
	keepReading: '继续阅读',
	moreGuides: '更多攻略',
	moreGuidesLede: '「从这里开始」之外的其他页面。',
	editorial: '更新',
	recentlyUpdated: '最近更新',
	recentlyUpdatedLede: '关注改了什么，而不只是哪一页动了。',
	relatedGuides: '相关攻略',
	nextStepGuide: '下一步',
	nextQuestions: '接下来的问题',
	nextQuestionsLede: '继续阅读最可能出现的下一个问题。',
	sourcesHeading: '来源',
	sourceRecord: '来源记录',
	guideEvidenceHeading: '证据',
	evidenceSourceLink: '查看来源',
	onThisPage: '本页目录',
	moreReferences: '更多参考',
	exploreAnotherRoute: '探索另一条路径',
	pageSourceTypes: {
		official: '官方',
		steam: 'Steam',
		reddit: 'Reddit',
		youtube: 'YouTube',
		other: '其他',
	},
	evidenceSourceTypes: {
		firsthand: '一手记录',
		official: '官方',
		community: '社区',
	},
	quickAnswer: '快速回答',
	gameFacts: '游戏信息',
	guideCategories: '攻略分类',
	breadcrumb: '面包屑导航',
	guidesNav: '攻略',
	aboutGame: (name) => `关于 ${name}`,
	guidesInCategory: (label) => `${label} 中的攻略`,
	guideCount: (count) => (count === 1 ? '1 篇攻略' : `${count} 篇攻略`),
	moreGuidesCount: (extra) => `+ 另外 ${extra} 篇攻略`,
	viewCategory: (label) => `查看 ${label} →`,
	updatedOn: (dateLabel) => `更新于 ${dateLabel}`,
	seeGameInAction: '游戏实机画面',
	backToHub: '返回 Hub',
	trustFooterLabel: '信任与法律信息',
	trustAbout: '关于本站',
	trustEditorialMethod: '内容方法',
	trustPrivacy: '隐私说明',
	trustAffiliateDisclosure: '联盟披露',
	status: {
		'pre-release': '预发布',
		confirmed: '已确认',
		verified: '已核实',
		'needs-verification': '待核实',
	},
	releaseStatuses: {
		announced: '已公布',
		'pre-release': '预发布',
		'early-access': '抢先体验',
		released: '已发售',
		unknown: '未知',
	},
};

const dictionaries: Record<UiLocale, UiDictionary> = {
	en,
	'zh-CN': zhCN,
};

export function resolveLocale(locale: string | undefined): UiLocale {
	if (locale === 'zh-CN') return 'zh-CN';
	return 'en';
}

export function ui(locale: string | undefined = game.locale): UiDictionary {
	return dictionaries[resolveLocale(locale)];
}

export function formatUiDate(date: Date, locale: string | undefined = game.locale): string {
	const resolved = resolveLocale(locale);
	return new Intl.DateTimeFormat(resolved === 'zh-CN' ? 'zh-CN' : 'en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	}).format(date);
}

export function statusLabel(status: GuideStatusValue, locale: string | undefined = game.locale): string {
	return ui(locale).status[status];
}

export function releaseStatusLabel(
	status: ReleaseStatus,
	locale: string | undefined = game.locale,
): string {
	return ui(locale).releaseStatuses[status];
}

/** Hub fact line: localized status, plus a concrete date when one exists. */
export function formatReleaseFact(
	status: ReleaseStatus,
	releaseDate: string,
	locale: string | undefined = game.locale,
): string {
	const label = releaseStatusLabel(status, locale);
	if (!releaseDate || releaseDate === 'TBD' || releaseDate === 'unknown' || releaseDate === '未定') {
		return label;
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
		const date = new Date(`${releaseDate}T00:00:00Z`);
		if (!Number.isNaN(date.getTime())) {
			return `${label} · ${formatUiDate(date, locale)}`;
		}
	}
	return `${label} · ${releaseDate}`;
}

/** Status rail date value. Returns undefined when the date is a non-calendar marker. */
export function formatReleaseDateValue(
	releaseDate: string,
	locale: string | undefined = game.locale,
): string | undefined {
	if (!releaseDate || releaseDate === 'TBD' || releaseDate === 'unknown' || releaseDate === '未定') {
		return undefined;
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
		const date = new Date(`${releaseDate}T00:00:00Z`);
		if (!Number.isNaN(date.getTime())) return formatUiDate(date, locale);
	}
	return releaseDate;
}
