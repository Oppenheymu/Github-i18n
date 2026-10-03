// 组织仓库策略页（/organizations/<组织>/settings/policies/repositories）实机文本回归。
//
// 证据与强度：2026-10-03 维护者用 popup 开发者模式导出的漏翻清单（**途径 A**）。
// 途径 A 只给文本、不给节点边界，故这里只登记清单里本身就是完整节点的短句；
// 页面标题（`Settings · Repository policies · Koishi-CE`）是 `<title>` 文本节点，
// 含动态组织名，走 org-settings/page-title 规则（规则 id 见 core/rules.jsonc）。
//
// 两条边界事实：
//   1. 上面那两句提示在实机里是**同一句被链接拆开**的两段，译文要能直接拼起来读：
//      「组织规则集将不会强制执行 直到你将此组织账户升级为 GitHub Team。」
//      （两段之间的空格由 walker 保留原节点的前导空白而来，译文自身不带首尾空格）；
//   2. document.title 的中段是页面名，规则不递归，故保留英文；末段是组织名（用户内容），
//      原样带回。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /organizations/<组织>/settings/policies/repositories 命中的模块视图 */
const view = buildView(
	"/organizations/Koishi-CE/settings/policies/repositories",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（途径 A 清单逐条录入） */
const POLICY_NODES: readonly string[] = [
	"Repository policies",
	"Organization rulesets won't be enforced",
	"until you upgrade this organization account to GitHub Team.",
	"Define whether members can perform operations on repositories such as delete and transfer.",
];

/** 必须保持英文的实机文本：组织名与产品名 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Koishi-CE",
	"@Koishi-CE",
	"GitHub Team",
	"GitHub",
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
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("组织仓库策略页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of POLICY_NODES) {
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

	it("keeps the organization name and product names as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the rulesets notice across its link boundary", () => {
		// 实机：`Organization rulesets won't be enforced <a>until you upgrade …</a>`
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

	it("translates the page title through its rule", () => {
		// 中段（页面名）保留英文——规则不递归；末段是组织名，原样带回
		expect(
			translateText(
				"Settings · Repository policies · Koishi-CE",
				view,
			),
		).toBe("设置 · Repository policies · Koishi-CE");
		// 换一个页面名同样成立（同模块的其余设置页共用这条规则）
		expect(
			translateText(
				"Settings · Member privileges · Koishi-CE",
				view,
			),
		).toBe("设置 · Member privileges · Koishi-CE");
	});

	it("renders the repository-policies blurb", () => {
		expect(translateText("Repository policies", view)).toBe(
			"仓库策略",
		);
		expect(
			translateText(
				"Define whether members can perform operations on repositories such as delete and transfer.",
				view,
			),
		).toBe("定义成员是否可以对仓库执行删除、转移等操作。");
	});
});
