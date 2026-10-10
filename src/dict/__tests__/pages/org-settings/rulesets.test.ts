// 组织规则集页（/organizations/<组织>/settings/rules，无规则集时的空态）实机回归。
//
// 证据：2026-10-10 维护者贴的实机 outerHTML（采集时扩展仍在运行——同一段 HTML 里
// upsell 那半句 `Organization rulesets won't be enforced` 已经是中文，它由
// policies/repositories 那批收下，正好当「扩展确实在这一页生效」的对照物）。
//
// 这一页是**同一个 React 应用**在另一条路径下的渲染：HTML 里
// `<react-app app-name="repos-rules" …>` 的 payload 与仓库级
// `/owner/repo/settings/rules` 逐字段相同，页面文案也逐字同款；而 pages/repo-settings
// 的路由显式排除了 `organizations` / `orgs`，所以同一批文案必须在本模块各收一份并
// **逐字同译**（同 `Repository default branch`、`Payment information` 的先例）——
// 这就是「明明翻译过却漏翻」的成因。
//
// 本文件锁五件事：
//   ① 路由：本页只命中 pages/org-settings + global，不命中 pages/repo-settings；
//   ② 实机里仍是英文的六个节点全部命中（H1 / 空态 H2 / 说明段 / 链接的第二段
//      `rulesets.` / 整句兜底 / 按钮）；
//   ③ 链接的节点切分与仓库级那批**逐字同译**：`Learn more about` 走 global 短键，
//      `rulesets.` 是本批真正补的碎片，两段拼起来读作「进一步了解 规则集。」；
//   ④ `New ruleset` 下拉的三条候选来自本页 payload 的
//      `supported_features.targetDefinitions.*.createButtonText`（`supportedTargets`
//      明列 branch / tag / push），其中 `New push ruleset` 仓库级那批没收过；
//   ⑤ 反例：组织名与规则集名是用户内容；payload 里的 `upsellHeaderText`
//      （`Protect your most important branches`）本页**没有渲染**（空态 H2 用的是
//      `headingText`），故有意不登记。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织规则集页 */
const PAGE_PATH = "/organizations/Koishi-CE/settings/rules";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/rules";
/** 仓库级规则集页：同一款 React 应用的另一条路径 */
const REPO_PATH = "/microsoft/vscode/settings/rules";

const locale = dictForLocale("zh-CN");

/** 本页命中的模块视图（pages/org-settings + global） */
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 仓库级规则集页的视图（用于断言两页同译） */
const REPO_VIEW = buildView(
	REPO_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 实机里仍是英文的文本节点（按页面自上而下的顺序） */
const NEW_NODES: readonly string[] = [
	// H1（与侧栏项 `Rulesets` 不是同串）
	"Repository rulesets",
	// 空态 H2：payload 的 `headingText`，撇号是**直撇号**
	"You haven't created any rulesets",
	// 说明段：`Define` 与 payload 的 `upsellInfoMessage` 合成同一个文本节点
	"Define whether collaborators can delete or force push and set requirements for any pushes, such as passing status checks or a linear commit history.",
	// 链接的**第二段**（渲染成「进一步了解 rulesets.」的那半截英文）
	"rulesets.",
	// 上游改回单节点时的兜底形态
	"Learn more about rulesets.",
	// 按钮
	"New ruleset",
];

/** 同一个 payload 给的下拉候选（`createButtonText`） */
const DROPDOWN: readonly (readonly [string, string])[] = [
	["New branch ruleset", "新建分支规则集"],
	["New tag ruleset", "新建标签规则集"],
	// 仓库级那批只收了前两条（当时截图的下拉里没有 push 项），本条是 payload 证据
	["New push ruleset", "新建推送规则集"],
];

/** 页面上已是中文的节点（既有键的产物，用作对照物） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	[
		"Organization rulesets won't be enforced",
		"组织规则集将不会强制执行",
	],
	[
		"until you upgrade this organization account to GitHub Team.",
		"直到你将此组织账户升级为 GitHub Team。",
	],
	["Rulesets", "规则集"],
	["Ruleset insights", "规则集洞察"],
	["Ruleset dashboard", "规则集仪表板"],
];

/** 必须保持英文：用户内容，以及 payload 里有、但本页没渲染的那条 upsell 标题 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 组织名（用户内容）
	"Koishi-CE",
	// 规则集名（用户内容；仓库级那批用的是同一个例子）
	"Protect Default Branch",
	// payload 的 `upsellHeaderText`：本页空态 H2 用的是 `headingText`，故有意不登记
	"Protect your most important branches",
];

/** 两页必须逐字同译的串（同款 React 应用、两条互斥路由） */
const SHARED_WITH_REPO_PAGE: readonly string[] = [
	"Repository rulesets",
	"You haven't created any rulesets",
	"Define whether collaborators can delete or force push and set requirements for any pushes, such as passing status checks or a linear commit history.",
	"rulesets.",
	"Learn more about rulesets.",
	"New ruleset",
	"New branch ruleset",
	"New tag ruleset",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n      ${node}\n    `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白，最后拼接成页面上真实看到的那一行。
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

describe("组织规则集页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the per-repository module that owns the same strings", () => {
		// 同一批文案在 pages/repo-settings 里早有译文，但那条路由排除了组织路径，
		// 所以本页必须自己收一份（这正是本批存在的理由）
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/settings-billing");
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织规则集页的实机节点", () => {
	it("translates every node that the real page still showed in English", () => {
		for (const node of NEW_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
		expect(translateText("Repository rulesets", view)).toBe(
			"仓库规则集",
		);
		expect(
			translateText(
				"You haven't created any rulesets",
				view,
			),
		).toBe("你还没有创建任何规则集");
		expect(
			translateText(
				"Define whether collaborators can delete or force push and set requirements for any pushes, such as passing status checks or a linear commit history.",
				view,
			),
		).toBe(
			"定义协作者是否可以删除或强制推送，并为任何推送设置要求，例如通过状态检查或线性提交历史。",
		);
		expect(translateText("New ruleset", view)).toBe(
			"新建规则集",
		);
	});

	it("translates the dropdown candidates the payload supplies", () => {
		for (const [raw, expected] of DROPDOWN) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps user content and the unrendered upsell title in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the shared strings exactly like the repository settings page", () => {
		for (const raw of SHARED_WITH_REPO_PAGE) {
			const here = translateText(raw, view);
			expect(
				here,
				`本页未命中：${JSON.stringify(raw)}`,
			).not.toBeNull();
			expect(
				here,
				`两页译文不一致：${JSON.stringify(raw)}`,
			).toBe(translateText(raw, REPO_VIEW));
		}
	});
});

describe("组织规则集页的节点切分事实", () => {
	it("repairs the mixed-language docs link through its second node", () => {
		// 实机：`<a>进一步了解 rulesets.</a>` —— React 把链接文本拆成两段，
		// 前段命中 global 的短键「Learn more about」，后段是本批补的 `rulesets.`
		expect(translateText("Learn more about", view)).toBe(
			"进一步了解",
		);
		expect(translateText("rulesets.", view)).toBe(
			"规则集。",
		);
		expect(
			renderNodes(["Learn more about", " ", "rulesets."]),
		).toBe("进一步了解 规则集。");
		// 整句形态（上游改回单节点）由本模块的整句键兜住
		expect(
			translateText("Learn more about rulesets.", view),
		).toBe("进一步了解规则集。");
	});

	it("renders the empty state as heading plus paragraph", () => {
		expect(
			renderNodes([
				"Repository rulesets",
				"You haven't created any rulesets",
				"Define whether collaborators can delete or force push and set requirements for any pushes, such as passing status checks or a linear commit history. ",
				"进一步了解 规则集。",
			]),
		).toBe(
			"仓库规则集你还没有创建任何规则集定义协作者是否可以删除或强制推送，并为任何推送设置要求，例如通过状态检查或线性提交历史。 进一步了解 规则集。",
		);
	});

	it("renders the upsell line as two nodes, both already translated", () => {
		// 实机：`组织规则集将不会强制执行 <a>直到你将此组织账户升级为 GitHub Team。</a>`
		expect(
			renderNodes([
				"Organization rulesets won't be enforced",
				" ",
				"until you upgrade this organization account to GitHub Team.",
			]),
		).toBe(
			"组织规则集将不会强制执行 直到你将此组织账户升级为 GitHub Team。",
		);
	});
});
