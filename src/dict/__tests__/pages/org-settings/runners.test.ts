// 组织级运行器列表页（/organizations/<组织>/settings/actions/runners）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML。
// 本页**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`），
// 页面上已是中文的三处正好当对照物：页头 h2 与表头第一列的 `运行器`（既有键
// `Runners`）、表头第二列的 `状态`（global 的 `Status`）、搜索表单的 `aria-label="运行器"`。
//
// 与仓库级的 /owner/repo/settings/actions/runners（词条在 pages/repo-settings）同串的
// 只有两条，其余是组织侧独有措辞。最容易搞错的一处：页首说明句在仓库级**只有第一句**，
// 组织侧在后面多接了一句「Runners added to this organization …」，故是**两条不同的键**
// ——整节点精确匹配，短键不会命中长节点（用例用短句作反向哨兵钉住）。
//
// 另外两条边界事实：
//   1. 「新建运行器」菜单里 GitHub 托管那一项的说明被 `<br>` 切成两段，
//      前段以 `&` 结尾（`Pay-as-you-go, customizable, secure, scaled &`）——
//      中文只能把连接词落到后段（`由 GitHub 管理`），渲染成两行；
//   2. 列表行右侧的 `0 active jobs` 是**单个文本节点**（数字与文案同节点），
//      条数随运行器状态变，故走规则 `org-settings/active-jobs-count`（单数一并接住）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织级运行器列表页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/actions/runners";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/actions/runners";
/** 仓库级的同款页面：同串词条在这里，用于断言两边逐字同译 */
const REPO_PATH =
	"/Oppenheymu/Github-i18n/settings/actions/runners";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));
const view = buildView(PAGE_PATH, locale, aliases);
const repoView = buildView(REPO_PATH, locale, aliases);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本批补的文本节点 */
const NEW_NODES: readonly (readonly [string, string])[] = [
	[
		"Includes all runners across self-hosted and GitHub-hosted runners.",
		"包含自托管运行器与 GitHub 托管运行器中的所有运行器。",
	],
	[
		"Host your own runners and customize the environment used to run jobs in your GitHub Actions workflows. Runners added to this organization can be used to process jobs in multiple repositories in your organization.",
		"托管你自己的运行器，并自定义在你的 GitHub Actions 工作流中运行作业所使用的环境。添加到此组织的运行器可用于处理组织内多个仓库中的作业。",
	],
	[
		"Learn more about self-hosted runners",
		"进一步了解自托管运行器",
	],
	["New runner", "新建运行器"],
	["New self-hosted runner", "新建自托管运行器"],
	["Bring your own infrastructure", "自带基础设施"],
	["New GitHub-hosted runner", "新建 GitHub 托管运行器"],
	[
		"Pay-as-you-go, customizable, secure, scaled &",
		"按量付费、可自定义、安全、可扩展，",
	],
	["managed by GitHub", "由 GitHub 管理"],
	[
		"Only available on paid Team or Enterprise plans",
		"仅在付费的 Team 或 Enterprise 方案中可用",
	],
	[
		"Standard GitHub-hosted runners",
		"标准 GitHub 托管运行器",
	],
	[
		"Ready-to-use runners managed by GitHub.",
		"由 GitHub 管理的即用型运行器。",
	],
	["Learn more.", "了解更多。"],
];

/** 与仓库级模块同串的两条：两边必须逐字同译 */
const SHARED_WITH_REPO: readonly (readonly [
	string,
	string,
])[] = [
	[
		"Learn more about self-hosted runners",
		"进一步了解自托管运行器",
	],
	["New self-hosted runner", "新建自托管运行器"],
];

/** 只出现在属性上的文案（搜索框的 placeholder 与 aria-label 是同串） */
const ATTR_NODES: readonly (readonly [string, string])[] = [
	["Search runners", "搜索运行器"],
];

/** 含动态条数的行，走本模块的计数规则 */
const RULE_NODES: readonly (readonly [string, string])[] = [
	["0 active jobs", "0 个活动作业"],
	["1 active job", "1 个活动作业"],
	["12 active jobs", "12 个活动作业"],
];

/** 扩展在本页已生效的对照物 */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Runners", "运行器"],
	["Status", "状态"],
];

const MUST_STAY_ENGLISH: readonly string[] = [
	// 反向哨兵：仓库级那条**只有第一句**的说明句在组织路径上不得命中
	"Host your own runners and customize the environment used to run jobs in your GitHub Actions workflows.",
	"github-hosted-runners",
	"runner-creation-menu-list",
	"qr",
	"Koishi-CE",
	"GitHub",
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

describe("组织级运行器列表页的模块路由", () => {
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

describe("组织级运行器列表页的实机节点", () => {
	it("translates every organization-only string", () => {
		for (const [raw, expected] of NEW_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("translates the two strings shared with the repository module identically", () => {
		for (const [raw, expected] of SHARED_WITH_REPO) {
			expect(translateText(raw, view)).toBe(expected);
			expect(
				translateText(raw, repoView),
				`与仓库级模块不同译：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("translates the search box placeholder and accessible name", () => {
		for (const [raw, expected] of ATTR_NODES) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("counts active jobs through the rule in both numbers", () => {
		for (const [raw, expected] of RULE_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the already translated contrast objects working", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps identifiers, form names and the repository-only sentence in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("does not let the short repository sentence stand in for the longer one", () => {
		// 两条键的差别只在组织侧多出的第二句：短的必须**不**命中长节点，
		// 长的也必须**不**命中短节点，否则会渲染出缺半句的中文
		const short =
			"Host your own runners and customize the environment used to run jobs in your GitHub Actions workflows.";
		const long = `${short} Runners added to this organization can be used to process jobs in multiple repositories in your organization.`;
		expect(translateText(short, view)).toBeNull();
		expect(translateText(long, view)).toContain(
			"添加到此组织",
		);
		expect(translateText(long, repoView)).toBeNull();
	});
});

describe("组织级运行器列表页的节点边界", () => {
	it("reassembles the header description with its existing link", () => {
		expect(
			renderNodes([
				"Host your own runners and customize the environment used to run jobs in your GitHub Actions workflows. Runners added to this organization can be used to process jobs in multiple repositories in your organization. ",
				"Learn more about self-hosted runners",
				".",
			]),
		).toBe(
			"托管你自己的运行器，并自定义在你的 GitHub Actions 工作流中运行作业所使用的环境。添加到此组织的运行器可用于处理组织内多个仓库中的作业。 进一步了解自托管运行器.",
		);
	});

	it("reassembles the hosted-runner row split by <br> and by its link", () => {
		// 前段以 `&` 结尾、后段带前导空格；句号在链接**内部**
		expect(
			renderNodes([
				"Pay-as-you-go, customizable, secure, scaled &",
				" managed by GitHub",
			]),
		).toBe(
			"按量付费、可自定义、安全、可扩展， 由 GitHub 管理",
		);
		expect(
			renderNodes([
				"Ready-to-use runners managed by GitHub. ",
				"Learn more.",
			]),
		).toBe("由 GitHub 管理的即用型运行器。 了解更多。");
	});

	it("renders the row's active job count next to its status label", () => {
		expect(renderNodes(["0 active jobs"])).toBe(
			"0 个活动作业",
		);
	});
});
