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
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

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
	// 弃用横幅前段已改走 repo-settings/actions-deprecation-date 规则：
	// 日期原样带回（不再本地化成「2026 年 11 月 2 日」），下面 2026-10-25 的
	// describe 里有 December 2 版本的同断言
	[
		"On November 2, 2026, GitHub will restrict",
		"November 2, 2026，GitHub 将限制",
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
		// 复刻 walker 的空白保留语义（见 repo-settings/code-review-limits.test.ts）
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
			"November 2, 2026，GitHub 将限制 pull_request_target 在公开仓库中的使用。要继续允许该事件触发器，请配置一个 Actions 策略。",
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

// —— 2026-10-25 维护者导出的漏翻清单 ——
// 三处上游变动：
//   1. 弃用横幅的日期从 November 2 推迟到 December 2（还会再动）——原静态键作废，
//      改 repo-settings/actions-deprecation-date 规则按日期捕获；
//   2. fork 批准说明在仓库页也用上了带组织名的长句（组织侧是 `the repository`，
//      仓库页是 `this repository`，两条串不同）——repo-settings/actions-fork-approvals-org-repo；
//   3. 策略页 / 规则集页的新筛选框与空态，以及规则集列表行的裸计数。
describe("仓库设置页 Actions 策略三支 2026-10-25 的上游变动", () => {
	it("translates the deprecation banner with a captured date", () => {
		// 日期原样带回（保持英文格式）；后段是既有静态键，拼接后读得通
		expect(
			translateText(
				"On December 2, 2026, GitHub will restrict",
				view,
			),
		).toBe("December 2, 2026，GitHub 将限制");
		expect(
			translateText(
				"On November 2, 2026, GitHub will restrict",
				view,
			),
		).toBe("November 2, 2026，GitHub 将限制");
		expect(
			translateText(
				"on public repositories by default. To continue allowing the event trigger, configure an Actions policy.",
				view,
			),
		).toBe(
			"在公开仓库中的使用。要继续允许该事件触发器，请配置一个 Actions 策略。",
		);
	});

	it("translates the org-scoped fork approvals long form on the repo page", () => {
		// 上游给仓库页也用上带组织名的长句，且把组织侧的 the 写成 this；
		// 组织侧那条规则（org-settings）不命中本页，本条是仓库侧自己的规则
		expect(
			translateText(
				"All users that are not a member or owner of this repository and not a member of the NapukettoDev organization will require approval to run workflows.",
				view,
			),
		).toBe(
			"所有不是此仓库成员或所有者、也不是 NapukettoDev 组织成员的用户，都需要批准才能运行工作流。",
		);
		// 组织侧串（the repository）在本页保持英文——两条路由互斥的反例
		expect(
			translateText(
				"All users that are not a member or owner of the repository and not a member of the Koishi-CE organization will require approval to run workflows.",
				view,
			),
		).toBeNull();
	});

	it("translates the filter bar and blankslate on the rules page", () => {
		expect(
			translateText("Filter rules insights", view),
		).toBe("筛选规则洞察");
		expect(
			translateText(
				"No rule evaluations matched your search",
				view,
			),
		).toBe("没有与你的搜索匹配的规则评估记录");
		expect(translateText("Search or filter", view)).toBe(
			"搜索或筛选",
		);
		expect(translateText("Suggestions", view)).toBe("建议");
	});

	it("translates the bare branch rules count and the disabled-by status", () => {
		// 规则集列表行（/settings/rules）上游把 `N branch rules • targeting M branches`
		// 拆开渲染，行尾只剩裸计数；Disabled by <组织> 出现在 Code Quality / Deploy keys 页
		expect(translateText("8 branch rules", view)).toBe(
			"8 条分支规则",
		);
		expect(
			translateText("Disabled by NapukettoDev", view),
		).toBe("由 NapukettoDev 停用");
		// 完整句按键命中，不受 disabled-by 规则影响
		expect(
			translateText("Disabled by your organization.", view),
		).toBe("已被你的组织停用。");
	});
});
