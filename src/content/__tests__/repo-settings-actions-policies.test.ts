// 仓库设置页的「Actions 策略」三支实机文本回归：
//   /owner/repo/settings/actions/rules            策略列表
//   /owner/repo/settings/actions/rules/insights   策略洞察
//   /owner/repo/settings/actions/oidc-configuration  OIDC 配置
//
// 证据：维护者 2026-09-27 用途径 A 分别导出的三份漏翻清单。
// 页面级别与同模块的其余子页一致（pages/repo-settings）。
//
// 本页群最关键的三条边界事实：
//   1. 策略列表的弃用横幅被 `<code>pull_request_target</code>` 切成两段（排除容器内不翻），
//      两段译文拼起来读作「…将限制 pull_request_target 在公开仓库中的使用。」；
//   2. 洞察页那句「See how rulesets are affecting this **repository**」里，`repository`
//      是链接文本、单独成节点，故与前面的片段各成一条键；
//   3. OIDC 标题在实机有两种大小写形态（`OIDC Configuration` / `OIDC configuration`），
//      是两条不同的键——大小写混用会被本用例挡住。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** 三个页面同属一个模块（规则是模块级的，故一份视图即可覆盖） */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/actions/rules",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文（三份清单里除专名 / 用户内容外的全部条目） */
const NODES: readonly (readonly [string, string])[] = [
	// —— /settings/actions/rules ——
	["Actions policies", "Actions 策略"],
	["New policy", "新建策略"],
	["policies", "策略"],
	[
		"Define whether actions can run in specific contexts.",
		"定义操作是否可以在特定上下文中运行。",
	],
	[
		"You haven't created any policies",
		"你还没有创建任何策略",
	],
	[
		"Learn more about pull_request_target restrictions",
		"进一步了解 pull_request_target 限制",
	],
	[
		"On November 2, 2026, GitHub will restrict",
		"2026 年 11 月 2 日，GitHub 将限制",
	],
	[
		"on public repositories by default. To continue allowing the event trigger, configure an Actions policy.",
		"在公开仓库中的使用。要继续允许该事件触发器，请配置一个 Actions 策略。",
	],
	// —— /settings/actions/rules/insights ——
	["Actions policy insights", "Actions 策略洞察"],
	[
		"Enterprise accounts enable you to review commits against rulesets to track pass, fail, or bypass status for greater oversight and understanding.",
		"企业账户让你可以对照规则集审查提交，以跟踪通过、失败或绕过状态，从而获得更强的监督与理解。",
	],
	[
		"See how rulesets are affecting this",
		"查看规则集如何影响此",
	],
	["repository", "仓库"],
	// —— /settings/actions/oidc-configuration ——
	["OIDC Configuration", "OIDC 配置"],
	["OIDC configuration", "OIDC 配置"],
	[
		"Automatically enabled for this repository. Repositories created or renamed after July 15, 2026 use immutable subject claims.",
		"此仓库已自动启用。2026 年 7 月 15 日之后创建或重命名的仓库使用不可变主题声明。",
	],
	// 这一串同时是可见文本与按钮的 aria-label，一条键覆盖两处
	["Copy subject claim prefix", "复制主题声明前缀"],
	[
		"Customize claims included in the OIDC token.",
		"自定义 OIDC 令牌中包含的声明。",
	],
	[
		"Customize the subject (sub) claim in the OIDC token, used to identify the workflow run context.",
		"自定义 OIDC 令牌中的主题（sub）声明，用于标识工作流运行上下文。",
	],
	["Default subject claim prefix", "默认主题声明前缀"],
	[
		"Learn more about OIDC tokens.",
		"进一步了解 OIDC 令牌。",
	],
	[
		"Learn more about immutable subject claims.",
		"进一步了解不可变主题声明。",
	],
	["Subject claim", "主题声明"],
	["Save subject claim", "保存主题声明"],
	["Use default template", "使用默认模板"],
	["Use immutable subject claim", "使用不可变主题声明"],
	[
		"Use this prefix when configuring trust policies in your cloud provider.",
		"在你的云提供商中配置信任策略时使用此前缀。",
	],
	[
		"When selected, use upstream template for the subject claim. Unselect to set a custom template.",
		"选中时，主题声明使用上游模板；取消选中即可设置自定义模板。",
	],
];

describe("仓库设置页的 Actions 策略三支实机节点边界", () => {
	it("translates every node of the three miss exports", () => {
		for (const [node, expected] of NODES) {
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

	it("reassembles the deprecation banner split by its <code>", () => {
		// 复刻 walker 的空白保留语义（见 repo-settings-code-review-limits.test.ts）
		const renderWithWhitespace = (
			nodes: readonly string[],
		) =>
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
		expect(
			renderWithWhitespace([
				"On November 2, 2026, GitHub will restrict ",
				"pull_request_target",
				" on public repositories by default. To continue allowing the event trigger, configure an Actions policy.",
			]),
		).toBe(
			"2026 年 11 月 2 日，GitHub 将限制 pull_request_target 在公开仓库中的使用。要继续允许该事件触发器，请配置一个 Actions 策略。",
		);
	});

	it("translates the two breadcrumb titles through rules", () => {
		expect(
			translateText(
				"Settings · Actions policies · Github-i18n",
				view,
			),
		).toBe("设置 · Actions 策略 · Github-i18n");
		expect(
			translateText(
				"Settings · Insights · Github-i18n",
				view,
			),
		).toBe("设置 · 洞察 · Github-i18n");
	});

	it("keeps product and account names in english", () => {
		for (const name of [
			"Dependabot",
			"OIDC",
			"Copilot",
			"GitHub",
			"Oppenheymu",
			"Github-i18n",
			"M. Oppenheymu",
			"@Oppenheymu",
			"alt shift r",
		]) {
			expect(
				translateText(name, view),
				`专名 ${name}`,
			).toBeNull();
		}
	});
});
