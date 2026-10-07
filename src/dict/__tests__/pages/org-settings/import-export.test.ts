// 组织导入/导出页（/organizations/<组织>/settings/import-export 与其归属邀请子页）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**两页整页实机 HTML**（采集时扩展仍在运行，故页面上
// 已是中文的两个 `Import/Export` 标题是既有键的产物，仍是英文的才是本批清单）。
// 两页都是**服务端渲染的传统 Primer 页面**（`Subhead` + `UnderlineNav` + `blankslate`），
// 长句里没有内联元素时就是一个整文本节点，故工具提示与说明段都按整节点收。
//
// 本文件锁五件事：
//   ① 两页都只命中 `pages/org-settings` + `global`，**不命中** `pages/settings` /
//      `pages/settings-billing` / `pages/repo-settings`；旧前缀 `/orgs/...` 同样命中；
//   ② 本批 9 条新键在实机的真实节点上全部命中（含带源码缩进与换行的形态）；
//   ③ 搜索框的 placeholder 与 aria-label 是**两个不同的串**（前者末尾多三个点），
//      属性只走精确命中，两条不得互相吃掉；`Mannequins` 一条键同时覆盖页签与表格表头；
//   ④ 归属邀请页的说明段是**单个文本节点**（只含源码换行缩进），按句拆开的形态必须
//      整条落空；三个状态值译成中文，其中 `completed` 与 global 的 `Completed` 同译；
//   ⑤ 与页面同形的拼接结果逐字正确（空态标题的源码缩进、说明段的源码换行）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 模特页（导入/导出的默认页签） */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/import-export";
/** 归属邀请页（同一外壳下的第二个页签） */
const INVITATIONS_PATH =
	"/organizations/Koishi-CE/settings/import-export/attribution-invitations";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/import-export";

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

/** 本批新补的文本节点与属性值（按实机 HTML 的标签嵌套誊录） */
const NEW_NODES: readonly string[] = [
	// —— 模特页：页签、搜索框与表头 ——
	// nav 的 aria-label（属性只走精确命中；它同时也是唯一一处「导入/导出导航」）
	"Import/Export Navigation",
	// 页签与表格表头是同一串，一条键覆盖两处
	"Mannequins",
	"Attribution Invitations",
	// 搜索框：placeholder 末尾有三个点、aria-label 没有，是**两个不同的串**
	"Search mannequins by login or email...",
	"Search mannequins by login or email",
	// 表头问号图标的 tooltip（aria-label，原文带尾随换行）
	"Mannequins represent authors of imported contributions. They do not have profile pages and cannot sign in. Their contributions can be reattributed to other members of your organization.",
	// 空态标题（原文带 16 个空格缩进与尾随换行）
	"There are no mannequins in this organization",
	// —— 归属邀请页 ——
	// 说明段：**单个文本节点**（原文只有源码换行缩进）
	'Below are the mannequin reattribution invitations that have been sent within this organization. If the state is "invited," then the user has not yet replied; if it is "completed," then the user has accepted and their contributions have been reattributed, and if it is "rejected," then the user opted not to be credited for that mannequin\'s contributions.',
	"No attribution invitations have been sent",
];

/** 页面标题 `Import/Export` 由本模块既有键命中（实机 HTML 里它已是中文） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [["Import/Export", "导入/导出"]];

/** 归属邀请页的说明段（实机文本节点的逐字形态） */
const NOTE_RAW =
	"\n    " +
	"Below are the mannequin reattribution invitations that have been sent within\n" +
	'    this organization. If the state is "invited," then the user has not yet replied;\n' +
	'    if it is "completed," then the user has accepted and their contributions have\n' +
	'    been reattributed, and if it is "rejected," then the user opted not to be\n' +
	"    credited for that mannequin's contributions.\n" +
	"    ";

/** 说明段的译文（留作拼接断言复用） */
const NOTE_TRANSLATION =
	"以下是此组织内已发出的模特贡献重新归属邀请。如果状态为“已邀请”，则表示该用户尚未回复；如果状态为“已完成”，则表示该用户已接受，其贡献已完成重新归属；如果状态为“已拒绝”，则表示该用户选择不为该模特的贡献署名。";

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白（**整节点被判空时不留空白**，与
 * walker.applyTextNode 的 erased 语义一致），最后拼接成页面上真实看到的那一行。
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

describe("组织导入/导出页的模块路由", () => {
	it("loads the org-settings shell on both tabs", () => {
		for (const path of [PAGE_PATH, INVITATIONS_PATH]) {
			const names = moduleNames(path);
			expect(names).toContain("pages/org-settings");
			expect(names).toContain("global");
		}
	});

	it("does not match the personal or per-repository settings modules", () => {
		for (const path of [PAGE_PATH, INVITATIONS_PATH]) {
			const names = moduleNames(path);
			expect(names).not.toContain("pages/settings");
			expect(names).not.toContain("pages/settings-billing");
			expect(names).not.toContain("pages/repo-settings");
		}
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织导入/导出页的实机节点", () => {
	it("translates every newly registered node", () => {
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
	});

	it("keeps the heading that was already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("translates the search box attribute strings verbatim", () => {
		// 两条只差末尾三个点，各译各的：placeholder 带点、aria-label 不带
		expect(
			translateText(
				"Search mannequins by login or email...",
				view,
			),
		).toBe("按登录名或邮箱搜索模特账号...");
		expect(
			translateText(
				"Search mannequins by login or email",
				view,
			),
		).toBe("按登录名或邮箱搜索模特账号");
	});

	it("translates the two blank-slate headings verbatim", () => {
		expect(
			translateText(
				"There are no mannequins in this organization",
				view,
			),
		).toBe("此组织中没有模特账号");
		expect(
			translateText(
				"No attribution invitations have been sent",
				view,
			),
		).toBe("尚未发送任何归属邀请");
	});

	it("translates the attribution note with its states in Chinese", () => {
		// 整段一个节点；三个状态值沿用 pages/repo-settings 译状态值的先例，
		// `completed` 与 global 的 `Completed`（「已完成」）同译
		expect(translateText(NOTE_RAW, view)).toBe(
			NOTE_TRANSLATION,
		);
		expect(
			translateText("Completed", view),
			"`Completed` 的既有译文应与本句里的状态值一致",
		).toBe("已完成");
	});
});

describe("组织导入/导出页的节点切分事实", () => {
	it("requires the tooltip to be one whole node", () => {
		// 工具提示是**单个文本节点**（句内没有链接与 `<strong>`）：
		// 按句拆开的形态全部落空，防止下次改版时误收碎片键
		expect(
			translateText(
				"Mannequins represent authors of imported contributions.",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"They do not have profile pages and cannot sign in.",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"Their contributions can be reattributed to other members of your organization.",
				view,
			),
		).toBeNull();
	});

	it("requires the attribution note to be one whole node", () => {
		// 同理：说明段按句拆开时任何键都不该命中
		expect(
			translateText(
				"Below are the mannequin reattribution invitations that have been sent within this organization.",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				'If the state is "invited," then the user has not yet replied;',
				view,
			),
		).toBeNull();
	});

	it("does not collect the bare singular or generic words", () => {
		// 页面上没有这些裸词节点；收了就是永不命中的死键（`mannequin` / `attribution`
		// 是小写泛化词，`Mannequin` 与页签的复数形态也不同串）
		for (const raw of [
			"Mannequin",
			"mannequin",
			"attribution",
		]) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织导入/导出页的拼接结果", () => {
	it("renders the table header from its source-indented node", () => {
		expect(
			renderNodes(["\n            Mannequins\n          "]),
		).toBe("\n            模特账号\n          ");
	});

	it("renders the mannequin blank slate with its indentation", () => {
		expect(
			renderNodes([
				"                There are no mannequins in this organization\n",
			]),
		).toBe("                此组织中没有模特账号\n");
	});

	it("renders the attribution note with its source newlines", () => {
		expect(renderNodes([NOTE_RAW])).toBe(
			`\n    ${NOTE_TRANSLATION}\n    `,
		);
	});

	it("renders the two tabs of the import/export nav", () => {
		expect(
			renderNodes([
				"\n    ",
				"Mannequins",
				"\n    ",
				"Attribution Invitations",
				"\n  ",
			]),
		).toBe("\n    模特账号\n    归属邀请\n  ");
	});
});
