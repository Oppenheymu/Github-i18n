// 组织 Copilot 代码审查设置页（/organizations/<组织>/settings/copilot/code_review）实机回归。
//
// 证据：2026-10-11 维护者贴的整页 HTML（`<react-app app-name="copilot-code-review-org-settings"`，
// payload 带 learnMoreUrl / approvalsSettings / defaultEffortLevelSettings）。它是同路由下的
// 独立 React 应用；页面上已是中文的 `预览` / `新建` / 开关的 `开启` / `关闭` 与
// `在文档中了解详情。` 是既有键生效的对照物，其余英文即本批清单。
//
// 两条边界事实：
// ① 顶部介绍与 coding_agent 页同款（`With ` + 术语 + 逗号起头的尾句），而那一页已实证是
//    **三个相邻的裸文本节点**（粘贴 outerHTML 看不出边界），故本页**两种切分都收**：
//    整句键兜「一个节点」、`With`（上一批已有）+ `Copilot code review` + 尾句碎片兜「三节点」；
//    实机确认是哪一个之后删掉多余的那条。
// ② payload 里还给了未渲染的文案（modeOptions 另外三组 label / description、
//    repositorySelection*、effort level 的 `Lite` / `Balanced` / `Max`）——按「只收实机渲染到的」
//    原则**有意不收录**，用例用反面断言把这几条钉住（点开下拉后按实机节点再补）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织 Copilot 代码审查设置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/copilot/code_review";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/copilot/code_review";

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

/** 实机里仍是英文的静态文本节点（按页面自上而下的顺序） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	["Copilot code review", "Copilot 代码审查"],
	[
		"With Copilot code review, you can get a thorough, automated first pass on every pull request — catching bugs and surfacing suggestions early, and freeing your team to focus on the changes that need human judgment. Copilot reviews pull requests across your organization's repositories and leaves its feedback as inline comments for authors to address.",
		"借助 Copilot 代码审查，你可以让每个拉取请求先得到一次全面、自动化的初审——及早发现缺陷、提出建议，并让团队腾出精力专注于真正需要人来判断的改动。Copilot 会审查你组织下各仓库的拉取请求，并以行内评论的形式留下反馈供作者处理。",
	],
	[
		", you can get a thorough, automated first pass on every pull request — catching bugs and surfacing suggestions early, and freeing your team to focus on the changes that need human judgment. Copilot reviews pull requests across your organization's repositories and leaves its feedback as inline comments for authors to address.",
		"，你可以让每个拉取请求先得到一次全面、自动化的初审——及早发现缺陷、提出建议，并让团队腾出精力专注于真正需要人来判断的改动。Copilot 会审查你组织下各仓库的拉取请求，并以行内评论的形式留下反馈供作者处理。",
	],
	["Approvals", "批准"],
	[
		"Allow Copilot to approve pull requests",
		"允许 Copilot 批准拉取请求",
	],
	[
		"Choose where Copilot can approve pull requests and where those approvals can count toward merge requirements.",
		"选择 Copilot 可以批准拉取请求的位置，以及这些批准可以计入合并要求的位置。",
	],
	["Disabled everywhere", "在所有仓库中禁用"],
	["Review effort", "审查力度"],
	["Default review effort level", "默认审查力度级别"],
	[
		"The depth of analysis Copilot uses for repositories that have not selected their own review effort level.",
		"Copilot 对尚未自行选择审查力度级别的仓库所使用的分析深度。",
	],
	["Default (Balanced)", "默认（均衡）"],
	["Advanced", "高级"],
	[
		"Only allow Copilot code review to be triggered by authorized users",
		"仅允许经授权的用户触发 Copilot 代码审查",
	],
	[
		"When enabled, Copilot review requests require a Copilot license from this organization or its enterprise.",
		"启用后，Copilot 审查请求需要此组织或其企业提供 Copilot 许可证。",
	],
];

/** 组织名、产品名与 payload 标识符必须保持原文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Koishi-CE",
	"Copilot",
	"GitHub",
	"no_repos",
	"all_repos",
	"no_policy",
	"multiple",
	"medium",
	"github",
	"loadingLabel",
];

/**
 * payload 里给了、但贴出的 HTML **没有渲染**的文案：有意不收录，
 * 等实机点开下拉 / 选中多仓库模式后按真实节点再收。
 */
const NOT_YET_COLLECTED: readonly string[] = [
	"Enabled everywhere",
	"Enable for selected repositories",
	"Lite",
	"Balanced",
	"Max",
	"Repository admins can decide this in repository settings.",
];

/**
 * 按 walker 语义翻译节点，并保留原文首尾空白，再拼成页面上的实际文本。
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

describe("组织 Copilot 代码审查设置页的模块路由", () => {
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

describe("组织 Copilot 代码审查设置页的实机节点", () => {
	it("translates every static English node", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("keeps organization data and product names in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("leaves payload strings that never rendered untranslated", () => {
		for (const raw of NOT_YET_COLLECTED) {
			expect(
				translateText(raw, view),
				`尚未渲染，不应有词条：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the intro across the term node and the docs link", () => {
		// 两形态兜底：三节点切分（`With ` / 术语 / 尾句）在实机与 coding_agent 页同款。
		expect(
			renderNodes([
				"With ",
				"Copilot code review",
				", you can get a thorough, automated first pass on every pull request — catching bugs and surfacing suggestions early, and freeing your team to focus on the changes that need human judgment. Copilot reviews pull requests across your organization's repositories and leaves its feedback as inline comments for authors to address. ",
				"Learn more in the docs.",
			]),
		).toBe(
			"借助 Copilot 代码审查，你可以让每个拉取请求先得到一次全面、自动化的初审——及早发现缺陷、提出建议，并让团队腾出精力专注于真正需要人来判断的改动。Copilot 会审查你组织下各仓库的拉取请求，并以行内评论的形式留下反馈供作者处理。 在文档中了解详情。",
		);
	});

	it("reads the same when the intro is a single node", () => {
		// 整句键是兜底形态；上游若把它合回一个节点，渲染结果与三节点形态逐字相同。
		expect(
			renderNodes([
				"With Copilot code review, you can get a thorough, automated first pass on every pull request — catching bugs and surfacing suggestions early, and freeing your team to focus on the changes that need human judgment. Copilot reviews pull requests across your organization's repositories and leaves its feedback as inline comments for authors to address. ",
				"Learn more in the docs.",
			]),
		).toBe(
			"借助 Copilot 代码审查，你可以让每个拉取请求先得到一次全面、自动化的初审——及早发现缺陷、提出建议，并让团队腾出精力专注于真正需要人来判断的改动。Copilot 会审查你组织下各仓库的拉取请求，并以行内评论的形式留下反馈供作者处理。 在文档中了解详情。",
		);
	});

	it("renders the heading with the Copilot product name", () => {
		expect(renderNodes(["Copilot code review"])).toBe(
			"Copilot 代码审查",
		);
		expect(renderNodes(["Default (Balanced)"])).toBe(
			"默认（均衡）",
		);
	});
});
