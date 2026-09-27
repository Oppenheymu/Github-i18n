// 公开资料页（/settings/profile）的 ORCID 区块实机文本与属性回归。
//
// 边界强度：**实机截图**（2026-09-27 维护者连接 ORCID 后提供）。这一区块的**上半部分**
// （H2 `ORCID iD`、`Connect your ORCID iD` 与那句 ORCID.org 说明）早已有词条，
// 连接成功后**多出三条**：已连接提示、显示开关、断开说明与断开按钮——本文件锁住它们。
//
// 关键边界事实：
//   1. `You have a connected ORCID iD <标识符> for the account <账户>.` 里**两个值都是动态的**，
//      走 `settings/orcid-connected-notice` 规则（两个命名组、按原样带回）；截图里两个值都是
//      普通灰色文本（不是链接），故按单节点整句处理；
//   2. `ORCID iD` 这个键的译文**绝不能与键同形**——2026-09 的卡死事故就是
//      `"ORCID iD": "ORCID iD"` 触发的「命中 → 写入 → 再命中」自转（见 docs/guides/development.md）；
//      本文件用一条断言把它钉成「必须含中文」；
//   3. 标识符本身（`0009-0003-4314-5082`）与 `@用户名` 是动态值 / 用户内容，保留英文。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

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
	// 连接成功后新增的四段
	"You have a connected ORCID iD 0009-0003-4314-5082 for the account @Oppenheymu.",
	"Display your ORCID iD on your GitHub profile",
	"Disconnecting your ORCID iD may affect areas of your profile where your ORCID iD is displayed.",
	"Disconnect your ORCID iD",
];

/** 必须保持英文的实机节点：动态标识符与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"0009-0003-4314-5082",
	"@Oppenheymu",
	"Oppenheymu",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
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

	it("renders the connected notice through the dynamic rule", () => {
		expect(
			translateText(
				"You have a connected ORCID iD 0009-0003-4314-5082 for the account @Oppenheymu.",
				view,
			),
		).toBe(
			"你已连接 ORCID iD 0009-0003-4314-5082，对应账户为 @Oppenheymu。",
		);
		// 换一个标识符与账户同样成立
		expect(
			translateText(
				"You have a connected ORCID iD 0000-0002-1825-0097 for the account @octocat.",
				view,
			),
		).toBe(
			"你已连接 ORCID iD 0000-0002-1825-0097，对应账户为 @octocat。",
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
