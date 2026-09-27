// 仓库设置页的「代理建议」子页（/owner/repo/settings/suggestions）实机文本回归。
//
// 边界强度：**实机 outerHTML 实证**（2026-09-27 维护者提供的 React 版设置页片段）。
// 该片段里正文只剩 11 个英文文本节点；标题「Agent suggestions for issues」与保存 / 取消
// 按钮当时已是中文（分别由 pages/repo-settings 与 global 覆盖），故不在本清单里。
//
// 节点边界（本次最容易登记错的地方）：四个单选项的**标签与说明是两个独立节点**
// （`<label>` 与相邻的 `<span class="FormControl-Caption">`），legend 里的标题与 caption
// 同理，说明句则是单个 `<p class="mb-0">`——所以 11 条键逐条对应 11 个节点，
// 既不能把标签与说明合并成一条，也不能把说明再切开。
//
// 刻意**不收录**（下方反例断言）：
//   - radio 的 `value` 属性：`ALWAYS_SUGGEST` / `HIGH` / `MEDIUM` / `LOW` 是内部枚举值，
//     不是给用户看的文案（属性翻译只走精确命中，不收即保留英文）；
//   - 用户内容与品牌：`Oppenheymu` / `Github-i18n` / `Copilot` / `GitHub`。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Oppenheymu/Github-i18n/settings/suggestions 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/suggestions",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机片段里的 11 个英文文本节点（原文 → 期望译文），顺序与页面出现顺序一致 */
const NODES: readonly (readonly [string, string])[] = [
	[
		"An agent analyzes incoming issues and recommends labels, priority, assignees, and other metadata.",
		"代理会分析新收到的议题，并建议标签、优先级、指派人及其他元数据。",
	],
	["Automation level", "自动化程度"],
	[
		"Set how much control the agent has to apply changes",
		"设置代理在应用更改时拥有多少控制权",
	],
	["Full control", "完全控制"],
	[
		"Every suggestion is held for your review. Nothing is applied automatically.",
		"所有建议都会留待你复核，不会自动应用任何内容。",
	],
	["Cautious", "谨慎"],
	[
		"Only high confidence changes are applied automatically. Everything else is held for your review.",
		"只有高置信度的更改会自动应用，其余都会留待你复核。",
	],
	["Balanced", "均衡"],
	[
		"Routine, clear-cut changes are applied automatically. Anything with ambiguity is held for review.",
		"常规且明确的更改会自动应用，任何有歧义的更改都会留待复核。",
	],
	["Full automation", "完全自动化"],
	[
		"Every change is applied automatically. The agent only holds a change back if it's flagged as uncertain.",
		"所有更改都会自动应用。只有当某条更改被标记为不确定时，代理才会暂不应用。",
	],
];

/** 内部枚举值与用户内容：整节点不收录，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"ALWAYS_SUGGEST",
	"HIGH",
	"MEDIUM",
	"LOW",
	"Oppenheymu",
	"Github-i18n",
	"Copilot",
	"GitHub",
];

describe("仓库设置页的代理建议子页的实机节点边界", () => {
	it("translates every text node of the page body", () => {
		for (const [node, expected] of NODES) {
			// 两种形态都要命中：实机常带源码缩进，归一化空白后等于词典键
			for (const variant of [
				node,
				`\n        ${node}\n      `,
			]) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps the radio values and user content in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("does not treat a label and its caption as one node", () => {
		// 两条节点被引擎当作两个键，合并串不该命中——这条断言锁住「标签 / 说明分开登记」
		expect(
			translateText(
				"Full control Every suggestion is held for your review. Nothing is applied automatically.",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"Cautious Only high confidence changes are applied automatically. Everything else is held for your review.",
				view,
			),
		).toBeNull();
	});
});
