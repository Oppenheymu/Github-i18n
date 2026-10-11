// 组织级 OIDC 配置页（/organizations/<组织>/settings/actions/oidc-configuration）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML（`<react-app
// app-name="actions-oidc-configuration">`，采集时扩展仍在运行）。
//
// 这一页是本模块出现次数最多的那种情形的**干净样本**：页面上**一个中文都没有**，
// 连「本来该译的短标签」也是英文——因为同串词条全都躺在 pages/repo-settings 里
//（仓库级 `/owner/repo/settings/actions/oidc-configuration` 早在 2026-09-27 就收过，
// 见 repo-settings/actions-policies.test.ts），而那条路由**排除 organizations|orgs**
// ⇒ 组织路径上一条都不命中。所以本批的重点不是「新文案多」，而是**同串再收一份**。
//
// 四条边界事实：
//   1. 与仓库级同串的八条逐字同译（本文件对两边视图各断言一次，钉住「同一项两副面孔」
//      这个回归）；仓库级独有的四条状态文案（`Default subject claim prefix` /
//      `Copy subject claim prefix` / `Use default template` /
//      `Automatically enabled for this repository…`）本页**没有渲染**，故不收；
//   2. 模板变量的示例 `repo, context, ref` 是 textarea 的 placeholder——属性只走词条
//      查表，且这三个词是用户照抄进输入框的**变量名（提交值）**，翻译即误伤，
//      故有意不收录（未命中即保留英文，这是正确行为）；
//   3. 两处说明都被链接切成两段（`…variables. ` + 链接文字），长句末尾的句点跟着
//      前一段走，故中文里保留一个半角句点加空格，与链接之间不会多出标点；
//   4. document.title 是 `OIDC Configuration · Koishi-CE`——**没有** `Settings · `
//      前缀（页头 h2 则是小写的 `OIDC configuration`），通用规则兜不住，故本批新增
//      一条专用规则 org-settings/oidc-configuration-title。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织级 OIDC 配置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/actions/oidc-configuration";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/actions/oidc-configuration";
/** 仓库级的同款页面：那八条同串词条在那边，用于断言两边逐字同译 */
const REPO_PATH =
	"/Oppenheymu/Github-i18n/settings/actions/oidc-configuration";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));
const view = buildView(PAGE_PATH, locale, aliases);
const repoView = buildView(REPO_PATH, locale, aliases);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 与仓库级同串、本批按组织路径再收一份的八条 */
const SHARED_WITH_REPO: readonly (readonly [
	string,
	string,
])[] = [
	["OIDC configuration", "OIDC 配置"],
	["Subject claim", "主题声明"],
	[
		"Customize claims included in the OIDC token.",
		"自定义 OIDC 令牌中包含的声明。",
	],
	[
		"Customize the subject (sub) claim in the OIDC token, used to identify the workflow run context.",
		"自定义 OIDC 令牌中的主题（sub）声明，用于标识工作流运行上下文。",
	],
	[
		"Learn more about OIDC tokens.",
		"进一步了解 OIDC 令牌。",
	],
	[
		"Learn more about immutable subject claims.",
		"进一步了解不可变主题声明。",
	],
	["Save subject claim", "保存主题声明"],
	["Use immutable subject claim", "使用不可变主题声明"],
];

/** 组织侧独有（仓库页那支的模板字段是只读的，没有这个标签与两段说明） */
const ORG_ONLY: readonly (readonly [string, string])[] = [
	["Subject claim template", "主题声明模板"],
	[
		"Order-dependent list of comma-separated template variables.",
		"顺序相关的、以逗号分隔的模板变量列表。",
	],
	[
		"List of available template variables.",
		"可用模板变量列表。",
	],
	[
		"Improve security by including unique identifiers in the subject claim, ensuring that trust policies cannot be assumed by a different repository or organization with the same name.",
		"通过在主题声明中包含唯一标识符来提升安全性，确保信任策略不会被同名的其他仓库或组织冒用。",
	],
	["Custom property claims", "自定义属性声明"],
	[
		"Specify which custom properties should be included as claims in the OIDC token.",
		"指定哪些自定义属性应作为声明包含在 OIDC 令牌中。",
	],
	["No custom properties defined", "未定义自定义属性"],
	[
		"Define custom properties to include them as claims in OIDC tokens.",
		"定义自定义属性，以将其作为声明包含在 OIDC 令牌中。",
	],
	[
		"Learn more about repository custom properties.",
		"进一步了解仓库自定义属性。",
	],
	["Manage custom properties", "管理自定义属性"],
];

/** 必须保持英文：提交值、payload 字段名与应用名 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// textarea 的 placeholder：用户照抄的模板变量名（提交值）
	"repo, context, ref",
	// payload 字段与应用名
	"actions-oidc-configuration",
	"subjectClaimKeys",
	"includedProperties",
	"propertyCount",
	"showImmutableSubjectClaim",
	"useImmutableSubject",
	"actions_oidc_custom_repo_properties",
	// 组织名是用户内容
	"Koishi-CE",
];

/** 按 walker 语义翻译节点，保留原文首尾空白后拼接 */
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

describe("组织级 OIDC 配置页的模块路由", () => {
	it("loads org-settings and the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match repository or account settings", () => {
		// 这正是整页英文的根因：仓库设置的词条包在组织路径上一条都不注入
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy organization prefix", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织级 OIDC 配置页的实机节点", () => {
	it("translates the shared strings exactly like the repository module", () => {
		for (const [raw, expected] of SHARED_WITH_REPO) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			// 仓库级模块的同串在组织路径上不命中，故各收一份并钉成同译
			expect(
				translateText(raw, repoView),
				`与仓库级模块不同译：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("translates the strings only the organization page renders", () => {
		for (const [raw, expected] of ORG_ONLY) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps submit values, payload fields and the organization in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织级 OIDC 配置页的节点边界", () => {
	it("renders the page header with its documentation link", () => {
		expect(
			renderNodes([
				"Customize claims included in the OIDC token. ",
				"Learn more about OIDC tokens.",
			]),
		).toBe(
			"自定义 OIDC 令牌中包含的声明。 进一步了解 OIDC 令牌。",
		);
	});

	it("renders the template caption with its link", () => {
		// 句点在链接**之前**、留在前一段里，故中文段落以「。」收尾
		expect(
			renderNodes([
				"Order-dependent list of comma-separated template variables. ",
				"List of available template variables.",
			]),
		).toBe(
			"顺序相关的、以逗号分隔的模板变量列表。 可用模板变量列表。",
		);
	});

	it("renders the immutable claim caption with its link", () => {
		expect(
			renderNodes([
				"Improve security by including unique identifiers in the subject claim, ensuring that trust policies cannot be assumed by a different repository or organization with the same name. ",
				"Learn more about immutable subject claims.",
			]),
		).toBe(
			"通过在主题声明中包含唯一标识符来提升安全性，确保信任策略不会被同名的其他仓库或组织冒用。 进一步了解不可变主题声明。",
		);
	});

	it("renders the empty custom property claims section", () => {
		expect(
			renderNodes([
				"Custom property claims",
				"Specify which custom properties should be included as claims in the OIDC token.",
				"No custom properties defined",
				"Define custom properties to include them as claims in OIDC tokens. ",
				"Learn more about repository custom properties.",
				"Manage custom properties",
			]),
		).toBe(
			"自定义属性声明指定哪些自定义属性应作为声明包含在 OIDC 令牌中。未定义自定义属性定义自定义属性，以将其作为声明包含在 OIDC 令牌中。 进一步了解仓库自定义属性。管理自定义属性",
		);
	});

	it("keeps the template variable example in the textarea placeholder", () => {
		// `repo, context, ref` 只出现在 placeholder 上（属性只走词条查表）；
		// 它是提交值，未登记 ⇒ 整串保留英文，而不是渲染出中英混杂的示例
		expect(
			translateText("repo, context, ref", view),
		).toBeNull();
		// 空 textarea 没有文本节点，唯一的可翻译属性就是这条 placeholder
		expect(translateText("", view)).toBeNull();
	});
});

describe("组织级 OIDC 配置页的 document.title", () => {
	it("spells the page name in Chinese through the dedicated rule", () => {
		// 本页标题**没有** `Settings · ` 前缀，通用规则兜不住，走专用规则
		expect(
			translateText("OIDC Configuration · Koishi-CE", view),
		).toBe("OIDC 配置 · Koishi-CE");
	});

	it("keeps the case of the title distinct from the heading", () => {
		// 大写 C 只出现在标题上：专用规则**大小写敏感**，万一上游把标题也改成小写，
		// 整条保留英文（通用规则要求 `Settings` 前缀），不会产出半截译文
		expect(translateText("OIDC configuration", view)).toBe(
			"OIDC 配置",
		);
		expect(
			translateText("OIDC configuration · Koishi-CE", view),
		).toBeNull();
	});

	it("lets the generic rule keep other organization pages as they were", () => {
		expect(
			translateText(
				"Settings · Repository policies · Koishi-CE",
				view,
			),
		).toBe("设置 · Repository policies · Koishi-CE");
		expect(
			translateText(
				"Settings · Actions policies · Koishi-CE",
				view,
			),
		).toBe("设置 · Actions 策略 · Koishi-CE");
	});
});
