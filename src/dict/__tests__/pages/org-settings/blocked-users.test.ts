// 组织已屏蔽用户页（/organizations/<组织>/settings/blocked_users）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页实机 HTML**（采集时扩展仍在运行，故页面上
// 已是中文的节点——H2「已屏蔽用户」、关闭按钮的 aria-label「关闭」、页脚「取消」——
// 都是既有键的产物，仍是英文的才是本批清单）。本页是**服务端渲染的传统 Primer 页面
// + 页尾一个 React partial**（`blocked-users-table`），一页里两种渲染形态并存。
//
// 本文件锁六件事：
//   ① 本页只命中 `pages/org-settings` + `global`，**不命中** `pages/settings` /
//      `pages/settings-billing` / `pages/repo-settings`；旧前缀 `/orgs/...` 同样命中；
//   ② 本批 23 条新键在实机的真实节点上全部命中（含带源码缩进与换行的形态）；
//   ③ 本批绝大多数串在 `pages/settings`（个人设置的 /settings/blocked_users）里
//      早有词条，但那条路由不命中 /organizations/**，故本模块**逐字同译**各收一份
//      ——用例对同名节点断言两份视图的译文**逐字相等**；
//   ④ 三条动态值：备注框的剩余字数、屏蔽确认句里被 JS 填进去的用户名、以及
//      `data-dynamic-label` 可能把时长菜单重组成单个节点时的两种形态；
//   ⑤ 特意不收录的两串：列表 aria-label `results`（既有两处译文互不相同、屏显不可见）
//      与个人页那句结尾为「仅你自己可见」的备注说明（本页结尾不同，是新键）；
//   ⑥ 与页面同形的拼接结果逐字正确（说明句的链接、三条清单项的前导空格、
//      时长按钮的「屏蔽：」+ 当前值两个节点、React partial 的空态）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织已屏蔽用户页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/blocked_users";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/blocked_users";

const locale = dictForLocale("zh-CN");

/** 本页命中的模块视图（pages/org-settings + global） */
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 个人设置页那条路由的视图（用于断言两页同译；它**不**命中本页路径） */
const PERSONAL_VIEW = buildView(
	"/settings/blocked_users",
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本批新补的文本节点与属性值（按实机 HTML 的标签嵌套誊录） */
const NEW_NODES: readonly string[] = [
	// —— 页首说明句（链接把句子切成两段）——
	"You can block a user to deny them access to repositories and more.",
	"Learn more about blocking a user",
	// —— 添加屏蔽的卡片 ——
	// 区块标题与搜索框的 sr-only 标签是同一串，一条键覆盖两处
	"Block a user",
	// 搜索框的 placeholder 与同文案的 sr-only 文本节点是同一个串
	"Search by username, full name or email address",
	// —— 屏蔽确认对话框（默认 hidden，但在 DOM 里，照常翻译）——
	// 按钮文案 / 对话框标题 / 表单的 aria-label 三处同串
	"Block user",
	"You are about to block:",
	"Blocking a user prevents the following on all your repositories:",
	"opening or commenting on issues or pull requests",
	"starring, forking, or watching",
	"adding or editing wiki pages",
	// 屏蔽时长菜单：按钮标签的静音前缀 + 当前值（两个节点），以及菜单项本身
	"Block:",
	"For 1 day",
	"For 3 days",
	"For 7 days",
	"For 30 days",
	"Until I unblock them",
	// 对话框下半部分
	"Close all open issues, pull requests, and discussions opened by this user",
	"Add an optional note",
	// 本页与个人页唯一的文案差异：结尾是「所有组织管理员和版主都能看到此备注」
	"Maximum 250 characters. Please don’t include any personal information such as legal names or email addresses. Markdown is supported. All org admins and moderators can see this note.",
	// —— 页尾 React partial（blocked-users-table）——
	"Currently blocked",
	"You have not blocked anyone.",
	"Find blocked users",
	// 带牛津逗号的另一条搜索串（与上面「…or email address」那条不是同一个串）
	"Search by username, full name, or public email",
];

/** 页面上已是中文的节点（既有键的产物，用作「扩展确实在这一页生效」的对照物） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Blocked users", "已屏蔽用户"],
	["Close", "关闭"],
	["Cancel", "取消"],
];

/**
 * 必须保持英文：有意不收录的串、本模块拿不到的个人页变体、以及用户内容。
 * 前两条同时是**路由互斥**的回归——同一个词在别的模块有译文，不代表这一页有。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 列表 aria-label：既有两处收录的译文互不相同（「结果」/「个结果」），
	// 证明它按上下文取值、且屏显不可见，故有意不收录（同 billing-managers 的判定）
	"results",
	// 个人页那句备注说明的结尾是「此备注仅你自己可见」——本页结尾不同，
	// 它是 `pages/settings` 的键、在本模块的路由下拿不到（本批另收了本页的变体）
	"Maximum 250 characters. Please don’t include any personal information such as legal names or email addresses. Markdown is supported. This note will only be visible to you.",
	// 用户名是用户内容
	"octocat",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白（**整节点被判空时不留空白**，与
 * walker.applyTextNode 的 erased 语义一致），最后拼接成页面上真实看到的那一行。
 */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			if (translated.trim() === "") return translated;
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("组织已屏蔽用户页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the personal or per-repository settings modules", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/settings-billing");
		expect(names).not.toContain("pages/repo-settings");
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织已屏蔽用户页的实机节点", () => {
	it("translates every newly registered node", () => {
		for (const node of NEW_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the strings that must stay English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the shared strings exactly like the personal settings page", () => {
		// 个人页 /settings/blocked_users 早就有这些词条，而它的路由不命中
		// /organizations/**：本模块各收一份并逐字同译，同一串在两页不能有两副面孔
		const shared = [
			"Block a user",
			"Block user",
			"You can block a user to deny them access to repositories and more.",
			"Learn more about blocking a user",
			"Search by username, full name or email address",
			"You are about to block:",
			"Blocking a user prevents the following on all your repositories:",
			"opening or commenting on issues or pull requests",
			"starring, forking, or watching",
			"adding or editing wiki pages",
			"Close all open issues, pull requests, and discussions opened by this user",
			"Add an optional note",
			"Currently blocked",
			"You have not blocked anyone.",
			"Find blocked users",
			"Search by username, full name, or public email",
		];
		for (const raw of shared) {
			const here = translateText(raw, view);
			expect(
				here,
				`本页未命中：${JSON.stringify(raw)}`,
			).not.toBeNull();
			expect(
				here,
				`两页译文不一致：${JSON.stringify(raw)}`,
			).toBe(translateText(raw, PERSONAL_VIEW));
		}
	});

	it("uses its own key for the organization variant of the note caption", () => {
		// 本页那句结尾是「所有组织管理员和版主都能看到此备注」——与个人页那句
		// 是**两个不同的键**，用例同时钉住两边的形态（个人页那句在本页不命中）
		expect(
			translateText(
				"Maximum 250 characters. Please don’t include any personal information such as legal names or email addresses. Markdown is supported. All org admins and moderators can see this note.",
				view,
			),
		).toBe(
			"最多 250 个字符。请不要包含任何个人信息，例如法定姓名或电子邮箱地址。支持 Markdown。所有组织管理员和版主都能看到此备注。",
		);
		expect(
			translateText(
				"Maximum 250 characters. Please don’t include any personal information such as legal names or email addresses. Markdown is supported. This note will only be visible to you.",
				PERSONAL_VIEW,
			),
		).toBe(
			"最多 250 个字符。请不要包含任何个人信息，例如法定姓名或电子邮箱地址。支持 Markdown。此备注仅你自己可见。",
		);
	});
});

describe("组织已屏蔽用户页的节点切分事实", () => {
	it("keeps the two search strings apart", () => {
		// 服务端渲染那段用「full name or email address」，React partial 那段用
		// 「full name, or public email」（牛津逗号 + public）——两条不同的键
		expect(
			translateText(
				"Search by username, full name or email address",
				view,
			),
		).toBe("按用户名、全名或电子邮件地址搜索");
		expect(
			translateText(
				"Search by username, full name, or public email",
				view,
			),
		).toBe("按用户名、全名或公开电子邮箱搜索");
	});

	it("requires the duration menu label to be two nodes", () => {
		// 按钮标签是 `<span>Block:</span>` + `<span>当前值</span>` 两个节点；
		// 当前值与菜单项同串，菜单项本身**不得**自带「屏蔽」二字
		expect(translateText("Block:", view)).toBe("屏蔽：");
		expect(
			translateText("Until I unblock them", view),
		).toBe("直到我解除屏蔽");
		for (const [raw, expected] of [
			["For 1 day", "1 天"],
			["For 3 days", "3 天"],
			["For 7 days", "7 天"],
			["For 30 days", "30 天"],
		] as const) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("covers the composed form of the duration label through the rules", () => {
		// 上游给这个菜单挂了 `data-dynamic-label` / `data-dynamic-label-prefix="Block"`：
		// 若它把标签重组成**一个节点**，由规则接住（`For N day(s)` 一条规则覆盖四档，
		// 数字是语言无关的捕获组，不会留下中英残句）
		expect(translateText("Block: For 1 day", view)).toBe(
			"屏蔽：1 天",
		);
		expect(translateText("Block: For 30 days", view)).toBe(
			"屏蔽：30 天",
		);
		expect(
			translateText("Block: Until I unblock them", view),
		).toBe("屏蔽：直到我解除屏蔽");
		// 锚定：前缀不是 `Block:` 的句子不该被部分替换
		expect(
			translateText("Blocked: For 1 day", view),
		).toBeNull();
	});

	it("fills the blocked username through the rule", () => {
		// `<strong data-text-template="You are about to block: @{username}">` 的初始
		// 文本是静态的（走词条），用户选定后 JS 把用户名填进同一个节点（走规则）
		expect(
			translateText("You are about to block:", view),
		).toBe("你即将屏蔽：");
		expect(
			translateText(
				"You are about to block: @octocat",
				view,
			),
		).toBe("你即将屏蔽：@octocat");
		// 用户名原样带回；锚定：没有用户名的裸句不该被规则吃掉
		expect(
			translateText(
				"You are about to block: someone",
				view,
			),
		).toContain("someone");
	});

	it("counts the remaining characters through the rule", () => {
		// 备注框下方实时更新的剩余字数：数字动态、单复数同形
		expect(
			translateText("250 characters remaining.", view),
		).toBe("剩余 250 个字符。");
		expect(
			translateText("1 character remaining.", view),
		).toBe("剩余 1 个字符。");
		// 与 global 的既有规则划清边界：`global/status-characters-remaining`
		// 收的是**没有句点**的形态（状态编辑对话框那种，译作「还可输入 N 个字符」），
		// 本页的形态带句点、走本模块这条；两条 pattern 互不覆盖，各有各的措辞
		expect(
			translateText("250 characters remaining", view),
		).toBe("还可输入 250 个字符");
	});
});

describe("组织已屏蔽用户页的拼接结果", () => {
	it("renders the intro sentence with its link", () => {
		expect(
			renderNodes([
				"You can block a user to deny them access to repositories and more. ",
				"Learn more about blocking a user",
			]),
		).toBe(
			"你可以屏蔽用户，以禁止其访问你的仓库等。 详细了解如何屏蔽用户",
		);
	});

	it("renders a checklist item with its leading space", () => {
		// 项目符号是 SVG 图标而不是文本节点，文本节点自带一个前导空格
		expect(
			renderNodes([
				" opening or commenting on issues or pull requests",
			]),
		).toBe(" 打开议题或拉取请求，或对其发表评论");
	});

	it("renders the duration button from its two nodes", () => {
		expect(
			renderNodes([
				"Block:",
				"\n          Until I unblock them\n",
			]),
		).toBe("屏蔽：\n          直到我解除屏蔽\n");
	});

	it("renders the character counter next to the note caption", () => {
		expect(
			renderNodes([
				"250 characters remaining.",
				"\n      Maximum 250 characters. Please don’t include any personal information such as legal names or email addresses. Markdown is supported. All org admins and moderators can see this note.\n  ",
			]),
		).toBe(
			"剩余 250 个字符。\n      最多 250 个字符。请不要包含任何个人信息，例如法定姓名或电子邮箱地址。支持 Markdown。所有组织管理员和版主都能看到此备注。\n  ",
		);
	});

	it("renders the React partial empty state", () => {
		expect(
			renderNodes([
				"Currently blocked",
				"Search by username, full name, or public email",
				"You have not blocked anyone.",
			]),
		).toBe(
			"已屏蔽按用户名、全名或公开电子邮箱搜索你还没有屏蔽任何人。",
		);
	});
});
