// 预算与提醒页（新版 unified-budgets-page）的实机文本节点回归。
//
// 证据与强度：2026-10-23 维护者贴出的**整页实机 HTML**（/settings/billing/budgets，
// `<react-app app-name="billing-app">`；采集时扩展在运行，页面上已是中文的节点是既有词条的产物：
// 「预算与提醒」「新建预算」「所含用量提醒： 开启」「账户」「代码空间」「软件包」
// 「Actions 工作流」）。
//
// 这一页与 2026-09 截图那版**不是同一套表格**：旧版是 Name / Account / Product 三列
// （节点见 settings/billing.test.ts 的 BUDGETS_NODES），新版是 Budget / Spent / Status /
// Actions 四列，并多出筛选框、范围下拉与分页。两版节点都保留——旧版键仍可能被
// 灰度形态渲染，删掉它们没有任何收益。
//
// 本文件锁五件事：
//   ① 两条 sr-only 列头（Budget / Spent）与行内状态 Usage blocked 命中静态词条；
//   ② 行内金额是 `<strong>$0.00</strong>` + ` / $0.00 spent` **两个节点**，后者走规则
//      settings/budget-progress-spent（旧版单独成节点的 `$0 spent` 仍由旧规则负责）；
//   ③ 表格标题的计数「5 budgets」走新规则（旧版的「5 Account budgets」仍由旧规则负责，
//      两条 pattern 不重叠、互不吃掉）；
//   ④ 分页的两种形态（视觉文本 `1-5 of 5` 与 sr-only 的 `Showing 1 to 5 of 5 budgets`）
//      各走一条规则；
//   ⑤ 组织路由（/organizations/<组织>/settings/billing/budgets）与个人路由逐字同译——
//      两者是同一套 billing-app 组件，词条统一登记在 pages/settings-billing。
//
// 有意保持英文（不在下面任何清单里）：`aria-label="Budget utilization for Oppenheymu"`、
// `aria-valuetext="100% of budget limit used"` 与每行的
// `View actions for <产品> budget for Account <用户名>` 都含动态值，而属性**不应用正则规则**
// （结构上翻不了，与 AI 用量页的 `0 of 0 AI credits used` 同一设计边界）；
// 用户名 Oppenheymu 是用户内容，SKU / Git LFS 是缩写与产品名。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PERSONAL_PATH = "/settings/billing/budgets";
const ORG_PATH =
	"/organizations/Koishi-CE/settings/billing/budgets";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));

/**
 * 两条路由各自的模块视图：个人路由由 pages/settings 兜底设置外壳，
 * 组织路由由 pages/org-settings 兜底；账单词条与规则都来自 pages/settings-billing。
 */
const VIEWS = [
	{
		label: "个人路由",
		view: buildView(PERSONAL_PATH, locale, aliases),
	},
	{
		label: "组织路由",
		view: buildView(ORG_PATH, locale, aliases),
	},
] as const;

/** 实机 HTML 里仍是英文的文本节点（逐条誊录，顺序即页面顺序） */
const TEXT_NODES: readonly string[] = [
	// 表格的两条 sr-only 列头（可见列头是图标，无障碍名在 VisuallyHidden 里）
	"Budget",
	"Spent",
	// 预算达到上限后的行内状态（警告图标旁）
	"Usage blocked",
	// 筛选框（placeholder 与 sr-only 标签同串）与清空按钮的 tooltip
	"Filter by scope, repository, product or SKU",
	"Clear Filter by scope, repository, product or SKU",
	// 范围下拉的标签（带冒号；当前值 All 由 global 词条译出）
	"Scope:",
	// 第五行预算的 SKU 分组名（前四行是产品名，由既有词条译出）
	"All AI Credit SKUs",
];

/** 只出现在属性上的串（属性只走整串精确词条匹配，不应用规则） */
const ATTR_NODES: readonly string[] = [
	// <section> 与内部 role="region" 的无障碍名
	"Budgets",
	"Budget table",
	// 触发「所含用量提醒」下拉的按钮的 aria-label：取值只有 On / Off 两态
	"Included usage alerts: On",
	"Included usage alerts: Off",
];

/** 动态文本：逐条断言译文，而不只是断言「命中了」 */
const DYNAMIC_NODES: readonly (readonly [
	string,
	string,
])[] = [
	// 行内金额：实机节点原文带一个前导空格（<strong> 之后）
	[" / $0.00 spent", "/ 已支出 $0.00"],
	[" / $12.50 spent", "/ 已支出 $12.50"],
	// 表格标题的计数（单复数都命中）
	["5 budgets", "5 条预算"],
	["1 budget", "1 条预算"],
	// 分页的两种形态
	["1-5 of 5", "1-5 / 共 5 条"],
	[
		"Showing 1 to 5 of 5 budgets",
		"显示第 1 至 5 条，共 5 条预算",
	],
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，命中的节点
 * 写回译文并保留其首尾空白，最后拼接成页面上真实看到的那一行。
 */
function renderNodes(
	nodes: readonly string[],
	view: (typeof VIEWS)[number]["view"],
): string {
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

describe("新版预算页的模块路由", () => {
	it("loads the billing module after the settings shell", () => {
		// 个人路由上 pages/settings **在前**：账单模块排在它之后，只叠加账单专属词条，
		// 设置页外壳（侧栏、On / Off 等）由 pages/settings 先到先得（见 core/modules.jsonc）
		const personalNames = matchModules(
			PERSONAL_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(personalNames).toContain(
			"pages/settings-billing",
		);
		expect(personalNames).toContain("pages/settings");
		expect(
			personalNames.indexOf("pages/settings"),
		).toBeLessThan(
			personalNames.indexOf("pages/settings-billing"),
		);

		// 组织路由上账单模块**在前**、外壳由 pages/org-settings 兜底
		const orgNames = matchModules(
			ORG_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(orgNames).toContain("pages/settings-billing");
		expect(orgNames).toContain("pages/org-settings");
		expect(orgNames).not.toContain("pages/settings");
		expect(
			orgNames.indexOf("pages/settings-billing"),
		).toBeLessThan(orgNames.indexOf("pages/org-settings"));
	});
});

describe("新版预算页的实机节点边界", () => {
	it("translates every English text node GitHub actually renders", () => {
		for (const { label, view } of VIEWS) {
			for (const node of TEXT_NODES) {
				for (const variant of withWhitespace(node)) {
					const translated = translateText(variant, view);
					expect(
						translated,
						`${label}未命中：${JSON.stringify(variant)}`,
					).not.toBeNull();
					expect(translated ?? "").toMatch(
						/[\u4e00-\u9fff]/,
					);
				}
			}
		}
	});

	it("translates the attribute-only strings", () => {
		for (const { label, view } of VIEWS) {
			for (const node of ATTR_NODES) {
				const translated = translateText(node, view);
				expect(
					translated,
					`${label}属性未命中：${JSON.stringify(node)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the same wording on both routes", () => {
		const [personal, org] = VIEWS;
		for (const node of [...TEXT_NODES, ...ATTR_NODES]) {
			expect(
				translateText(node, personal.view),
				`两路译文不一致：${JSON.stringify(node)}`,
			).toBe(translateText(node, org.view));
		}
	});

	it("translates the dynamic nodes with their numbers", () => {
		for (const { label, view } of VIEWS) {
			for (const [raw, expected] of DYNAMIC_NODES) {
				expect(
					translateText(raw, view),
					`${label}：${JSON.stringify(raw)}`,
				).toBe(expected);
			}
		}
	});

	it("rebuilds the amount row from its two nodes", () => {
		// 实机：<strong>$0.00</strong> + ` / $0.00 spent`；<strong> 里的金额是
		// 纯数字 / 符号节点，引擎按设计跳过，故拼接结果由两个节点各出一半
		for (const { label, view } of VIEWS) {
			expect(
				renderNodes(["$0.00", " / $0.00 spent"], view),
				`${label}：金额行`,
			).toBe("$0.00 / 已支出 $0.00");
		}
	});

	it("rebuilds the scope trigger from its label and value", () => {
		// 实机渲染「Scope: 全部」：标签（带冒号）与当前值 All 是两个节点
		for (const { label, view } of VIEWS) {
			expect(
				renderNodes(["Scope: ", "All"], view),
				`${label}：范围按钮`,
			).toBe("范围： 全部");
		}
	});

	it("rebuilds the alerts trigger from its label and value", () => {
		// 实机渲染「Included usage alerts: 开启」：标签与当前值两个节点
		for (const { label, view } of VIEWS) {
			expect(
				renderNodes(
					["Included usage alerts: ", "On"],
					view,
				),
				`${label}：提醒按钮`,
			).toBe("所含用量提醒： 开启");
			expect(
				renderNodes(
					["Included usage alerts: ", "Off"],
					view,
				),
				`${label}：提醒按钮`,
			).toBe("所含用量提醒： 关闭");
		}
	});

	it("keeps the old budget nodes working", () => {
		// 旧版截图形态仍是既成事实：新版规则不得把它们吃掉
		const [, org] = VIEWS;
		for (const { view } of VIEWS) {
			expect(translateText("$0 spent", view)).toBe(
				"已支出 $0",
			);
			expect(translateText("5 Account budgets", view)).toBe(
				"5 条账户预算",
			);
		}
		expect(
			translateText("4 Organization budgets", org.view),
		).toBe("4 条组织预算");
	});

	it("leaves dynamic attribute values and user content in English", () => {
		for (const { label, view } of VIEWS) {
			for (const raw of [
				// 含动态用户名 / 百分比：属性不应用规则，故必须保持英文
				"Budget utilization for Oppenheymu",
				"100% of budget limit used",
				"View actions for Codespaces budget for Account Oppenheymu",
				// 用户内容与纯专名 / 缩写
				"Oppenheymu",
				"SKU",
				"Git LFS",
			]) {
				expect(
					translateText(raw, view),
					`${label}不应被翻译：${JSON.stringify(raw)}`,
				).toBeNull();
			}
		}
	});
});
