// 公开资料页（/settings/profile）的 ORCID 区块实机文本与属性回归。
//
// 边界强度：**实机截图 + 实机 HTML 实证**（2026-09-27 维护者连接 ORCID 后提供）。这一区块的
// **上半部分**（H2 `ORCID iD`、`Connect your ORCID iD` 与那句 ORCID.org 说明）早已有词条，
// 连接成功后**多出**：已连接提示、显示开关、断开说明与断开按钮——本文件锁住它们。
//
// 关键边界事实：
//   1. **已连接提示的真实边界**（HTML 确证：两个值都被 `<strong>` 包住）：
//      `You have a connected ORCID iD` + <strong>标识符</strong> + `for the account` +
//      <strong>@账户</strong> + `.`
//      ——整句被切成四段以上、句号也独立成节点，故收的是两段碎片键。
//      上一轮按截图推断的「整句单节点 + 双命名组规则」因此永不命中，已随本次修正删除
//      （与 security-log 事件行同一种翻车方式：**截图看不出被元素包住的值**）；
//   2. `ORCID iD` 这个键的译文**绝不能与键同形**——2026-09 的卡死事故就是
//      `"ORCID iD": "ORCID iD"` 触发的「命中 → 写入 → 再命中」自转（见 docs/guides/development.md）；
//      本文件用一条断言把它钉成「必须含中文」；
//   3. 标识符本身（`0009-0003-4314-5082`）与 `@用户名` 是动态值 / 用户内容，保留英文。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /settings/profile 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/profile",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** ORCID 区块的实机文本节点（连接成功后渲染的那部分 + 连接前的入口） */
const ORCID_NODES: readonly string[] = [
	// 连接前 / 连接后共有的标签与入口
	"ORCID iD",
	"Connect your ORCID iD",
	// 已连接提示的两段碎片（两个值都在 <strong> 里，各自成节点）
	"You have a connected ORCID iD",
	"for the account",
	// 显示开关、断开说明与断开按钮
	"Display your ORCID iD on your GitHub profile",
	"Disconnecting your ORCID iD may affect areas of your profile where your ORCID iD is displayed.",
	"Disconnect your ORCID iD",
];

/** 必须保持英文的实机节点：动态标识符、用户内容与已删除的整句形态 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"0009-0003-4314-5082",
	"@Oppenheymu",
	"Oppenheymu",
	// 整句形态在实机并不存在（值被 <strong> 包住），对应的规则已删除：
	// 它现在必须返回 null，防止那条死规则被谁重新加回来
	"You have a connected ORCID iD 0009-0003-4314-5082 for the account @Oppenheymu.",
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

describe("公开资料页 ORCID 区块的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of ORCID_NODES) {
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

	it("keeps the identifier and the account as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("never maps the ORCID label onto itself (the 2026-09 freeze)", () => {
		// 值必须含中文字系、且不得等于键——同形会让观察器在微任务队列里无限自转
		expect(translateText("ORCID iD", view)).toBe(
			"ORCID 标识符",
		);
		expect(translateText("ORCID iD", view)).not.toBe(
			"ORCID iD",
		);
	});

	it("renders the connected notice with the boundaries the HTML proves", () => {
		// 实机：`<p class="note my-2">You have a connected ORCID iD <strong>…</strong>
		// for the account <strong>@…</strong>.</p>`
		expect(
			renderNodes([
				"\n  You have a connected ORCID iD\n  ",
				"0009-0003-4314-5082",
				"\n  for the account\n  ",
				"@Oppenheymu",
				".",
			]),
		).toBe(
			"\n  你已连接的 ORCID iD 为\n  0009-0003-4314-5082\n  ，对应账户为\n  @Oppenheymu.",
		);
		// 两段碎片键各自也成立
		expect(
			translateText("You have a connected ORCID iD", view),
		).toBe("你已连接的 ORCID iD 为");
		expect(translateText("for the account", view)).toBe(
			"，对应账户为",
		);
	});

	it("renders the toggle, the notice and the disconnect button", () => {
		expect(
			translateText(
				"Display your ORCID iD on your GitHub profile",
				view,
			),
		).toBe("在你的 GitHub 个人资料中显示你的 ORCID iD");
		expect(
			translateText(
				"Disconnecting your ORCID iD may affect areas of your profile where your ORCID iD is displayed.",
				view,
			),
		).toBe(
			"断开你的 ORCID iD 可能会影响你个人资料中显示 ORCID iD 的区域。",
		);
		expect(
			translateText("Disconnect your ORCID iD", view),
		).toBe("断开你的 ORCID iD");
		// 连接前的入口（既有词条）
		expect(
			translateText("Connect your ORCID iD", view),
		).toBe("连接你的 ORCID iD");
	});
});
