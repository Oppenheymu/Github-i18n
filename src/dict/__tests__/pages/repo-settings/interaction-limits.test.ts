// 仓库设置页的「交互限制」子页（/owner/repo/settings/interaction_limits）实机文本回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，path 全为 /Oppenheymu/Github-i18n/settings/interaction_limits）。
// 该导出只给「文本 + kind + 出现次数」，不给节点边界，故按「导出条目本身就是一条键」登记：
// 带源码换行的条目按 normalizeKey 折叠空白后的形态写（那条 `… across your account
// \n      in your` 就是实例）。
//
// 页面级别由措辞判定（这是本次最容易踩错的一步）：本页条目一律说 **this repository**
// （单数），与账户级 /settings/interaction_limits 的 your repositories（复数）互斥，
// 故词条全部登记在 pages/repo-settings；账户级那套仍在 pages/settings。
// `Temporary interaction restrictions`（本页）与 `Temporary interaction limits`（账户级）
// 是两个不同的串，别合并。
//
// 刻意**不收录**（下方反例断言）：
//   - 品牌与缩写：`Dependabot` / `OIDC` / `Copilot` / `GitHub`；
//   - 快捷键文本：`alt shift r`（界面里的按键提示，与 `kbd` 一类）；
//   - 用户内容：`Oppenheymu` / `Github-i18n` / `M. Oppenheymu` / `@Oppenheymu`。
// 未命中即保留英文，这才是正确做法。
//
// 已知不确定处（导出条目无法区分）：`Add users` 到底是「绕过名单」区块里的独立按钮，
// 还是 `Add users to bypass list` 这类标签的一部分——两条都按独立节点登记，无害；
// 同理 `items`（选中计数后缀）与 `General settings`（aria-label）只按导出串登记。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /Oppenheymu/Github-i18n/settings/interaction_limits 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/interaction_limits",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 导出清单里的条目（原文 → 期望译文），顺序按导出里的条目顺序 */
const NODES: readonly (readonly [string, string])[] = [
	["Users", "用户"],
	["Enable", "启用"],
	["1 month", "1 个月"],
	["1 week", "1 周"],
	["24 hours", "24 小时"],
	["3 days", "3 天"],
	["6 months", "6 个月"],
	["New users", "新用户"],
	// 下拉（SelectMenu）的标题（`<h3 class="SelectMenu-title">`）：键与账户级同串，
	// 本模块此前漏译，2026-09-27 维护者在实机上发现
	[
		"Enable interaction limits for:",
		"为以下对象启用交互限制：",
	],
	[
		"Enable interaction limit to prior contributors",
		"为之前的贡献者启用交互限制",
	],
	["Limit to prior contributors", "限制为之前的贡献者"],
	["committed", "提交过代码"],
	[
		"Users that have not previously",
		"此前未曾向此仓库主分支",
	],
	[
		"to the main branch of this repository will be unable to interact with the repository.",
		"的用户将无法与此仓库交互。",
	],
	["Limit to existing users", "限制为现有用户"],
	[
		"Enable interaction limit to existing users",
		"为现有用户启用交互限制",
	],
	[
		"Users that have recently created their account will be unable to interact with the repository.",
		"最近创建账户的用户将无法与此仓库交互。",
	],
	["Add users to bypass list", "将用户加入绕过名单"],
	["account settings", "账户设置"],
	["Add users", "添加用户"],
	[
		"You can restrict repository interactions across your account in your",
		"你可以在你的",
	],
	["Temporary interaction restrictions", "临时交互限制"],
	["Bypass list", "绕过名单"],
	[
		"Temporarily restrict which external users can interact with your repository (comment, open issues, or create pull requests) for a configurable period of time.",
		"在可配置的一段时间内，临时限制哪些外部用户可与你的仓库交互（发表评论、打开议题或创建拉取请求）。",
	],
	[
		'This may be used to force a "cool-down" period during heated discussions or prevent unwanted interactions.',
		"这可用于在激烈讨论期间强制设置「冷却」期，或防止不受欢迎的交互。",
	],
	[
		"Users listed here can open pull requests regardless of the configured limit.",
		"此处列出的用户不受所设上限的限制，可打开拉取请求。",
	],
	[
		"No users can bypass the open pull request limit",
		"没有用户可以绕过拉取请求上限",
	],
	[
		"Enter a number from 1 to 1000",
		"请输入 1 到 1000 之间的数字",
	],
	[
		"Enter a number from 1 to 1000. Users who have more open PRs than the above limit will not be able to create new PRs.",
		"请输入 1 到 1000 之间的数字。打开的 PR 数超过上述上限的用户将无法创建新的 PR。",
	],
	["Limit to repository collaborators", "限制为仓库协作者"],
	[
		"Maximum open pull requests per user",
		"每位用户最多可打开的拉取请求数",
	],
	["collaborators", "协作者"],
	[
		"Enable interaction limit to repository collaborators",
		"为仓库协作者启用交互限制",
	],
	["Users that are not", "不是此仓库"],
	[
		"will not be able to interact with the repository.",
		"的用户将无法与此仓库交互。",
	],
	[
		"Limit open pull requests from users without write access",
		"限制没有写权限的用户打开拉取请求",
	],
	["items", "项"],
	[
		"Currently, users without write access can have up to",
		"当前，没有写权限的用户最多可同时打开",
	],
	[
		"Currently, users without write access can open an unlimited number of pull requests.",
		"当前，没有写权限的用户可以打开不限数量的拉取请求。",
	],
	["open pull request at a time.", "个拉取请求。"],
	["Pull request limits", "拉取请求上限"],
	[
		"Restrict how many pull requests users without write access can have open at one time and add specific users to a bypass list. These settings stay in effect until you change them.",
		"限制没有写权限的用户同时可以打开多少个拉取请求，并可将特定用户加入绕过名单。这些设置会一直生效，直到你更改它们为止。",
	],
];

/** 导出里的用户内容 / 品牌 / 快捷键：整节点不收录，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Dependabot",
	"OIDC",
	"Copilot",
	"GitHub",
	"alt shift r",
	"Oppenheymu",
	"Github-i18n",
	"M. Oppenheymu",
	"@Oppenheymu",
];

describe("仓库设置页的交互限制子页的实机节点边界", () => {
	it("translates every entry the miss export lists", () => {
		for (const [node, expected] of NODES) {
			// 两种形态都要命中：实机常带源码缩进，归一化空白后等于词典键
			for (const variant of [
				node,
				`\n        ${node}\n      `,
			]) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps brand names, shortcuts and user content in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("reassembles the three split sentences into readable chinese", () => {
		// 三处被链接 / 换行拆开的节点，拼起来必须读得通（译文不带首尾空格）
		const render = (nodes: readonly string[]) =>
			nodes
				.map((node) => translateText(node, view) ?? node)
				.join("");
		// 「Users that have not previously <committed 链接> to the main branch …」
		expect(
			render([
				"Users that have not previously",
				"committed",
				"to the main branch of this repository will be unable to interact with the repository.",
			]),
		).toBe(
			"此前未曾向此仓库主分支提交过代码的用户将无法与此仓库交互。",
		);
		// 「Users that are not <collaborators 链接> will not be able …」
		expect(
			render([
				"Users that are not",
				"collaborators",
				"will not be able to interact with the repository.",
			]),
		).toBe("不是此仓库协作者的用户将无法与此仓库交互。");
		// 「You can restrict … in your <account settings 链接>.」
		expect(
			render([
				"You can restrict repository interactions across your account in your",
				"account settings",
			]),
		).toBe("你可以在你的账户设置");
	});

	it("keeps this page's wording apart from the account-level wording", () => {
		// 账户级 /settings/interaction_limits 的是复数措辞 + 另一个标题串，
		// 本页（仓库级）是单数措辞；这里断言本页视图**不**命中账户级那两条，
		// 免得日后有人「顺手统一」把两页的串合并
		expect(
			translateText(
				"Users that have recently created their account will be unable to interact with your repositories.",
				view,
			),
		).toBeNull();
		expect(
			translateText("Temporary interaction limits", view),
		).toBeNull();
	});
});
