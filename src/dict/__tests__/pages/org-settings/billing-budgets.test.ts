// 组织路由下的预算与提醒页（/organizations/<组织>/settings/billing/budgets）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**实机 HTML 片段**（「所含用量提醒」的 ActionList
// 下拉菜单 + 表格标题行的计数 span；采集时扩展在运行，已是中文的节点是扩展产物）。
// 这一页与个人账单页的 /account/billing/budgets 是**同一套组件**（BudgetsTable 等），
// 故词条与规则都登记在 pages/settings-billing，本文件锁三件事：
//   ① 该路径必须命中 pages/settings-billing + pages/org-settings + global，账单模块在前，
//      且**不得**命中 pages/settings（它的路由 ^/(?:settings|account/billing) 不覆盖组织路由）；
//   ② 菜单项（ActionList.Item.Label）与其说明（ActionList.Description）各自成节点，
//      两行菜单项只差 on / off 一个词，必须分别命中、不得互相吃掉；
//   ③ 计数行在两种归属下是两种写法（个人路由 Account budgets / 组织路由 Organization budgets），
//      归属词写死在 pattern 与模板里（模板不支持「捕获组 → 中文」映射），两种都要锁住。
//
// 有意保持英文的：说明句里的产品名 Git LFS / Sandbox（本模块一贯不收录），
// 以及单节点的 Packages 之类不由本文件断言——说明句是**整节点**，产品名不会被单独拆出来翻。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const ORG_PATH =
	"/organizations/Koishi-CE/settings/billing/budgets";
const PERSONAL_PATH = "/account/billing/budgets";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));

/** 两条路由各自的模块视图（组织路由没有 pages/settings 这一层，兜底由 pages/org-settings 承担） */
const VIEWS = [
	{
		label: "组织路由",
		view: buildView(ORG_PATH, locale, aliases),
	},
	{
		label: "个人路由",
		view: buildView(PERSONAL_PATH, locale, aliases),
	},
] as const;

/** 实机 HTML 片段里仍是英文的文本节点（逐条誊录，顺序即页面顺序） */
const BUDGETS_MENU_NODES: readonly string[] = [
	// 区块标题（既有词条，顺带锁住组织路由上确实生效）
	"Included usage alerts",
	// 下拉菜单的两个单选项与它们的同一句说明
	"Turn on included usage email alerts",
	"This includes Actions, Git LFS, Packages, and Sandbox",
	"Turn off included usage email alerts",
];

/** 必须保持英文：本模块一贯不收录的产品名 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Git LFS",
	"Sandbox",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白（**整节点被判空时不留空白**，与
 * walker.applyTextNode 的 erased 语义一致），最后拼接成页面上真实看到的那一行。
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

describe("组织路由下预算页的模块路由", () => {
	it("loads the billing module ahead of the org-settings shell", () => {
		const names = matchModules(
			ORG_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		expect(names).toContain("pages/org-settings");
		expect(
			names.indexOf("pages/settings-billing"),
		).toBeLessThan(names.indexOf("pages/org-settings"));
	});

	it("does not pull in the personal settings module", () => {
		expect(
			matchModules(ORG_PATH, locale.modules).map(
				(module) => module.name,
			),
		).not.toContain("pages/settings");
	});

	it("keeps the personal budgets page on the billing module", () => {
		expect(
			matchModules(PERSONAL_PATH, locale.modules).map(
				(module) => module.name,
			),
		).toContain("pages/settings-billing");
	});
});

describe("组织路由下预算页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const { label, view } of VIEWS) {
			for (const node of BUDGETS_MENU_NODES) {
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

	it("renders the same wording on both routes", () => {
		const [org, personal] = VIEWS;
		for (const node of BUDGETS_MENU_NODES) {
			expect(
				translateText(node, org.view),
				`两路译文不一致：${JSON.stringify(node)}`,
			).toBe(translateText(node, personal.view));
		}
	});

	it("keeps the two menu items apart", () => {
		for (const { label, view } of VIEWS) {
			expect(
				translateText(
					"Turn on included usage email alerts",
					view,
				),
				`${label}：开启项`,
			).toBe("开启所含用量邮件提醒");
			expect(
				translateText(
					"Turn off included usage email alerts",
					view,
				),
				`${label}：关闭项`,
			).toBe("关闭所含用量邮件提醒");
		}
	});

	it("keeps the product names inside the description sentence", () => {
		for (const { label, view } of VIEWS) {
			expect(
				translateText(
					"This includes Actions, Git LFS, Packages, and Sandbox",
					view,
				),
				`${label}：说明句`,
			).toBe("包含 Actions、Git LFS、Packages 与 Sandbox");
			for (const raw of MUST_STAY_ENGLISH) {
				expect(
					translateText(raw, view),
					`${label}不应被翻译：${JSON.stringify(raw)}`,
				).toBeNull();
			}
		}
	});

	it("translates the trigger button label and its value node", () => {
		// 实机渲染「Included usage alerts: 开启」：标签（带冒号）与当前值（On / Off）是两个节点，
		// 值节点由 pages/org-settings 与 pages/settings 的同键负责，故本模块只补带冒号的标签；
		// 无论空格落在标签节点的尾部还是值节点的首部，拼接结果都是这一串
		for (const { label, view } of VIEWS) {
			expect(
				translateText("Included usage alerts:", view),
				`${label}：标签`,
			).toBe("所含用量提醒：");
			expect(
				renderNodes(
					["Included usage alerts: ", "On"],
					view,
				),
				`${label}：标签 + 值`,
			).toBe("所含用量提醒： 开启");
			expect(
				renderNodes(
					["Included usage alerts: ", "Off"],
					view,
				),
				`${label}：标签 + 值`,
			).toBe("所含用量提醒： 关闭");
		}
	});

	it("translates the count line in both ownership wordings", () => {
		const [org, personal] = VIEWS;
		// 组织路由：Organization budgets（单复数都覆盖）
		expect(
			translateText("4 Organization budgets", org.view),
		).toBe("4 条组织预算");
		expect(
			translateText("1 Organization budget", org.view),
		).toBe("1 条组织预算");
		// 个人路由：Account budgets（2026-09 截图形态，规则未改动）
		expect(
			translateText("5 Account budgets", personal.view),
		).toBe("5 条账户预算");
		// 两条规则各自的 pattern 只认自己的归属词，不会互相吃掉
		expect(
			translateText(
				"4 Organization budgets",
				personal.view,
			),
		).toBe("4 条组织预算");
		expect(
			translateText("5 Account budgets", org.view),
		).toBe("5 条账户预算");
	});
});
