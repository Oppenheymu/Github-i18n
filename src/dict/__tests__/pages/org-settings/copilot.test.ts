// 组织 Copilot 设置页（/organizations/<组织>/settings/copilot）实机回归。
//
// 证据：2026-10-11 维护者贴的实机 HTML（`Layout-main-centered-xl` + `Subhead` 外壳，
// 订阅按钮带 `?organization=Koishi-CE` ⇒ 组织页）。
//
// 这一页有两个「脏活」值得单独记：
//   ① 上游把大标题 `Your AI Pair Programmer` **从单词中间切成了两个 `<h2>`**——
//      本色 `Your AI Pa` + 灰色带左侧竖线的 `ir Programmer`，靠前者的
//      `margin-right: -2px` 贴回去拼出一个词的双色效果。中文沿用本仓既有的
//      「结对编程助手」（见 pages/settings-billing 的两条 Copilot 键），
//      在两个碎片上切成「你的 AI 结对」+「编程助手」，双色分界正好落在词义边界；
//   ② 说明段整段是**一个文本节点**，句中的 `you’ll` 撇号是直是弯无法逐字证实，
//      故走规则 `org-settings/copilot-pair-programmer-intro`，pattern 里用
//      `['’]` 字符类同时覆盖两种写法（先例：`billing-sponsors/support-button` 与
//      `repo-settings/advanced-security-intro` 的注释）。
//
// 本文件锁四件事：
//   ① 路由：命中 pages/org-settings + global，不命中 pages/repo-settings / pages/settings；
//   ② 4 条静态键与 1 条规则（两种撇号形态都必须命中且译文相同）全部就位；
//   ③ 节点切分：标题两个碎片拼出的整句、说明段「段一 → 链接 → 段二」拼出的整句
//      都由用例钉住（中文状语只能留在句尾，属碎片顺序的硬约束）；
//   ④ 反例：`GitHub Copilot` / `Copilot` 是纯专名、一律保持英文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织 Copilot 设置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/copilot";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/copilot";

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

/** 实机里仍是英文的静态节点（按页面自上而下的顺序） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	// 被切成两半的双色标题（两个碎片各查各的键，拼起来才是整句）
	["Your AI Pa", "你的 AI 结对"],
	["ir Programmer", "编程助手"],
	// 说明段之后的碎片
	["inside your organization.", "在你的组织内。"],
	// 卡片主按钮
	["Enable GitHub Copilot", "启用 GitHub Copilot"],
];

/** 说明段（整节点、走规则）：撇号的两种形态都要命中 */
const RULE_SENTENCE_PREFIX =
	"The AI powered pair programmer for your organization. Once you complete onboarding, you\u2019ll ";
const RULE_SENTENCE_TAIL =
	"have the ability to manage policies and control which users or teams will have access to";
const RULE_SENTENCES: readonly string[] = [
	`${RULE_SENTENCE_PREFIX}${RULE_SENTENCE_TAIL}`,
	`${RULE_SENTENCE_PREFIX.replace("\u2019", "'")}${RULE_SENTENCE_TAIL}`,
];
const RULE_EXPECTED =
	"为你的组织提供的 AI 驱动结对编程助手。完成入门引导后，你将能够管理策略，并控制哪些用户或团队可以访问";

/** 规则的锚定反例 */
const NOT_MATCHED: readonly string[] = [
	// 时态 / 措辞被改动就不该命中（锚定在整串上）
	`The AI powered pair programmer for your organization. Once you complete onboarding, you will ${RULE_SENTENCE_TAIL}`,
	`The ai powered pair programmer for your organization. Once you complete onboarding, you\u2019ll ${RULE_SENTENCE_TAIL}`,
	`The AI powered pair programmer for your organization. Once you complete onboarding, you\u2019ll ${RULE_SENTENCE_TAIL}.`,
	"Once you complete onboarding, you\u2019ll have the ability to manage policies",
];

/** 纯专名 / 用户内容 / 标识符，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"GitHub Copilot",
	"Copilot",
	"GitHub",
	"Koishi-CE",
	"microsoft-analytics",
];

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

describe("组织 Copilot 设置页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the per-repository or per-account modules", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy prefix", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织 Copilot 设置页的实机节点", () => {
	it("translates every static node that was still English", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("translates the intro paragraph through the apostrophe-tolerant rule", () => {
		for (const raw of RULE_SENTENCES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(RULE_EXPECTED);
		}
	});

	it("keeps the rule anchored to the whole sentence", () => {
		for (const raw of NOT_MATCHED) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("keeps product names in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织 Copilot 设置页的节点切分事实", () => {
	it("renders the two-tone headline that upstream split mid-word", () => {
		// 实机：`<h2>Your AI Pa</h2><h2>ir Programmer</h2>`——两段之间没有任何空白
		//（靠前者的 `margin-right: -2px` 贴回一个词），中文拼起来读作「你的 AI 结对编程助手」
		expect(
			renderNodes(["Your AI Pa", "ir Programmer"]),
		).toBe("你的 AI 结对编程助手");
	});

	it("renders the intro paragraph across its link", () => {
		// 实机：段一 + `<a>GitHub Copilot</a>` + 段二；中文的状语只能落在句尾
		expect(
			renderNodes([
				`${RULE_SENTENCE_PREFIX}${RULE_SENTENCE_TAIL} `,
				"GitHub Copilot",
				" inside your organization.",
			]),
		).toBe(
			`${RULE_EXPECTED} GitHub Copilot 在你的组织内。`,
		);
	});

	it("renders the upsell card heading and button", () => {
		// 页头 h2 `GitHub Copilot` 是纯专名，中英文同形、不需要键
		expect(
			renderNodes([
				"GitHub Copilot",
				"Your AI Pa",
				"ir Programmer",
				"Enable GitHub Copilot",
			]),
		).toBe(
			"GitHub Copilot你的 AI 结对编程助手启用 GitHub Copilot",
		);
	});
});
