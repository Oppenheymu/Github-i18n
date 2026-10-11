// 组织全局 Advanced Security 设置（/organizations/<组织>/settings/security_analysis）实机回归。
//
// 证据：2026-10-11 维护者贴出的 SSR HTML。页面含 Dependabot 规则摘要、运行器类型对话框、
// Code scanning / Secret scanning 设置与 Dependabot 仓库访问区。HTML 中已中文的运行器、
// 表单标签和开关状态是既有词条的对照物；动态仓库名、字段值与 `dependabot` 运行器标签保留原样。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PAGE_PATH =
	"/organizations/Koishi-CE/settings/security_analysis";
const locale = dictForLocale("zh-CN");
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

const NEW_NODES: readonly (readonly [string, string])[] = [
	["Global Advanced Security settings", "全局高级安全设置"],
	[
		"Global Advanced Security settings are enabled for all repositories in this organization where the parent feature is enabled. By enabling these features, you're granting us permission to perform read-only analysis on your organization's repositories.",
		"此组织中所有已启用父级功能的仓库都会启用全局高级安全设置。启用这些功能，即表示你授权我们对组织仓库进行只读分析。",
	],
	["Dependabot rules", "Dependabot 规则"],
	[
		"Create your own custom rules and manage alert presets.",
		"创建自定义规则并管理警报预设。",
	],
	["1 rule enabled", "已启用 1 条规则"],
	["Configure dependabot rules", "配置 Dependabot 规则"],
	["Grouped security updates", "分组安全更新"],
	[
		"Groups all available updates that resolve a Dependabot alert into one pull request (per package manager and directory of requirement manifests). This option may be overridden by group rules specified in dependabot.yml -",
		"将可用的更新合并到一个拉取请求中，以解决 Dependabot 警报（每个包管理器和依赖清单目录各一个）。此选项可能会被 dependabot.yml 中指定的分组规则覆盖——",
	],
	["Learn how to group updates.", "了解如何对更新分组。"],
	[
		"Select the runner type used by Dependabot for scans and version and security updates.",
		"选择 Dependabot 用于扫描、版本更新和安全更新的运行器类型。",
	],
	[
		"Edit runner type for Dependabot",
		"编辑 Dependabot 的运行器类型",
	],
	[
		"Dependabot will use standard GitHub runners to run scans",
		"Dependabot 将使用标准 GitHub 运行器运行扫描",
	],
	[
		"Dependabot will use labeled GitHub or self-hosted runners that you may define.",
		"Dependabot 将使用你定义的带标签的 GitHub 托管或自托管运行器。",
	],
	["Optional runner information", "可选的运行器信息"],
	[
		"Provide any existing runner information you would like to use for Dependabot.",
		"填写你希望 Dependabot 使用的现有运行器信息。",
	],
	[
		"Verify spelling matches an existing runner group to ensure proper setup.",
		"请确认拼写与现有运行器组一致，以确保设置正确。",
	],
	["The", "名为"],
	[
		"label is used by default. Learn how to",
		"的标签默认用于此处。了解如何",
	],
	["use or create custom labels", "使用或创建自定义标签"],
	[
		"Verify spelling matches an existing label to ensure proper setup.",
		"请确认拼写与现有标签一致，以确保设置正确。",
	],
	["Save runner selection", "保存运行器选择"],
	["Code scanning", "代码扫描"],
	[
		"Recommend the extended query suite for repositories enabling default setup",
		"为启用默认设置的仓库推荐扩展查询套件",
	],
	[
		"The extended query includes the default suite, plus lower severity and precision queries.",
		"扩展查询包含默认套件，以及严重性和精确度较低的查询。",
	],
	["Copilot Autofix", "Copilot 自动修复"],
	[
		"Suggest fixes for CodeQL alerts using AI. CodeQL default or advanced setup must be enabled for this feature to work. Agentic fixes use AI Credits. Learn more about the",
		"使用 AI 为 CodeQL 警报提供修复建议。必须启用 CodeQL 默认设置或高级设置才能使用此功能。代理式修复会消耗 AI 积分。进一步了解",
	],
	[
		"limitations of autofix code suggestions",
		"自动修复代码建议的限制",
	],
	["AI Scan for pull requests", "拉取请求 AI 扫描"],
	[
		"Run AI code scan on pull requests. Only applies for non-CodeQL languages.",
		"对拉取请求运行 AI 代码扫描。仅适用于非 CodeQL 语言。",
	],
	["Learn more about AI Scan", "进一步了解 AI 扫描"],
	[
		"A Copilot license is required to use AI Scan.",
		"使用 AI 扫描需要 Copilot 许可证。",
	],
	["Set up Copilot", "设置 Copilot"],
	[
		"Keep scheduled scans running every 30 days for inactive repositories",
		"每隔 30 天继续扫描不活跃的仓库",
	],
	[
		"Inactive repositories are repositories with no pushes or pull requests in the last 6 months. Applies only to repositories using code scanning default setup.",
		"不活跃仓库是指过去 6 个月内没有推送或拉取请求的仓库。仅适用于使用代码扫描默认设置的仓库。",
	],
	["Expand CodeQL analysis", "扩展 CodeQL 分析"],
	[
		"Expand CodeQL to recognize more libraries and frameworks in repositories using CodeQL default setup.",
		"扩展 CodeQL，以便在使用 CodeQL 默认设置的仓库中识别更多库和框架。",
	],
	["Configure CodeQL model packs", "配置 CodeQL 模型包"],
	["Configure", "配置"],
	["Secret scanning", "机密扫描"],
	["Push protection", "推送保护"],
	[
		"Add a resource link in the CLI and web UI when a commit is blocked",
		"阻止提交时，在 CLI 和 Web 界面中添加资源链接",
	],
	["Link will show in addition to", "此链接会与"],
	[
		"the message GitHub displays",
		"GitHub 显示的消息同时显示",
	],
	["Save link", "保存链接"],
	[
		"Grant Dependabot access to repositories",
		"授予 Dependabot 仓库访问权限",
	],
	[
		"To update dependencies, Dependabot accesses all public and selected private repositories. The contents of these repositories become visible to all users in your organization through Dependabot updates. Consider using private registries if you don't want to share these repositories with everyone in your organization.",
		"为了更新依赖项，Dependabot 会访问所有公开仓库和你选择的私有仓库。通过 Dependabot 更新，你组织中的所有用户都能查看这些仓库的内容。如果不想与组织中的所有人共享这些仓库，请考虑使用私有注册表。",
	],
	["Select repositories", "选择仓库"],
	["Select", "选择"],
	["repositories", "仓库"],
	["Choose", "选择"],
	[
		"repositories Dependabot can access.",
		"个 Dependabot 可以访问的仓库。",
	],
];

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

describe("组织全局 Advanced Security 设置页的路由", () => {
	it("loads org-settings and the global fallback", () => {
		const names = matchModules(
			PAGE_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});
});

describe("组织全局 Advanced Security 设置页的实机节点", () => {
	it("translates every English text or accessible-name node", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("translates text split around inline code and links", () => {
		expect(
			renderNodes([
				"The ",
				"dependabot",
				" label is used by default. Learn how to ",
				"use or create custom labels",
				".",
			]),
		).toBe(
			"名为 dependabot 的标签默认用于此处。了解如何 使用或创建自定义标签.",
		);
		expect(
			renderNodes([
				"Link will show in addition to ",
				"the message GitHub displays",
			]),
		).toBe("此链接会与 GitHub 显示的消息同时显示");
	});

	it("keeps existing Chinese controls and user-provided runner labels", () => {
		expect(translateText("运行器类型", view)).toBeNull();
		expect(
			translateText("标准 GitHub 运行器", view),
		).toBeNull();
		expect(translateText("dependabot", view)).toBeNull();
		expect(translateText("Koishi-CE", view)).toBeNull();
	});
});
