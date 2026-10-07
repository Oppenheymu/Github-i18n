// 组织付款历史页（/organizations/<组织>/billing/history）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页实机 HTML**——关键特征是**整页没有任何中文**：
// 标题 `Payment history`、空态 `You have not made any payments.` 与币种说明
// `Amounts shown in USD` 全是英文。而这三条**早就有译文**（标题在 pages/settings 与
// pages/org-settings，后两条在 pages/settings-billing，见
// src/dict/__tests__/pages/settings/billing.test.ts 的 HISTORY_NODES）。由此可反推路径：
// 只要路径里带 `/settings/`，pages/org-settings 就会命中，标题必然是中文——所以这一页落在
// **没有 settings 段**的那一支上：`/organizations/<组织>/billing/**`。
//
// 这一支是真实存在的（两条硬证据）：① 组织许可页的「Compare base plans」按钮 href 就是
// `/organizations/<组织>/billing/plans`；② 组织付款信息页的表单 action 指向
// `/organizations/<组织>/billing/extra`。它此前**只有 global 命中**，故整页保留英文。
// 2026-10-07 把 pages/settings-billing 的路由补成五支（见 core/modules.jsonc）。
// 本文件锁四件事：
//   ① 该路径命中 pages/settings-billing + global，且**不命中** pages/org-settings 与
//      pages/settings——这正是「标题类键必须在本模块再登记一份」的原因；
//   ② 三条节点在**三条路由**（组织非 settings / 组织 settings / 个人）上译文逐字一致；
//   ③ 同一支上的其它已知路径（`/organizations/octocat/billing/plans`）也吃到了账单模块；
//   ④ 账单模块仍然**不会**漏进组织设置的其它子页（路由互斥没有被这次扩张破坏）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 实机证据页：组织账单的**非 settings 前缀**那一支 */
const ORG_PATH = "/organizations/Koishi-CE/billing/history";
/** 同一页的组织 settings 支（此前的实机证据路径） */
const ORG_SETTINGS_PATH =
	"/organizations/Koishi-CE/settings/billing/history";
/** 同一页的个人支 */
const PERSONAL_PATH = "/account/billing/history";

function viewFor(pathname: string) {
	return buildView(
		pathname,
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);
}

const view = viewFor(ORG_PATH);

/** 实机 HTML 里仍是英文的三个文本节点（整页就这三个）与它们在三条路由上的预期译文 */
const EXPECTED: readonly (readonly [string, string])[] = [
	["Payment history", "付款历史"],
	[
		"You have not made any payments.",
		"你尚未进行任何付款。",
	],
	["Amounts shown in USD", "金额以美元显示"],
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("组织付款历史页的模块路由", () => {
	it("loads the billing module on the path without a settings segment", () => {
		const names = matchModules(
			ORG_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		// 这一支**只有**账单模块 + global：组织设置外壳不命中，所以标题键必须在账单模块里
		expect(names).not.toContain("pages/org-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the neighbouring pages of the same branch", () => {
		// 「Compare base plans」按钮的 href 就是这条路径（组织许可页实机 HTML 里的硬证据）
		for (const path of [
			"/organizations/octocat/billing/plans",
			"/organizations/octocat/billing/extra",
			"/orgs/octocat/billing/history",
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

	it("keeps the settings-prefixed and personal routes working", () => {
		// 组织 settings 支同时命中账单模块与组织设置外壳（逐键先到先得）
		const orgSettings = matchModules(
			ORG_SETTINGS_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(orgSettings).toContain("pages/settings-billing");
		expect(orgSettings).toContain("pages/org-settings");
		// 个人支由 pages/settings 提供标题与设置侧栏
		const personal = matchModules(
			PERSONAL_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(personal).toContain("pages/settings-billing");
		expect(personal).toContain("pages/settings");
	});

	it("does not leak the billing module into other org settings pages", () => {
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

describe("组织付款历史页的实机节点边界", () => {
	it("translates the three nodes the page renders", () => {
		for (const [raw, expected] of EXPECTED) {
			for (const variant of withWhitespace(raw)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("renders the same wording on all three routes of the same page", () => {
		// 同一条词条服务五支路由：组织非 settings / 组织 settings / 个人之间不得出现两副面孔
		const views = [
			view,
			viewFor(ORG_SETTINGS_PATH),
			viewFor(PERSONAL_PATH),
		];
		for (const [raw, expected] of EXPECTED) {
			for (const [index, other] of views.entries()) {
				expect(
					translateText(raw, other),
					`第 ${index + 1} 份视图的译文不一致：${JSON.stringify(raw)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps the page title in the billing module", () => {
		// 标题在 pages/settings 与 pages/org-settings 里都有，但这两支都不命中本路径，
		// 故本模块必须自己提供一份——这条断言就是那次「整页全英文」的回归保护
		expect(
			matchModules(
				ORG_PATH,
				dictForLocale("zh-CN").modules,
			).map((module) => module.name),
		).not.toContain("pages/org-settings");
		expect(translateText("Payment history", view)).toBe(
			"付款历史",
		);
	});

	it("leaves the credit-card icon inert and the empty state readable", () => {
		// 空态图标是 aria-hidden 的 Octicon，没有 alt / title 文案；页面没有任何
		// 可翻译属性。这句断言锁住「本页不需要属性用例」这个事实
		expect(
			translateText(
				"You have not made any payments.",
				view,
			),
		).toBe("你尚未进行任何付款。");
		expect(
			translateText("Amounts shown in USD", view),
		).toBe("金额以美元显示");
		// 币种代码不单独收录：它在本页是上面那句的一部分，独立的 `USD` 只在定价页有译文
		expect(translateText("USD", view)).toBeNull();
	});
});
