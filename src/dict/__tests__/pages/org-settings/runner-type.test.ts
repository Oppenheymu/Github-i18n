// 组织 Copilot 运行器类型设置页（/organizations/<组织>/settings/copilot/runner_type）实机回归。
//
// 证据：2026-10-11 维护者贴的整页 HTML（`<react-app app-name="copilot-for-business">`）。
// Cloud agent 与 code review 两节共用字段；页面中代理名由 React 插值为独立文本节点，
// 故介绍句与配置说明按代理名两侧的片段翻译。YAML 文件名和未渲染的 payload 值保持原文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织 Copilot 运行器类型设置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/copilot/runner_type";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/copilot/runner_type";

const locale = dictForLocale("zh-CN");
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 实机仍为英文的文本节点（插值句按动态代理名拆成片段） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	[
		"Select the default runner type for",
		"选择默认运行器类型，适用于",
	],
	[
		"Repositories in this organization will use the selected runner type unless overridden at the repository level.",
		"此组织中的仓库将使用所选运行器类型，除非仓库级设置另有指定。",
	],
	[
		"Learn about GitHub Actions runners.",
		"了解 GitHub Actions 运行器。",
	],
	["Runner type configuration", "运行器类型配置"],
	["Select the runner type for", "选择运行器类型，适用于"],
	["sessions.", "会话。"],
	["Standard GitHub runner", "标准 GitHub 运行器"],
	["Edit runner type", "编辑运行器类型"],
	[
		"Allow repositories to customize the runner type",
		"允许仓库自定义运行器类型",
	],
	[
		"When enabled, repositories can specify their own runner via their copilot-setup-steps.yml file.",
		"启用后，仓库可以通过 copilot-setup-steps.yml 文件指定自己的运行器。",
	],
	[
		"When enabled, repositories can specify their own runner via their copilot-code-review.yml file.",
		"启用后，仓库可以通过 copilot-code-review.yml 文件指定自己的运行器。",
	],
	// —— 同页「Edit runner type」对话框（维护者 2026-10-11 贴出的第二段 HTML）——
	[
		"Edit runner type for Copilot cloud agent",
		"编辑 Copilot 云端代理的运行器类型",
	],
	["Labeled runner", "带标签的运行器"],
	[
		"Copilot cloud agent will use standard GitHub runners.",
		"Copilot 云端代理将使用标准 GitHub 运行器。",
	],
	[
		"Copilot cloud agent will use labeled GitHub or self-hosted runners that you may define.",
		"Copilot 云端代理将使用带标签的 GitHub 运行器，或你可自行定义的自托管运行器。",
	],
	// —— 同页 code review 的对话框与「带标签的运行器」表单（2026-10-11 第三段 HTML）——
	// 表单里的 `运行器类型` 与按钮上的 `带标签的运行器` 已是中文（既有键 + 上面那条生效）。
	[
		"Edit runner type for Copilot code review",
		"编辑 Copilot 代码审查的运行器类型",
	],
	[
		"Copilot code review will use standard GitHub runners.",
		"Copilot 代码审查将使用标准 GitHub 运行器。",
	],
	[
		"Copilot code review will use labeled GitHub or self-hosted runners that you may define.",
		"Copilot 代码审查将使用带标签的 GitHub 运行器，或你可自行定义的自托管运行器。",
	],
	["Runner information", "运行器信息"],
	[
		"You must provide a runner group name and/or label.",
		"你必须提供运行器组名称和/或标签。",
	],
	["Runner group name", "运行器组名称"],
	["Runner label", "运行器标签"],
	[
		"Learn how to use or create custom labels.",
		"了解如何使用或创建自定义标签。",
	],
];

/** 只出现在属性上的文案（`placeholder` 在可翻译属性白名单内，按精确键翻译） */
const ATTR_NODES: readonly (readonly [string, string])[] = [
	["Existing name", "现有名称"],
	["Existing label", "现有标签"],
];

/** 产品名、组织名、YAML 文件名和 payload 字段保持原文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Koishi-CE",
	"Copilot",
	"GitHub",
	"copilot-setup-steps.yml",
	"copilot-code-review.yml",
	"runner_labels",
	"runner_group_name",
	"runner_type",
	"per_agent_settings",
];

/** 按 walker 语义翻译节点，并保留原文首尾空白后拼接 */
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

describe("组织 Copilot 运行器类型设置页的模块路由", () => {
	it("loads org-settings and the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match repository or account settings", () => {
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

describe("组织 Copilot 运行器类型设置页的实机节点", () => {
	it("translates every static node and both agent-specific settings", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("keeps product names, filenames and payload values in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders both dynamic agent introductions around their inserted names", () => {
		const shared =
			"Repositories in this organization will use the selected runner type unless overridden at the repository level.";
		const docs = "Learn about GitHub Actions runners.";
		expect(
			renderNodes([
				"Select the default runner type for ",
				"Copilot cloud agent",
				" sessions. ",
				shared,
				" ",
				docs,
			]),
		).toBe(
			"选择默认运行器类型，适用于 Copilot cloud agent 会话。 " +
				"此组织中的仓库将使用所选运行器类型，除非仓库级设置另有指定。 " +
				"了解 GitHub Actions 运行器。",
		);
		expect(
			renderNodes([
				"Select the default runner type for ",
				"Copilot code review",
				" sessions.",
			]),
		).toBe(
			"选择默认运行器类型，适用于 Copilot 代码审查 会话。",
		);
	});

	it("renders each runner configuration and preserves its YAML filename", () => {
		expect(
			renderNodes([
				"Runner type configuration",
				"Select the runner type for ",
				"Copilot cloud agent",
				" sessions.",
				"Standard GitHub runner",
				"Edit runner type",
				"Allow repositories to customize the runner type",
				"When enabled, repositories can specify their own runner via their copilot-setup-steps.yml file.",
			]),
		).toBe(
			"运行器类型配置选择运行器类型，适用于 Copilot cloud agent 会话。" +
				"标准 GitHub 运行器编辑运行器类型允许仓库自定义运行器类型" +
				"启用后，仓库可以通过 copilot-setup-steps.yml 文件指定自己的运行器。",
		);
		expect(
			renderNodes([
				"When enabled, repositories can specify their own runner via their copilot-code-review.yml file.",
			]),
		).toBe(
			"启用后，仓库可以通过 copilot-code-review.yml 文件指定自己的运行器。",
		);
	});

	it("renders the Edit runner type dialog and both runner options", () => {
		// 第一项的 label 由既有键 `Standard GitHub runner` 译出（贴出的 HTML 里已是中文），
		// 两条 description 都以产品名 `Copilot cloud agent` 开头、是完整节点。
		expect(
			renderNodes([
				"Edit runner type for Copilot cloud agent",
				"Standard GitHub runner",
				"Copilot cloud agent will use standard GitHub runners.",
				"Labeled runner",
				"Copilot cloud agent will use labeled GitHub or self-hosted runners that you may define.",
			]),
		).toBe(
			"编辑 Copilot 云端代理的运行器类型" +
				"标准 GitHub 运行器" +
				"Copilot 云端代理将使用标准 GitHub 运行器。" +
				"带标签的运行器" +
				"Copilot 云端代理将使用带标签的 GitHub 运行器，或你可自行定义的自托管运行器。",
		);
	});

	it("renders the code review dialog and its labeled runner form", () => {
		// 与上面那段结构相同、代理名换成 code review；表单只在选中「带标签的运行器」后展开。
		expect(
			renderNodes([
				"Edit runner type for Copilot code review",
				"Copilot code review will use standard GitHub runners.",
				"Copilot code review will use labeled GitHub or self-hosted runners that you may define.",
				"Runner information",
				"You must provide a runner group name and/or label.",
				"Runner group name",
				"Runner label",
				"Learn how to use or create custom labels.",
			]),
		).toBe(
			"编辑 Copilot 代码审查的运行器类型" +
				"Copilot 代码审查将使用标准 GitHub 运行器。" +
				"Copilot 代码审查将使用带标签的 GitHub 运行器，或你可自行定义的自托管运行器。" +
				"运行器信息" +
				"你必须提供运行器组名称和/或标签。" +
				"运行器组名称" +
				"运行器标签" +
				"了解如何使用或创建自定义标签。",
		);
	});

	it("translates the labeled runner placeholders", () => {
		for (const [raw, expected] of ATTR_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});
});
