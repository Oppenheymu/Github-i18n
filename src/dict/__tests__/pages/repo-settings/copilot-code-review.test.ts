// 仓库设置页的「Copilot 代码审查」子页（/owner/repo/settings/copilot/code_review）实机文本回归。
//
// 证据：维护者 2026-10-17 贴的整页实机 HTML（`<react-app app-name="copilot-code-review-repo-settings">`，
// URL 为 /Oppenheymu/Github-i18n/settings/copilot/code_review）。采集时扩展仍在运行，
// 页面上已是中文的 `Copilot 代码审查` / `MCP 服务器` / `开` / `新建` / `预览` 都是既有键的产物。
//
// 本页正文由 React 组件渲染，四条说明段被行内链接切成多个文本节点（整句键在实机永不命中），
// 故按「前段 / 链接 / 后段」逐条收，本文件同时锁定三条拼接结果与改写后的节点边界。
// 与组织级同页（/organizations/<组织>/settings/copilot/code_review）文案重合的键在本模块各收一份
// 并同译：两条路由互斥，组织级那条拿不到本模块的词条（反例断言见文件末尾）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /Oppenheymu/Github-i18n/settings/copilot/code_review 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/copilot/code_review",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文 */
const NODES: readonly (readonly [string, string])[] = [
	[
		"With Copilot code review, you can add Copilot as a reviewer to your pull requests, including drafts. You can also select lines in Visual Studio Code and ask Copilot to review and comment on specific sections.",
		"借助 Copilot 代码审查，你可以将 Copilot 添加为拉取请求的审查者，包括草稿拉取请求。你还可以在 Visual Studio Code 中选择代码行，让 Copilot 审查并评论特定代码段。",
	],
	[
		"Learn more about Copilot code reviews.",
		"进一步了解 Copilot 代码审查。",
	],
	[
		"No Copilot code review access",
		"无 Copilot 代码审查访问权限",
	],
	[
		"Copilot code review isn't enabled for your account, but these settings still apply to people who have access to Copilot code review.",
		"你的账户未启用 Copilot 代码审查，但这些设置仍会适用于有权使用 Copilot 代码审查的人员。",
	],
	[
		"Configure Copilot code review",
		"配置 Copilot 代码审查",
	],
	[
		"Allow Copilot to use MCP tools when reviewing pull requests",
		"允许 Copilot 在审查拉取请求时使用 MCP 工具",
	],
	[
		"When enabled, Copilot can call MCP tools configured in",
		"启用后，Copilot 可以调用配置在",
	],
	["during code reviews.", "中的 MCP 工具来进行代码审查。"],
	["Review effort level", "审查力度级别"],
	[
		"Controls the depth of analysis when Copilot reviews pull requests.",
		"控制 Copilot 审查拉取请求时的分析深度。",
	],
	["Default (Balanced)", "默认（均衡）"],
	["Approvals", "批准"],
	[
		"Allow Copilot to approve pull requests",
		"允许 Copilot 批准拉取请求",
	],
	[
		"When enabled, Copilot can approve pull requests, and those approvals can count toward merge requirements.",
		"启用后，Copilot 可以批准拉取请求，且这些批准可以计入合并要求。",
	],
	[
		"Manage Copilot code review automations",
		"管理 Copilot 代码审查自动化",
	],
	[
		"Use rulesets to automatically request reviews and more.",
		"使用规则集自动请求审查等。",
	],
	[
		"Learn how to set up rulesets.",
		"进一步了解如何设置规则集。",
	],
	["No rulesets", "无规则集"],
	["View all rulesets", "查看所有规则集"],
	[
		"Automate Copilot code reviews",
		"自动化 Copilot 代码审查",
	],
	[
		"Create ruleset for default branch",
		"为默认分支创建规则集",
	],
	["Advanced", "高级"],
	[
		"Use custom instructions when reviewing pull requests",
		"在审查拉取请求时使用自定义指令",
	],
	["Copilot references", "Copilot 会引用"],
	["repository custom instructions", "仓库自定义指令"],
	[
		"when reviewing pull requests.",
		"作为审查拉取请求时的参考。",
	],
	[
		"Only allow Copilot code review to be triggered by authorized users",
		"仅允许经授权的用户触发 Copilot 代码审查",
	],
	["When enabled,", "启用后，"],
	["external Copilot licenses", "外部 Copilot 许可证"],
	[
		"cannot run a Copilot review within this repository.",
		"无法在此仓库内运行 Copilot 审查。",
	],
];

/** 复刻 walker 的 lead / trail 保留语义：翻译只换节点正文，首尾空白留在节点上 */
const renderWithWhitespace = (
	nodes: readonly string[],
): string =>
	nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");

describe("仓库设置页的 Copilot 代码审查子页的实机节点边界", () => {
	it("translates every node the maintainer pasted", () => {
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("reassembles the MCP description cut by its link", () => {
		// 实机结构：`When enabled, … configured in <a>MCP 服务器</a> during code reviews.`
		// 链接文本由既有键 `MCP servers` 命中；三段拼起来必须读得通
		expect(
			renderWithWhitespace([
				"When enabled, Copilot can call MCP tools configured in ",
				"MCP servers",
				" during code reviews.",
			]),
		).toBe(
			"启用后，Copilot 可以调用配置在 MCP 服务器 中的 MCP 工具来进行代码审查。",
		);
	});

	it("reassembles the custom instructions description cut by its link", () => {
		const rendered = renderWithWhitespace([
			"Copilot references ",
			"repository custom instructions",
			" when reviewing pull requests.",
		]);
		expect(rendered).toBe(
			"Copilot 会引用 仓库自定义指令 作为审查拉取请求时的参考。",
		);
	});

	it("reassembles the authorized users description cut by its link", () => {
		const rendered = renderWithWhitespace([
			"When enabled, ",
			"external Copilot licenses",
			" cannot run a Copilot review within this repository. ",
		]);
		expect(rendered.trim()).toBe(
			"启用后， 外部 Copilot 许可证 无法在此仓库内运行 Copilot 审查。",
		);
	});

	it("keeps the organization-level wording out of this page", () => {
		// 组织级同页的措辞与本页互斥（路由互斥，合并任一条都会让另一页漏翻）
		expect(
			translateText(
				"With Copilot code review, you can get a thorough, automated first pass on every pull request — catching bugs and surfacing suggestions early, and freeing your team to focus on the changes that need human judgment. Copilot reviews pull requests across your organization's repositories and leaves its feedback as inline comments for authors to address.",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"Choose where Copilot can approve pull requests and where those approvals can count toward merge requirements.",
				view,
			),
		).toBeNull();
		expect(
			translateText("Default review effort level", view),
		).toBeNull();
		expect(translateText("Review effort", view)).toBeNull();
		expect(
			translateText(
				"When enabled, Copilot review requests require a Copilot license from this organization or its enterprise.",
				view,
			),
		).toBeNull();
	});

	it("keeps product names and user content in english", () => {
		// 专名与未渲染的下拉选项都不收录，未命中即保留英文
		for (const raw of [
			"Copilot",
			"GitHub",
			"Visual Studio Code",
			"Oppenheymu",
			"Github-i18n",
			"Lite",
			"Max",
		]) {
			expect(
				translateText(raw, view),
				`节点 ${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the bare Balanced option only when it stands alone", () => {
		// `Balanced` 是本模块既有键（另一处的选项值），下拉展开后单独成节点时会被译出；
		// 收起态的按钮文本是 `Default (Balanced)` 整节点，走上面那条独立键，两者互不干扰
		expect(translateText("Balanced", view)).toBe("均衡");
		expect(translateText("Default (Balanced)", view)).toBe(
			"默认（均衡）",
		);
	});
});
