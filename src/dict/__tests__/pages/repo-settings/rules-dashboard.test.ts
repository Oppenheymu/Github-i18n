// 仓库设置页的规则集洞察 / 仪表盘 / 自定义属性页实机文本回归。
//
// 证据：2026-10-25 维护者贴出的 popup 漏翻导出（/NapukettoDev/NapukettoQQ/settings/rules*、
// …/settings/custom-properties）。这些页面的同串词条 2026-10-10 就登记在 pages/org-settings
//（组织版 /organizations/<组织>/settings/rules*），但两条路由互斥，仓库版拿不到组织模块的
// 词条——这就是「明明翻译过却整页英文」的成因，与组织 Actions 常规页那批同型。
// 故本模块逐字同译各收一份（Allowed / Selected repositories 先例），译文与组织版钉成相等。
//
// document.title 由 engine.start(document.documentElement) 连 head 一起翻：仪表盘页的
// title 恰好是侧栏同串键 `Ruleset dashboard`，列表页 / 洞察页的 title 走 title 系列规则。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const DASHBOARD_PATH =
	"/NapukettoDev/NapukettoQQ/settings/rules/dashboard";
const locale = dictForLocale("zh-CN");
const view = buildView(
	DASHBOARD_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文（与 pages/org-settings 的同串词条逐字同译） */
const NODES: readonly (readonly [string, string])[] = [
	// 页头
	["Repository ruleset dashboard", "仓库规则集仪表盘"],
	["Repository ruleset insights", "仓库规则集洞察"],
	["Ruleset dashboard", "规则集仪表板"],
	// 筛选框
	["Filter rule insights dashboard", "筛选规则洞察仪表盘"],
	["Search or filter", "搜索或筛选"],
	["Clear filter", "清除筛选"],
	// 图表卡外壳
	["Rule Suites", "规则套件"],
	["Chart options", "图表选项"],
	["Customization settings", "自定义设置"],
	["View as data table, Chart", "以数据表查看，图表"],
	["Interactive chart", "交互式图表"],
	["Interactive chart.", "交互式图表。"],
	["End of interactive chart.", "交互式图表结束。"],
	// 轴标题（同时是 SVG 里的可见文本）
	["Values", "数值"],
	["Actor", "操作者"],
	["Number of bypasses", "绕过次数"],
	// 指标卡
	["Allowed", "已允许"],
	["Failed", "失败"],
	["Bypassed", "已绕过"],
	["in the time period", "在该时间段内"],
	["View allowed runs", "查看已允许的运行"],
	["View failed runs", "查看失败的运行"],
	["View bypassed runs", "查看已绕过的运行"],
	// 柱状图标题与说明
	["Bypasses by actor", "按操作者统计的绕过"],
	[
		"Members who have bypassed the most",
		"绕过次数最多的成员",
	],
	// 图例 / 表头共用的三个计数名
	["Passes", "通过"],
	["Failures", "失败"],
	["Bypasses", "绕过"],
];

describe("仓库设置页的规则集仪表盘的实机节点边界", () => {
	it("hits the repo-settings module on the dashboard path", () => {
		// 组织版词条全在 pages/org-settings，本页命中的必须是仓库侧模块
		const names = matchModules(
			DASHBOARD_PATH,
			locale.modules,
		).map((m) => m.name);
		expect(names).toContain("pages/repo-settings");
		expect(names).not.toContain("pages/org-settings");
	});

	it("translates every node the maintainer exported", () => {
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("matches the organization module's wording verbatim", () => {
		// 同串同译是这次补齐的前提：仓库版与组织版的译文必须逐字一致，
		// 哪边单独改了措辞这条都会红。`Interactive chart.`（带句点）是本批
		// 从 pages/insights 抄来的键，组织版实机只渲染过不带句点的版本，
		// 故对照时跳过它
		const orgView = buildView(
			"/organizations/octocat/settings/rules/dashboard",
			locale,
			new Map(Object.entries(dictCore.aliases)),
		);
		for (const [node, expected] of NODES) {
			if (node === "Interactive chart.") continue;
			expect(
				translateText(node, orgView),
				`组织版节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("keeps attribute-only dynamic highcharts labels in english", () => {
		// 与组织版同一判定：数据点 aria-label（日期 + 数值拼串）与
		// `Show <系列名>` 系列的整串永远命中不了，且属性不走规则
		for (const raw of [
			"Saturday, Oct 24, 2026, 4. Bypasses.",
			"Oppenheymu, 16. Bypasses.",
			"Show Passes",
			"Show Failures",
			"Toggle series visibility, Chart",
			"created:>@today-1w evaluate-status:active branch:main",
		]) {
			expect(
				translateText(raw, view),
				`节点 ${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("仓库设置页 2026-10-25 的 document.title 系列", () => {
	const viewFor = (path: string) =>
		buildView(
			path,
			locale,
			new Map(Object.entries(dictCore.aliases)),
		);

	it("translates the settings page titles with the repo name intact", () => {
		// 中段页面名写死在模板里（与 actions-policies-title 同一处理方式），仓库名捕获保留
		expect(
			translateText(
				"Settings · Branches · NapukettoDev/NapukettoQQ",
				viewFor(
					"/NapukettoDev/NapukettoQQ/settings/branches",
				),
			),
		).toBe("设置 · 分支 · NapukettoDev/NapukettoQQ");
		expect(
			translateText(
				"Settings · Tags · NapukettoDev/NapukettoQQ",
				viewFor(
					"/NapukettoDev/NapukettoQQ/settings/tag_protection",
				),
			),
		).toBe("设置 · 标签 · NapukettoDev/NapukettoQQ");
		expect(
			translateText(
				"Settings · Code quality · NapukettoDev/NapukettoQQ",
				viewFor(
					"/NapukettoDev/NapukettoQQ/settings/code-quality",
				),
			),
		).toBe("设置 · 代码质量 · NapukettoDev/NapukettoQQ");
		expect(
			translateText(
				"Settings · Copilot Code review · NapukettoDev/NapukettoQQ",
				viewFor(
					"/NapukettoDev/NapukettoQQ/settings/copilot/code_review",
				),
			),
		).toBe(
			"设置 · Copilot 代码审查 · NapukettoDev/NapukettoQQ",
		);
		expect(
			translateText(
				"Settings · Custom properties · NapukettoDev/NapukettoQQ",
				viewFor(
					"/NapukettoDev/NapukettoQQ/settings/custom-properties",
				),
			),
		).toBe("设置 · 自定义属性 · NapukettoDev/NapukettoQQ");
		expect(
			translateText(
				"Settings · Advanced Security · NapukettoDev/NapukettoQQ",
				viewFor(
					"/NapukettoDev/NapukettoQQ/settings/security_analysis",
				),
			),
		).toBe(
			"设置 · Advanced Security · NapukettoDev/NapukettoQQ",
		);
		// 网络钩子页顺序相反：Webhooks 在前
		expect(
			translateText(
				"Webhooks · Settings · NapukettoDev/NapukettoQQ",
				viewFor("/NapukettoDev/NapukettoQQ/settings/hooks"),
			),
		).toBe("Webhook · 设置 · NapukettoDev/NapukettoQQ");
	});
});

describe("仓库设置页的自定义属性页的实机节点边界", () => {
	const customView = buildView(
		"/NapukettoDev/NapukettoQQ/settings/custom-properties",
		locale,
		new Map(Object.entries(dictCore.aliases)),
	);

	it("translates the page shell copied from the organization module", () => {
		const pairs: readonly (readonly [string, string])[] = [
			["Repository custom properties", "仓库自定义属性"],
			[
				"Add metadata to your repositories, such as compliance frameworks, data sensitivity, or project details.",
				"为你的仓库添加元数据，例如合规框架、数据敏感度或项目详情。",
			],
			// aria-label 与 placeholder 同串，都按属性精确键命中
			["Filter properties", "筛选属性"],
			["No properties that match", "没有匹配的属性"],
		];
		for (const [node, expected] of pairs) {
			expect(
				translateText(node, customView),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});
});
