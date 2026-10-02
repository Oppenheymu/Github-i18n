// 教育权益页（/settings/education/benefits）实机文本节点回归。
//
// 边界强度：**实机 HTML 实证**（维护者 2026-09 提供，逐字照抄节点原文）。本页的实证事实：
// 说明段落是**跨行的单个文本节点**（H2 与卡片说明句同理），归一空白后才等于词典键；
// 按钮文案在 `<span class="Button-label">` 里，自身就是完整节点。页头「GitHub Education」
// 仅有截图来源（该段 HTML 未包含），首次实机复验时留意。
//
// 刻意不登记：
//   - 「Learn more」：实机已渲染为「了解更多」，由 global 的既有词条覆盖；
//   - 「GitHub Sponsors」这类纯专名若出现在本页，按「不收录即保留英文」处理。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /settings/education/benefits 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/education/benefits",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 教育权益页的实机文本节点（截图逐行誊录，原文逐字录入，不做 trim） */
const EDUCATION_NODES: readonly string[] = [
	"GitHub Education",
	"Free GitHub developer resources for students and teachers",
	"Get Copilot for free, 180 monthly Codespaces hours for cloud coding, unlimited private repositories with GitHub Pro or Team, and dozens of premium tools in the Student Developer Pack.",
	"Education Benefits",
	"Complete a teacher or student application to unlock tools and resources for your educational journey.",
	"Start an application",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("教育权益页的实机节点边界", () => {
	it("translates every text node the screenshot shows", () => {
		for (const node of EDUCATION_NODES) {
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

	it("matches the real node boundaries taken from the live HTML", () => {
		// 逐字照抄实机 HTML 的文本节点：H2 与两段说明都带源码缩进，其中说明段落
		// **跨三行**——折叠空白后必须仍等于词典键，这就是「键按 normalizeKey 后的形态收」
		expect(
			translateText(
				"\n      Free GitHub developer resources for students and teachers\n    ",
				view,
			),
		).toBe("面向学生和教师的免费 GitHub 开发者资源");
		expect(
			translateText(
				"\n      Get Copilot for free, 180 monthly Codespaces hours for cloud coding,\n      unlimited private repositories with GitHub Pro or Team, and dozens of\n      premium tools in the Student Developer Pack.\n    ",
				view,
			),
		).toBe(
			"免费使用 Copilot、每月 180 小时的 Codespaces 云端编码时长、GitHub Pro 或 Team 的不限私有仓库，以及学生开发者包中的数十种高级工具。",
		);
		expect(
			translateText(
				"\n            Complete a teacher or student application to unlock tools and\n            resources for your educational journey.\n        ",
				view,
			),
		).toBe(
			"完成教师或学生申请，解锁学习旅程所需的工具与资源。",
		);
		expect(translateText("Education Benefits", view)).toBe(
			"教育权益",
		);
		expect(
			translateText("Start an application", view),
		).toBe("开始申请");
	});

	it("keeps the card heading apart from the settings sidebar item", () => {
		// 卡片标题是大写 B 的「Education Benefits」，设置侧栏是小写 b 的「Education benefits」：
		// 两个键都要有译文，且同译（同一个词在界面上不该两副面孔）
		expect(translateText("Education Benefits", view)).toBe(
			"教育权益",
		);
		expect(translateText("Education benefits", view)).toBe(
			"教育权益",
		);
	});

	it("renders the benefits card copy", () => {
		expect(
			translateText(
				"Free GitHub developer resources for students and teachers",
				view,
			),
		).toBe("面向学生和教师的免费 GitHub 开发者资源");
		expect(
			translateText(
				"Complete a teacher or student application to unlock tools and resources for your educational journey.",
				view,
			),
		).toBe(
			"完成教师或学生申请，解锁学习旅程所需的工具与资源。",
		);
		expect(
			translateText("Start an application", view),
		).toBe("开始申请");
	});

	it("reuses the existing entry for the More button", () => {
		// 截图里的按钮「了解更多」来自 global 的「Learn more」，不是本页专属词条，
		// 故不重复登记；顺便钉住「More」是另一个键（译「更多」），别混为一谈
		expect(translateText("Learn more", view)).toBe(
			"了解更多",
		);
		expect(translateText("More", view)).toBe("更多");
	});
});
