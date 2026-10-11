// 组织级「Actions 策略」页（/organizations/<组织>/settings/actions/rules）实机回归。
//
// 证据：2026-10-11 维护者贴的实机 HTML（`<react-app app-name="repos-rules">`）。
// 它与组织规则集页 / 洞察页 / 仪表盘页是**同一个 React 应用**，只是 payload 的
// `supportedTargets` 换成 `["actions"]`、`createButtonText` 换成 `New policy`
// ⇒ 说明句（`Define whether **actions** can run in specific contexts.`）与仓库级的
// 分支版**不同串**——同模板不同文案，仍要各收一份（同 `issue-types` / `issue-fields` 的教训）。
//
// 页面上已是中文的四处都是既有键的对照物：`你还没有创建任何策略`（h2）、`新建策略`（按钮）、
// `进一步了解 策略.`（说明段的链接）与 `组织规则集将不会强制执行 直到…`（升级提示）。
// payload 里的 `upsellHeaderText` / `protectionsHeading` / `protectionsSubtitle` /
// `insightsHeading` 四句**本页没有渲染**，按「只收实机渲染到的值」保持英文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织级 Actions 策略页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/actions/rules";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/actions/rules";
/** 仓库级的同款页面：同串词条在这里，用于断言两边逐字同译 */
const REPO_PATH =
	"/Oppenheymu/Github-i18n/settings/actions/rules";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));
const view = buildView(PAGE_PATH, locale, aliases);
const repoView = buildView(REPO_PATH, locale, aliases);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本批补的五条：四条文本节点 + 一条只出现在 aria-label 上的文案 */
const NEW_NODES: readonly (readonly [string, string])[] = [
	["Actions policies", "Actions 策略"],
	[
		"Define whether actions can run in specific contexts.",
		"定义操作是否可以在特定上下文中运行。",
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
];

/** 扩展在本页已生效的对照物（既有键，含 policies/repositories 那批） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	[
		"You haven't created any policies",
		"你还没有创建任何策略",
	],
	["New policy", "新建策略"],
	["policies", "策略"],
	["policies.", "策略。"],
];

/** payload 里没有被渲染的文案必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Protect your most important actions workflows",
	"Workflow execution protections",
	"GitHub features such as Dependabot, code scanning, Codespaces prebuilds, and Pages are exempt from these protections.",
	"Actions policy insights",
	"repos-rules",
	"supportedTargets",
	"createButtonText",
	"Koishi-CE",
	"pull_request_target",
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

describe("组织级 Actions 策略页的模块路由", () => {
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

describe("组织级 Actions 策略页的实机节点", () => {
	it("translates the four missing strings exactly like the repository module", () => {
		for (const [raw, expected] of NEW_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			// 仓库级模块的键在组织路径上不命中，故各收一份并钉成同译
			expect(
				translateText(raw, repoView),
				`与仓库级模块不同译：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the already translated contrast objects working", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(
				translateText(raw, view),
				`对照物失效：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps unrendered payload strings, the app name and the organization in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("reassembles the deprecation flash split by its <code> and its link", () => {
		// 排除容器里的 pull_request_target 原样保留；链接文字由 global 的 `Learn more` 译出
		expect(
			renderNodes([
				"On November 2, 2026, GitHub will restrict ",
				"pull_request_target",
				" on public repositories by default. To continue allowing the event trigger, configure an Actions policy. ",
				"Learn more",
			]),
		).toBe(
			"2026 年 11 月 2 日，GitHub 将限制 pull_request_target 在公开仓库中的使用。要继续允许该事件触发器，请配置一个 Actions 策略。 了解更多",
		);
	});

	it("reassembles the upsell description with its existing link", () => {
		expect(
			renderNodes([
				"Define whether actions can run in specific contexts. ",
				"Learn more about",
				" ",
				"policies.",
			]),
		).toBe(
			"定义操作是否可以在特定上下文中运行。 进一步了解 策略。",
		);
	});
});

describe("组织级 Actions 策略页的 document.title", () => {
	it("spells the page name in Chinese through the dedicated rule", () => {
		// 专用规则必须排在通用 page-title 之前，否则中段页面名只能原样保留英文
		expect(
			translateText(
				"Settings · Actions policies · Koishi-CE",
				view,
			),
		).toBe("设置 · Actions 策略 · Koishi-CE");
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
				repoView,
			),
		).toBe("设置 · Actions 策略 · Koishi-CE");
	});
});
