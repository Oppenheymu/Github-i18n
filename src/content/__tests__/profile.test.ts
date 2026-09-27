// 个人 / 组织主页的「仓库列表」筛选菜单实机节点回归。
//
// 证据强度：**截图 + 维护者在实机采集的文本节点 dump**（2026-09 本页会话）。
//   - 截图 `https://github.com/Oppenheymu?tab=repositories&type=source`：Type 下拉展开后
//     只见 "Can be sponsored" 与 "Templates" 两项仍是英文（其余七项已是中文），
//     故这两条是待补项，其余键只做**回归锁定**，不重复登记；
//   - 同页 Console 的节点 dump（逐字录入下方常量）：结果摘要行被 <strong> 切成五个节点，
//     `a.issues-reset-query` 的文本节点是 `"\n          Clear filter\n"`，
//     两者都按采集到的原文（含真实换行缩进）断言。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. 菜单项都是**单节点短词**，与仓库名 / 用户名同形风险高，故必须锁「整节点相等」，
//      而不是「含中文」——后者会放过把菜单项关联到错误译文的情况；
//   2. 菜单里 All / Public / Private / Archived / Forks 由 global 模块覆盖、Sources / Mirrors
//      由 pages/profile 覆盖，Templates / Can be sponsored 本轮才登记进 pages/profile；
//      哪一条被删，下面的用例立刻红；
//   3. 结果摘要行是**五个节点**（`5` / `results for` / `source` / `repositories sorted by` /
//      `last updated`，加粗的三段各被 <strong> 单独包住，摘要是文本节点逐字采集来的：
//      `"\n        results\n        for\n          "` 这类带换行缩进的原文，经 normalizeKey
//      折叠空白后才等于词典键），故只能靠「片段词条 + 三条规则」拼装，
//      拼接结果必须是通顺的中文整句——这正是拼装断言存在的理由；
//      **未筛选态的节点边界是推断**：dump 只覆盖 `type=source`，但 `last updated` 既然被
//      <strong> 单独包住，未筛选时它同样是独立末节点（相邻空白由 walker 保留），
//      故词典收的是片段 `repositories sorted by` 而不是整句——若实机出现整句形态，
//      这里会表现为那一段保留英文（未命中即保留原文），届时补一条整句键即可。
//   4. 用户内容（仓库名 / 用户名 / 描述）必须保持英文——它们是整节点不收录的（反例断言）。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Oppenheymu?tab=repositories 命中的模块视图（pages/profile + global） */
const view = buildView(
	"/Oppenheymu",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/**
 * Type 下拉的九个选项：实机文本 → 实机中文渲染（逐字录入，顺序即菜单顺序）。
 * 「实机文本」栏就是词典键，必须与 GitHub 渲染的整节点原文一致。
 */
const TYPE_MENU: readonly (readonly [string, string])[] = [
	["All", "全部"], // global
	["Public", "公开"], // global
	["Private", "私有"], // global
	["Sources", "来源"], // pages/profile
	["Forks", "复刻"], // global
	["Archived", "已归档"], // global
	["Can be sponsored", "可被赞助"], // pages/profile（本轮新增）
	["Mirrors", "镜像"], // pages/profile
	["Templates", "模板"], // pages/profile（本轮新增）
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("pages/profile 的仓库列表筛选菜单", () => {
	it("translates every Type menu option to its rendered Chinese label", () => {
		for (const [node, expected] of TYPE_MENU) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("pins the two labels whose upstream l10n is missing", () => {
		// 「Can be sponsored」与「Templates」是本轮新登记的两条：上游自己的中文界面没翻这两项，
		// 只能靠本扩展补。断言用合并后的页面视图（pages/profile + global），故这里锁的是
		// 「命中且译文正确」；它们归哪个模块由 tooling/checks/view.ts 的赢家覆盖快照锁。
		expect(translateText("Can be sponsored", view)).toBe(
			"可被赞助",
		);
		expect(translateText("Templates", view)).toBe("模板");
	});

	it("keeps repository names, owners and descriptions in english", () => {
		// 反例：用户内容与纯专名整节点不收录（未命中即保留英文，这是正确行为）。
		// 「Github-i18n」「Oppenheymu」「MyLiteraryWorks」「TypeScript」「MIT License」
		// 都是实机出现在本页的用户内容 / 许可证专名。
		for (const node of [
			"Github-i18n",
			"Oppenheymu",
			"MyLiteraryWorks",
			"hex-iron",
			"MyLab",
			"A browser extension that provides multilingual translation of the GitHub interface, primarily in Chinese.",
			"TypeScript",
			"MIT License",
			"The Unlicense",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});

/**
 * 结果摘要行的实机文本节点（逐字抄自 2026-09 Console dump，含真实换行缩进）
 * 与各自应得的译文：未命中的节点会拿到 null，故 null 即红。
 * 加粗的三段（`5` / `source` / `last updated`）在 dump 里各自是一个文本节点，
 * 说明 `<strong>` 确实把这一行切成了五个节点——整句键在实机上永不命中。
 * 未带类型筛选时中间那段退化为整句 `repositories sorted by last updated`
 * （单条静态词条接手），对应断言在下面的「unfiltered」用例里。
 */
const SUMMARY_NODES: readonly (readonly [
	string,
	string | null,
])[] = [
	[
		"\n        results\n        for\n          ",
		"个结果，",
	],
	[
		"\n        repositories\n        sorted by ",
		"个仓库，按",
	],
	["last updated", "上次更新。"],
	["\n          Clear filter\n", "清除筛选"],
	// 纯数字节点翻不了，也不该收（收了就是永不命中的死键）
	["5", null],
];

describe("pages/profile 的仓库列表结果摘要", () => {
	it("translates every fragment the dump shows, including its real whitespace", () => {
		for (const [node, expected] of SUMMARY_NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("assembles both summary shapes through the same fragments", () => {
		// 类型名 `source` 是 Type 菜单的标识（专名不译），自己成一个节点。
		// 注意：这里刻意用**归一化后**的节点文本（词典键的形态）拼装，
		// 因为实机原文的换行缩进会被 walker 保留、再由浏览器折叠空白，拼装结果里
		// 只有空白差异；真正要锁的是「片段 + 类型名 + 末段能拼成一句通顺中文」。
		const translate = (node: string) =>
			translateText(node, view) ?? node;
		const filtered = [
			"5",
			"results for",
			"source",
			"repositories sorted by",
			"last updated",
		].map(translate);
		expect(filtered.join("")).toBe(
			"5个结果，source个仓库，按上次更新。",
		);
		// 未筛选时只是少了类型名那一段节点，其余片段完全一样——这正是
		// 「不把整句 `repositories sorted by last updated` 收成一条键」的理由
		// （末段被 <strong> 单独包住，整句键会永不命中，见 core/canonical.jsonc 注释）。
		const unfiltered = [
			"5",
			"results for",
			"repositories sorted by",
			"last updated",
		].map(translate);
		expect(unfiltered.join("")).toBe(
			"5个结果，个仓库，按上次更新。",
		);
	});

	it("keeps the capitalised Type-menu option apart from the summary fragments", () => {
		// 菜单项是 "Last updated"（大写 L，下拉里渲染为「最近更新」），摘要里的片段是
		// "last updated"（小写，渲染为「上次更新。」）——两者是两条不同的键，
		// 大小写混用会被这条用例挡住。
		expect(translateText("Last updated", view)).toBe(
			"最近更新",
		);
		expect(translateText("last updated", view)).toBe(
			"上次更新。",
		);
	});
});
