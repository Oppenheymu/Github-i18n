// 组织版主页（/organizations/<组织>/settings/moderators）实机文本回归。
//
// 证据与强度：2026-10-09 维护者贴出的**整页实机 HTML**（采集时扩展仍在运行，
// 故页面上已是中文的页首 H2「版主」是**侧栏键**的产物，不是本批新键）。
// 本页是**服务端渲染的传统 Primer 页面**（`Subhead` + `auto-complete` + `Box`）。
//
// 本文件锁五件事：
//   ① 本页只命中 `pages/org-settings` + `global`，**不命中** `pages/settings` /
//      `pages/settings-billing` / `pages/repo-settings`；旧前缀 `/orgs/...` 同样命中；
//   ② 本批 6 条新键（其中 2 条只出现在输入框的属性上）在实机的真实节点上全部命中；
//   ③ 版主是**组织专有概念**、没有个人设置的对应页，故六条全是新增（不是「明明
//      翻译过却漏翻」那一类），用例另把上面那条 H2 当对照物锁住；
//   ④ 「最多可添加 10 名成员或团队」被 `<strong>10</strong>` 切成三个节点：
//      数字是独立节点（引擎跳过纯数字节点），前后两段各自成键；
//   ⑤ 结果列表的 aria-label `results` **有意不收录**（既有两处收录的译文互不
//      相同、屏显不可见，同 `billing-managers` 与已屏蔽用户页的判定）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织版主页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/moderators";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/moderators";

const locale = dictForLocale("zh-CN");

/** 本页命中的模块视图（pages/org-settings + global） */
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

/** 本批新补的文本节点（按实机 HTML 的标签嵌套誊录） */
const NEW_NODES: readonly string[] = [
	// 说明段两句之间只有源码换行，故整段是一个文本节点
	"You can add organization members or teams as moderators for your organization. Moderators can block and unblock users from the organization, minimize comments, and manage interaction limits for all public organization repositories.",
	// 「最多可添加 10 名成员或团队」：数字是独立节点，前后两段各自成键
	"You may add up to",
	"members or teams as moderators.",
	"You don't have any moderators for this organization.",
];

/** 输入框上的两个属性（aria-label 与 placeholder 是两个不同的串） */
const ATTRS: readonly string[] = [
	"Add a member or team as a moderator",
	"Add a member or team",
];

/** 页面上已是中文的节点（侧栏键的产物，用作「扩展确实在这一页生效」的对照物） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [["Moderators", "版主"]];

/** 必须保持英文：有意不收录的串与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 结果列表的 aria-label：既有两处收录的译文互不相同（「结果」/「个结果」），
	// 证明它按上下文取值、且屏显不可见，故有意不收录
	"results",
	// 用户内容
	"Koishi-CE",
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

describe("组织版主页的模块路由", () => {
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

describe("组织版主页的实机节点", () => {
	it("translates every newly registered node", () => {
		for (const node of [...NEW_NODES, ...ATTRS]) {
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

	it("keeps the strings that must stay English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the intro paragraph and the two attributes", () => {
		expect(
			translateText(
				"You can add organization members or teams as moderators for your organization. Moderators can block and unblock users from the organization, minimize comments, and manage interaction limits for all public organization repositories.",
				view,
			),
		).toBe(
			"你可以将组织成员或团队添加为你组织的版主。版主可以在组织中屏蔽和解除屏蔽用户、最小化评论，并管理所有公开组织仓库的互动限制。",
		);
		// 输入框：aria-label 与 placeholder 不是同一个串，各有一条键
		expect(
			translateText(
				"Add a member or team as a moderator",
				view,
			),
		).toBe("添加成员或团队作为版主");
		expect(
			translateText("Add a member or team", view),
		).toBe("添加成员或团队");
		expect(
			translateText(
				"You don't have any moderators for this organization.",
				view,
			),
		).toBe("此组织没有任何版主。");
	});

	it("reassembles the moderator-count sentence around the number node", () => {
		// 实机：`You may add up to <strong>10</strong>\n    members or teams as moderators.`
		// ——数字是独立节点（引擎跳过纯数字节点），前后两段的空白由 walker 保留，
		// 故渲染出来是「你最多可以添加 10 名成员或团队作为版主。」
		expect(
			renderNodes([
				"\n    You may add up to ",
				"10",
				"\n    members or teams as moderators.\n  ",
			]),
		).toBe(
			"\n    你最多可以添加 10\n    名成员或团队作为版主。\n  ",
		);
		// 上限若换成别的数字（上游 ERB 插值），两段碎片键仍然成立
		expect(
			renderNodes([
				"You may add up to ",
				"3",
				" members or teams as moderators.",
			]),
		).toBe("你最多可以添加 3 名成员或团队作为版主。");
	});
});
