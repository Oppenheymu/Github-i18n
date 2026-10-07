// 组织许可页（/organizations/<组织>/settings/licensing）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页实机 HTML**（整段 outerHTML；采集时扩展仍在
// 运行，故「许可」这类已是中文的节点是扩展产物、仍是英文的才是待补清单）。
//
// 这一页此前正文整页英文的根因**不是缺词条而是缺路由**：它挂在组织设置路由下，路径里却
// 没有 billing 段（`/organizations/<组织>/settings/licensing`），pages/settings-billing
// 原来的三支路由一条都对不上，整页只剩 pages/org-settings 的侧栏词条——实机表现正是
// 「标题『许可』是中文、正文全英文」。2026-10-07 把该模块的组织支扩成
// `settings/(?:billing|licensing)`（见 core/modules.jsonc）。本文件锁五件事：
//   ① 该路径必须命中 pages/settings-billing + pages/org-settings，且**账单模块在前**
//      （逐键先到先得：许可页词条与规则由前者提供，组织设置外壳由后者兜底）；
//   ② 个人许可页既有的那批词条（Current GitHub base plan / Compare base plans / 清单行…）
//      在组织路径上真的生效，且两条路由**逐字一致**（同一个模块、同一份译文）；
//   ③ 四条配额规则（settings/licensing-*）在组织路径上生效——它们只挂在
//      pages/settings-billing 下，路由不加这一支就会整行保留英文；
//   ④ 组织侧独有的词条（Copilot Business 附加项卡、GitHub Free 的组织版说明、
//      Upgrade to Team）按节点原文命中；
//   ⑤ 「包含 / 不包含」的三种形态——清单上方带冒号的小标题 `Not included:`、每行删除图标的
//      `alt="Not included"`、每行包含图标的 `alt="Included"`——是三个不同的串，必须分别命中。
//
// 两条必须记住的边界事实：
//   1. outerHTML 把相邻文本节点拼在一起输出，**节点边界看不出**；本页的说明句与清单行在
//      实机 HTML 里都各自是单个节点（`<p>` / `<li>` 内只有一段文字），故按整串收键；
//   2. 产品名与方案名不译：GitHub Copilot / OpenAI / Team 保持英文（与 pages/org-settings
//      的「GitHub Team」口径一致），用例按反例断言。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const ORG_PATH =
	"/organizations/Koishi-CE/settings/licensing";
const PERSONAL_PATH = "/account/billing/licensing";

/** 组织路径命中的模块视图（pages/settings-billing + pages/org-settings + global） */
const view = buildView(
	ORG_PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 个人许可页视图：同一份共享节点清单在两条路由上必须译得**逐字一样** */
const personalView = buildView(
	PERSONAL_PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 组织侧独有的文本节点（逐条誊录实机 HTML，顺序即页面顺序） */
const ORG_ONLY_NODES: readonly string[] = [
	// Copilot Business 附加项卡
	"Your AI powered pair programmer",
	"Learn more about Copilot Business",
	"GitHub Copilot uses the OpenAI large language models to suggest code and entire functions in real-time, right from your editor. You can set up a GitHub Copilot Business subscription for your organization.",
	"Sign up for Copilot Business",
	// 基础方案区块的组织版
	"Upgrade to Team",
	"The basics for organizations and developers",
	// 清单上方的小标题：带 ASCII 冒号
	"Not included:",
];

/**
 * 个人许可页已有译文、且在组织路径上必须照常命中的节点。
 * 它们之所以能被复用，是因为**同一个模块**（pages/settings-billing）覆盖了两条路由——
 * 这正是「补路由而不是复印词条」的理由。
 */
const SHARED_NODES: readonly string[] = [
	"Current GitHub base plan",
	"Compare base plans",
	"Unlimited public/private repos",
	"Unlimited collaborators",
	"2,000 Actions minutes/month",
	"500MB of Packages storage",
	"120 core-hours of Codespaces compute per developer",
	"15GB of Codespaces storage per developer",
	"Community support",
	"Free Codespaces usage per organization",
	"Protected branches on all repos",
	"Increase Codespaces",
	"spend limits",
	"Multiple reviewers in pull requests",
	"Required status checks",
	"Code owners",
	"Required reviewers",
	"Pages for static website hosting",
	"Web-based support",
	"See all features and compare plans",
];

/**
 * 可翻译的**属性**（本页实机 HTML 里每行图标的 alt）。三条文案互不相同，
 * 整节点 / 整属性精确匹配故不会互相吃掉；属性只走词条、不应用规则（见 walker.ts）。
 */
const ATTRIBUTE_NODES: readonly [string, string][] = [
	["Included", "已包含"],
	["Not included", "不包含"],
];

/** 必须保持英文：专名、用户内容与数值 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"GitHub Copilot",
	"GitHub",
	"Copilot",
	"OpenAI",
	"Team",
	"Koishi-CE",
	"2,000",
	"500MB",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
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

describe("组织许可页的模块路由", () => {
	it("loads the billing module ahead of the org-settings shell", () => {
		const names = matchModules(
			ORG_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		// 组织设置外壳（侧栏等）同样命中，靠模块顺序决定逐键先到先得
		expect(names).toContain("pages/org-settings");
		expect(
			names.indexOf("pages/settings-billing"),
		).toBeLessThan(names.indexOf("pages/org-settings"));
	});

	it("keeps the personal licensing routes working", () => {
		// 个人侧两支都要照旧命中：新地址与仅存的旧地址
		for (const path of [
			PERSONAL_PATH,
			"/settings/billing/licensing",
		]) {
			expect(
				matchModules(
					path,
					dictForLocale("zh-CN").modules,
				).map((module) => module.name),
				`${path} 应命中账单模块`,
			).toContain("pages/settings-billing");
		}
	});

	it("does not leak the billing module into other org settings pages", () => {
		// 许可页词条（Upgrade to Team / GitHub Free…）不得注入组织资料页等其它子页
		for (const path of [
			"/organizations/Koishi-CE/settings/profile",
			"/organizations/Koishi-CE/settings/member_privileges",
			"/organizations/Koishi-CE/settings/authentication_security",
		]) {
			expect(
				matchModules(
					path,
					dictForLocale("zh-CN").modules,
				).map((module) => module.name),
				`${path} 不应命中账单模块`,
			).not.toContain("pages/settings-billing");
		}
	});
});

describe("组织许可页的实机节点边界", () => {
	it("translates the nodes only the organization page renders", () => {
		for (const node of ORG_ONLY_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				// 译文必须是中文（防「收录了键但值还是英文」这类静默失效）
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("reuses the personal licensing wording on the shared nodes", () => {
		for (const node of SHARED_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("translates the icon alt attributes", () => {
		for (const [raw, expected] of ATTRIBUTE_NODES) {
			expect(
				translateText(raw, view),
				`属性未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps product names, plan names and user content as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织许可页与个人许可页的措辞一致", () => {
	it("renders every shared node identically on both routes", () => {
		// 同一个模块、同一份译文：两条路由的差异只在兜底层（pages/settings vs
		// pages/org-settings），共享节点不得因兜底层不同而换词
		for (const node of SHARED_NODES) {
			expect(
				translateText(node, view),
				`两条路由译文不一致：${JSON.stringify(node)}`,
			).toBe(translateText(node, personalView));
		}
	});

	it("renders the organization page title through the org-settings shell", () => {
		// 本页路由**不命中** pages/settings，标题「许可」由 pages/org-settings 提供
		//（个人侧由 pages/settings 提供同一个键、同一份译文）
		expect(translateText("Licensing", view)).toBe("许可");
		expect(
			matchModules(
				ORG_PATH,
				dictForLocale("zh-CN").modules,
			).map((module) => module.name),
		).not.toContain("pages/settings");
	});

	it("rewrites the plan quota lines with their numbers", () => {
		// 四条配额清单靠 settings/licensing-* 规则；规则挂在 pages/settings-billing 下，
		// 路由漏了这一支就会整行保留英文
		expect(
			translateText("2,000 Actions minutes/month", view),
		).toBe("2,000 分钟 Actions/月");
		expect(
			translateText("500MB of Packages storage", view),
		).toBe("500MB Packages 存储");
		expect(
			translateText(
				"120 core-hours of Codespaces compute per developer",
				view,
			),
		).toBe("每位开发者 120 个代码空间核心小时");
		expect(
			translateText(
				"15GB of Codespaces storage per developer",
				view,
			),
		).toBe("每位开发者 15GB 代码空间存储");
	});
});

describe("组织许可页的三种「包含 / 不包含」形态", () => {
	it("keeps the colon, the plain attribute and the included attribute apart", () => {
		// 三个串互不相同，且都不是彼此的前缀式误命中（整节点 / 整属性精确匹配）
		expect(translateText("Not included:", view)).toBe(
			"不包含：",
		);
		expect(translateText("Not included", view)).toBe(
			"不包含",
		);
		expect(translateText("Included", view)).toBe("已包含");
	});

	it("renders the not-included list rows around their links", () => {
		// 带链接的那一行在实机里是「片段 + 链接文本」两个节点，链接文本另有词条
		expect(
			renderNodes([
				"Increase Codespaces\n        ",
				"spend limits",
			]),
		).toBe("提高代码空间\n        支出限额");
	});

	it("renders the Copilot add-on card", () => {
		expect(
			translateText(
				"Your AI powered pair programmer",
				view,
			),
		).toBe("你的 AI 驱动的结对编程助手");
		expect(
			translateText(
				"Learn more about Copilot Business",
				view,
			),
		).toBe("进一步了解 Copilot Business");
		expect(
			translateText("Sign up for Copilot Business", view),
		).toBe("注册 Copilot Business");
		expect(
			translateText(
				"GitHub Copilot uses the OpenAI large language models to suggest code and entire functions in real-time, right from your editor. You can set up a GitHub Copilot Business subscription for your organization.",
				view,
			),
		).toBe(
			"GitHub Copilot 使用 OpenAI 的大语言模型，直接从你的编辑器中实时给出代码乃至整个函数的建议。你可以为你的组织设置 GitHub Copilot Business 订阅。",
		);
	});

	it("renders the organization base plan card", () => {
		expect(translateText("Upgrade to Team", view)).toBe(
			"升级到 Team",
		);
		expect(
			translateText(
				"The basics for organizations and developers",
				view,
			),
		).toBe("面向组织和开发者的基础功能");
		// 方案名「GitHub Free」由本模块更靠前的词条提供（同译「GitHub 免费版」）
		expect(translateText("GitHub Free", view)).toBe(
			"GitHub 免费版",
		);
	});
});
