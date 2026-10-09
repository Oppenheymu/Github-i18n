// 组织交互限制页（/organizations/<组织>/settings/interaction_limits）实机文本回归。
//
// 证据与强度：2026-10-09 维护者贴出的**整页实机 HTML**（从 `Layout-main` 开始，
// 装了扩展、故页面上已是中文的节点——保存按钮的「保存」——是既有键的产物，
// 仍是英文的才是本批清单）。本页是**服务端渲染的传统 Primer 页面**
//（`Subhead` 之外还有 `Box` / `details` + `SelectMenu` / `turbo-frame`）。
//
// 本文件锁七件事：
//   ① 本页只命中 `pages/org-settings` + `global`，**不命中** `pages/settings` /
//      `pages/settings-billing` / `pages/repo-settings`；旧前缀 `/orgs/...` 同样命中；
//   ② 本批 36 条新键（其中 3 条只出现在按钮的 aria-label 上）在实机的真实节点上
//      全部命中（含带源码缩进与换行的形态）；
//   ③ 本页正文与个人设置的 /settings/interaction_limits **几乎逐字相同**，但那条
//      路由 `^/(?:settings|account/billing)` 不命中 /organizations/**，故本模块
//      各收一份并**逐字同译**——用例对同串节点断言两份视图的译文逐字相等；
//   ④ 组织侧独有的三处措辞是**新键而不是别名**（个人页那三串在本模块必须不命中）；
//   ⑤ 页首说明的两句**同属一个文本节点**（原文之间只有空行），整段一条键——
//      个人页那条只覆盖第一句，两条不同的键不得互相顶替；
//   ⑥ 拉取请求上限那句被 `<strong>数字</strong>` 切成三段，数字之后的整句走
//      `org-settings/pr-cap-limit` 规则（数字由输入框决定，单复数同一条规则）；
//   ⑦ 页首 H2 没有出现在贴出的 HTML 里，故 `Interaction limits`（侧栏键，覆盖
//      「H2 与侧栏项同串」的形态）与 `Temporary interaction limits`（兜底）都锁住。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织交互限制页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/interaction_limits";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/interaction_limits";

const locale = dictForLocale("zh-CN");

/** 本页命中的模块视图（pages/org-settings + global） */
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 个人设置页那条路由的视图（用于断言两页同译；它**不**命中本页路径） */
const PERSONAL_VIEW = buildView(
	"/settings/interaction_limits",
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 仓库级子页那条路由的视图（措辞是 this repository 单数，与本页互斥） */
const REPO_VIEW = buildView(
	"/octocat/Hello-World/settings/interaction_limits",
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本批新补的文本节点（按实机 HTML 的标签嵌套誊录） */
const NEW_NODES: readonly string[] = [
	// —— 页首三段说明 ——
	// 第一段两句在同一个文本节点里（原文之间只有一个空行）
	"Temporarily restrict which external users can interact with your repositories (comment, open issues, or create pull requests) for a configurable period of time. Users who are members of this organization will not be affected by these limits.",
	'This may be used to force a "cool-down" period during heated discussions or prevent unwanted interactions.',
	// 第三段被 `<strong>public repositories</strong>` 切成三段
	"Interaction limits may already exist in your organization's",
	"public repositories",
	". Any changes here will override those limits.",
	// —— 三档限制对象（标签 + 说明句各自成节点）——
	"Limit to existing users",
	"Users that have recently created their account will be unable to interact with this organization's repositories.",
	"Limit to prior contributors",
	"Users that have not previously committed to the default branch of a repository in this organization will be unable to interact with that repository.",
	"Limit to repository collaborators",
	"Users that are not collaborators of a repository in this organization will not be able to interact with that repository.",
	// —— 五个状态标签（每张卡片下方那一行小字，图标是 SVG）——
	"New users",
	"Users",
	"Contributors",
	"Collaborators",
	"Organization members",
	// —— 三张卡片的按钮与下拉 ——
	"Enable",
	"Enable interaction limits for:",
	"24 hours",
	"3 days",
	"1 week",
	"1 month",
	"6 months",
	// —— 同一页的拉取请求上限（turbo-frame org-pull-request-creation-cap）——
	"Pull request limits",
	"Restrict how many pull requests users without write access can have open at one time in any single public repository in this organization. A limit configured on an individual repository overrides this setting. This setting stays in effect until you change it.",
	"Currently, users without write access can open an unlimited number of pull requests.",
	// 「当前上限」那句的前缀（数字之后的整句走规则，见下方用例）
	"Currently, users without write access can have up to",
	"Limit open pull requests from users without write access",
	"Maximum open pull requests per user",
	"Enter a number from 1 to 1000",
	"Enter a number from 1 to 1000. Users who have more open pull requests than the above limit will not be able to create new pull requests in the repository.",
	"Count draft pull requests toward the limit",
];

/** 三张卡片按钮上的 aria-label（属性只走精确命中） */
const ATTRS: readonly string[] = [
	"Enable interaction limit to existing users",
	"Enable interaction limit to prior contributors",
	"Enable interaction limit to repository collaborators",
];

/** 页面上已是中文的节点（既有键的产物，用作「扩展确实在这一页生效」的对照物） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	// 侧栏项与 H2 同串（另两页的 H2 都在 dump 里，形态一致）
	["Interaction limits", "互动限制"],
	["Save", "保存"],
];

/**
 * 必须保持英文：个人页 / 仓库级子页的措辞（本模块的路由拿不到，也不该被别名吃掉）、
 * 有意不收录的串与用户内容。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 个人设置页的复数措辞（pages/settings）：本页说明句是「…this organization's…」，
	// 那条只覆盖第一句的键与三条限制说明都不该在本页命中
	"Temporarily restrict which external users can interact with your repositories (comment, open issues, or create pull requests) for a configurable period of time.",
	"Users that have recently created their account will be unable to interact with your repositories.",
	"Users that have not previously committed to the default branch of one of your repositories will be unable to interact with that repository.",
	"Users that are not collaborators of one of your repositories will not be able to interact with that repository.",
	"Interaction limits may already exist in your account's",
	// 仓库级子页（pages/repo-settings）的措辞：本页多出的
	// 「in any single public repository in this organization」与「Draft …」两句
	"Restrict how many pull requests users without write access can have open at one time and add specific users to a bypass list. These settings stay in effect until you change them.",
	"open pull request at a time.",
	"Enter a number from 1 to 1000. Users who have more open PRs than the above limit will not be able to create new PRs.",
	// 用户内容
	"Koishi-CE",
];

/**
 * 与个人设置页**同串**的节点（那条路由不命中本页）：本模块各收一份并逐字同译，
 * 同一个词在两页不能有两副面孔。
 */
const SHARED_WITH_PERSONAL: readonly string[] = [
	'This may be used to force a "cool-down" period during heated discussions or prevent unwanted interactions.',
	"Enable interaction limits for:",
	"Limit to existing users",
	"Limit to prior contributors",
	"Limit to repository collaborators",
	"New users",
	"Users",
	"Contributors",
	"Collaborators",
	"24 hours",
	"3 days",
	"1 week",
	"1 month",
	"6 months",
	"Enable interaction limit to existing users",
	"Enable interaction limit to prior contributors",
	"Enable interaction limit to repository collaborators",
	"public repositories",
	". Any changes here will override those limits.",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白，最后拼接成页面上真实看到的那一行。
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

describe("组织交互限制页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the personal, billing or per-repository modules", () => {
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

describe("组织交互限制页的实机节点", () => {
	it("translates every newly registered node", () => {
		for (const node of [...NEW_NODES, ...ATTRS]) {
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
		for (const raw of SHARED_WITH_PERSONAL) {
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

	it("gives the organization wording its own keys", () => {
		// 组织侧独有的三处措辞（个人页那三串在本页必须不命中，见 MUST_STAY_ENGLISH）
		expect(
			translateText("Limit to existing users", view),
		).toBe("限制为现有用户");
		expect(
			translateText(
				"Users that have recently created their account will be unable to interact with this organization's repositories.",
				view,
			),
		).toBe("最近创建账户的用户将无法与此组织的仓库交互。");
		expect(
			translateText(
				"Users that have not previously committed to the default branch of a repository in this organization will be unable to interact with that repository.",
				view,
			),
		).toBe(
			"此前未曾向此组织内任一仓库的默认分支提交过的用户将无法与该仓库交互。",
		);
		expect(
			translateText(
				"Users that are not collaborators of a repository in this organization will not be able to interact with that repository.",
				view,
			),
		).toBe(
			"不是此组织内任一仓库协作者的用户将无法与该仓库交互。",
		);
	});

	it("covers both possible renderings of the page heading", () => {
		// 本模块既有键 `Interaction limits` 覆盖「H2 与侧栏项同串」那种形态
		//（另两页的 H2 正是这种），而个人设置页的 H2 是 `Temporary interaction limits`
		//——本页贴出的 HTML 里没有 H2，故两种形态都收，实机确认后删掉多余的那条
		expect(translateText("Interaction limits", view)).toBe(
			"互动限制",
		);
		expect(
			translateText("Temporary interaction limits", view),
		).toBe("临时交互限制");
	});
});

describe("组织交互限制页的节点切分事实", () => {
	it("keeps the organization intro apart from the personal one", () => {
		// 本页页首那段是**一个文本节点**（两句之间只有源码空行），故整段一条键；
		// 个人页那条只覆盖第一句——两条不同的键，不得互相顶替
		expect(
			translateText(
				"Temporarily restrict which external users can interact with your repositories (comment, open issues, or create pull requests) for a configurable period of time. Users who are members of this organization will not be affected by these limits.",
				view,
			),
		).toBe(
			"在可配置的一段时间内，临时限制哪些外部用户可与你的仓库交互（发表评论、打开议题或创建拉取请求）。本组织的成员不受这些限制影响。",
		);
		// 反例：拿个人页那条只覆盖第一句的键来查本页视图，必须不命中
		expect(
			translateText(
				"Temporarily restrict which external users can interact with your repositories (comment, open issues, or create pull requests) for a configurable period of time.",
				view,
			),
		).toBeNull();
	});

	it("reassembles the existing-limits hint across its three nodes", () => {
		// 实机：`Interaction limits may already exist in your organization's
		// <strong>public repositories</strong>. Any changes here will override those limits.`
		// ——句号落在 `<strong>` 之后的那个节点上，故尾段译文以「中。」起头
		expect(
			renderNodes([
				"\n    Interaction limits may already exist in your organization's ",
				"public repositories",
				".\n    Any changes here will override those limits.\n  ",
			]),
		).toBe(
			"\n    交互限制可能已存在于你的组织的 公开仓库中。此处的任何更改都会覆盖那些限制。\n  ",
		);
	});

	it("reassembles the pull-request cap sentence around the number node", () => {
		// 实机：`…can have up to <strong>1</strong> open pull request at a time in each
		// public repository in this organization. Draft pull requests do not count …`
		// ——纯数字节点被引擎跳过（不含拉丁字母），前后两段的空白由 walker 保留
		expect(
			renderNodes([
				"\n      Currently, users without write access can have up to ",
				"1",
				" open pull request at a time in each public repository in this organization.\n          Draft pull requests do not count toward this limit.\n        ",
			]),
		).toBe(
			"\n      当前，没有写权限的用户最多可同时打开 1 个拉取请求。草稿拉取请求不计入此上限。\n        ",
		);
	});

	it("covers the plural form of the cap sentence through the rule", () => {
		// 上限由输入框决定（1–1000）：数字变成 5 之后上游会把 `pull request`
		// 变成复数，故规则用 `s?` 覆盖两种形态，不留中英残句
		expect(
			translateText(
				"open pull request at a time in each public repository in this organization. Draft pull requests do not count toward this limit.",
				view,
			),
		).toBe("个拉取请求。草稿拉取请求不计入此上限。");
		expect(
			translateText(
				"open pull requests at a time in each public repository in this organization. Draft pull requests do not count toward this limit.",
				view,
			),
		).toBe("个拉取请求。草稿拉取请求不计入此上限。");
		// 锚定：仓库级子页那条静态键（只有前半句）不该被本规则吃掉，
		// 本页视图里也不存在那条键
		expect(
			translateText("open pull request at a time.", view),
		).toBeNull();
		expect(
			translateText(
				"open pull requests at a time in this organization.",
				view,
			),
		).toBeNull();
		// 规则锚定在句首小写 `open`：大写开头的整句不该被部分替换
		expect(
			translateText(
				"Open pull request at a time in each public repository in this organization. Draft pull requests do not count toward this limit.",
				view,
			),
		).toBeNull();
		// 对照物：仓库级子页视图里那条静态键仍然有效（两页的尾部措辞不同）
		expect(
			translateText(
				"open pull request at a time.",
				REPO_VIEW,
			),
		).toBe("个拉取请求。");
	});
});
