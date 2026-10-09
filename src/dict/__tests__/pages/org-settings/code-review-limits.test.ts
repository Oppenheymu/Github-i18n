// 组织代码审查限制页（/organizations/<组织>/settings/code_review_limits）实机文本回归。
//
// 证据与强度：2026-10-09 维护者贴出的**整页实机 HTML**（采集时扩展仍在运行，
// 故页面上已是中文的页首 H2「代码审查限制」是**侧栏键**的产物，不是本批新键）。
// 本页是**服务端渲染的传统 Primer 页面**：两段长说明都是**含源码换行的单个节点**
//（句内没有链接与 `<strong>`），键按 `normalizeKey` 折叠空白后才等于词典键。
//
// 本文件锁五件事：
//   ① 本页只命中 `pages/org-settings` + `global`，**不命中** `pages/settings` /
//      `pages/settings-billing` / `pages/repo-settings`；旧前缀 `/orgs/...` 同样命中；
//   ② 本批 5 条新键在实机的真实节点上全部命中（含带内部换行的原始形态）；
//   ③ 其中 4 条与个人设置的 /settings/code_review_limits **同串**（那条路由
//      `^/(?:settings|account/billing)` 不命中 /organizations/**），故本模块各收一份
//      并**逐字同译**——用例断言两份视图的译文逐字相等；
//   ④ 只有页首那句是组织侧独有措辞（`in public repositories within this organization`），
//      个人页的 `your public repositories` 与仓库级子页的 `this repository`
//      在本页**必须不命中**（两条反例）；
//   ⑤ 页首 H2 由侧栏键覆盖（`Code review limits` → 「代码审查限制」），
//      用例把它当「扩展确实在这一页生效」的对照物一并锁住。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织代码审查限制页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/code_review_limits";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/code_review_limits";

const locale = dictForLocale("zh-CN");

/** 本页命中的模块视图（pages/org-settings + global） */
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 个人设置页那条路由的视图（用于断言两页同译；它**不**命中本页路径） */
const PERSONAL_VIEW = buildView(
	"/settings/code_review_limits",
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本批新补的文本节点（按实机 HTML 的标签嵌套誊录） */
const NEW_NODES: readonly string[] = [
	"Restrict users who are permitted to approve or request changes on pull requests in public repositories within this organization.",
	"Code review limits may already be specified by individual repositories. Any changes here will override those limits until unset.",
	// 长句里没有内联元素，故整段是一个文本节点；`"approve"` / `"request changes"`
	// 用的是**直引号**（与 personal 页那条同形）
	'Code review limits are currently managed individually for all repositories. Enable limits to permit only users who have explicitly been granted access to each repository to submit reviews that "approve" or "request changes". Remove limits to allow all users to submit pull request reviews. All users able to submit comment pull request reviews will continue to be able to do so.',
	"Limit reviews on all repositories",
	"Remove review limits from all repositories",
];

/**
 * 两段长说明在实机里**自带源码换行**（键按 normalizeKey 折叠空白后才相等）：
 * 这两条是 HTML 里的原始形态，必须同样命中。
 */
const RAW_MULTILINE_NODES: readonly string[] = [
	"Code review limits may already be specified by individual repositories. Any changes here will override those\n        limits until unset.",
	'Code review limits are currently managed individually for all repositories. Enable limits to permit only\n            users who have explicitly been granted access to each repository to submit reviews that "approve" or\n            "request changes". Remove limits to allow all users to submit pull request reviews. All users able to submit\n            comment pull request reviews will continue to be able to do so.',
];

/** 页面上已是中文的节点（侧栏键的产物，用作「扩展确实在这一页生效」的对照物） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [["Code review limits", "代码审查限制"]];

/**
 * 必须保持英文：个人页与仓库级子页的措辞（两条路由都不命中本页，
 * 且本模块不该把它们当别名收下）。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 个人设置页（your public repositories，复数）
	"Restrict users who are permitted to approve or request changes on pull requests in your public repositories.",
	// 仓库级子页（this repository，单数）
	"Restrict users who are permitted to approve or request changes on pull requests in this repository.",
	// 用户内容
	"Koishi-CE",
];

/** 与个人设置页**同串**的节点：本模块各收一份并逐字同译 */
const SHARED_WITH_PERSONAL: readonly string[] = [
	"Code review limits may already be specified by individual repositories. Any changes here will override those limits until unset.",
	'Code review limits are currently managed individually for all repositories. Enable limits to permit only users who have explicitly been granted access to each repository to submit reviews that "approve" or "request changes". Remove limits to allow all users to submit pull request reviews. All users able to submit comment pull request reviews will continue to be able to do so.',
	"Limit reviews on all repositories",
	"Remove review limits from all repositories",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("组织代码审查限制页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the personal, billing or per-repository modules", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/settings-billing");
		expect(names).not.toContain("pages/repo-settings");
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织代码审查限制页的实机节点", () => {
	it("translates every newly registered node", () => {
		for (const node of [
			...NEW_NODES,
			...RAW_MULTILINE_NODES,
		]) {
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

	it("keeps the node that was already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the personal and repository wording in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the shared strings exactly like the personal settings page", () => {
		for (const raw of SHARED_WITH_PERSONAL) {
			const here = translateText(raw, view);
			expect(
				here,
				`本页未命中：${JSON.stringify(raw)}`,
			).not.toBeNull();
			expect(
				here,
				`两页译文不一致：${JSON.stringify(raw)}`,
			).toBe(translateText(raw, PERSONAL_VIEW));
		}
	});

	it("gives the organization-only blurb its own key", () => {
		expect(
			translateText(
				"Restrict users who are permitted to approve or request changes on pull requests in public repositories within this organization.",
				view,
			),
		).toBe(
			"限制哪些用户可以在本组织的公开仓库中对拉取请求进行批准或请求更改。",
		);
		expect(
			translateText(
				"Limit reviews on all repositories",
				view,
			),
		).toBe("限制所有仓库的审查");
		expect(
			translateText(
				"Remove review limits from all repositories",
				view,
			),
		).toBe("移除所有仓库的审查限制");
	});
});
