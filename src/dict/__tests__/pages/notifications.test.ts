// 通知页（/notifications）的实机节点回归。
//
// 证据来源：维护者 2026-10-25 贴的 /notifications 实机截图——页面左下菜单四条
// （Notification settings / Watched repositories / Subscriptions / Manage notifications）
// 留英文。截图只含菜单区，节点边界以可见文本为准。
//
// 模块是本次新建的（此前 /notifications 完全没有专属模块，页面靠 global 裸奔；
// profile 路由的保留名单也把 notifications 排除在外），四条全登记在
// pages/notifications；Subscriptions 与 pages/settings、pages/settings-billing
// 同键同译，watch 族术语沿用 global（zh「关注」/ ja「ウォッチ」）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const zh = dictForLocale("zh-CN");

/** 通知页命中的模块视图（pages/notifications + global） */
const view = buildView(
	"/notifications",
	zh,
	new Map(Object.entries(dictCore.aliases)),
);

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把实机节点序列按引擎语义拼回整句（translateText 未命中原样保留，
 * 首尾空白由引擎保留）。专有名词与纯符号节点在断言里以「原样保留」出现，
 * 与实机的排除 / 未命中行为等价。
 */
function renderNodes(
	nodes: readonly string[],
	target: ReturnType<typeof buildView> = view,
): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, target);
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

describe("通知页的路由与菜单词条", () => {
	it("matches /notifications into the notifications module", () => {
		expect(
			matchModules("/notifications", zh.modules)
				.map((module) => module.name)
				.indexOf("pages/notifications"),
		).toBeGreaterThanOrEqual(0);
	});

	it("translates every menu entry the screenshot shows", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Notification settings", "通知设置"],
			["Watched repositories", "已关注的仓库"],
			["Subscriptions", "订阅"],
			["Manage notifications", "管理通知"],
		];
		for (const [node, expected] of NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps the unread badge and the caret glyph untranslated", () => {
		// 「Watched repositories」右侧的未读角标（数字）与菜单底部的 ▼ 展开箭头
		// 都是独立节点，数字 / 纯符号按纪律不收录
		expect(translateText("1", view)).toBeNull();
	});

	it("shares the settings module's translation for Subscriptions", () => {
		// 同键同译：settings 页视图下词条一致，不构成同键异译
		const settings = buildView(
			"/settings/subscriptions",
			zh,
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Subscriptions", settings)).toBe(
			"订阅",
		);
	});

	it("translates the ProTip footer across its two sibling nodes", () => {
		// 页底 ProTip（维护者 2026-10-25 同页实机 HTML）：<strong>ProTip!</strong>
		// 与说明句是两个兄弟节点，各自整节点命中；实机节点带源码缩进空白。
		// ProTip! 与 search / settings 的同名键同译（小贴士！）
		expect(translateText("ProTip!", view)).toBe("小贴士！");
		expect(
			translateText(
				"\n        Create custom filters to quickly access your most important notifications.\n      ",
				view,
			),
		).toBe("创建自定义筛选器，快速访问你最重要的通知。");
	});

	it("has japanese templates for every entry", () => {
		const japanese = buildView(
			"/notifications",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText("Notification settings", japanese),
		).toBe("通知の設定");
		expect(
			translateText("Watched repositories", japanese),
		).toBe("ウォッチ中のリポジトリ");
		expect(translateText("Subscriptions", japanese)).toBe(
			"サブスクリプション",
		);
		expect(
			translateText("Manage notifications", japanese),
		).toBe("通知を管理");
		expect(translateText("ProTip!", japanese)).toBe(
			"プロのヒント！",
		);
		expect(
			translateText(
				"Create custom filters to quickly access your most important notifications.",
				japanese,
			),
		).toBe(
			"カスタムフィルターを作成して、最も重要な通知にすばやくアクセスしましょう。",
		);
	});

	it("translates the filter popover labels the screenshot shows", () => {
		// 筛选弹层（维护者 2026-10-31 实机截图）：Select by 按钮与组标题、四个
		// 筛选档位。Type 同形异义（settings 正文读作「类型」，本页组标题恰也是
		// 「类型」）；Read / Unread 是已读状态语义，模块路由收窄了撞车面
		const NODES: readonly (readonly [string, string])[] = [
			["Select by", "选择方式"],
			["Type", "类型"],
			["Others", "其他"],
			["Bots", "机器人"],
			["Read", "已读"],
			["Unread", "未读"],
		];
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("renders the five-node shortcut hint as one readable sentence", () => {
		// 弹层底部的快捷键提示（维护者 2026-10-31 实机 HTML）：**五段结构**
		// `You can press ` + <kbd>Shift</kbd> + ` + ` + <kbd>S</kbd> +
		// ` to open this menu.`——applyKbdLabel 只管三段，两个端点碎片各自查表；
		// kbd 内文本在实机由排除清单保护（此处它们无词条，等价），` + ` 是
		// 纯符号节点翻不了，空白由引擎保留
		expect(
			renderNodes([
				"You can press ",
				"Shift",
				" + ",
				"S",
				" to open this menu.",
			]),
		).toBe("你可以按 Shift + S 打开此菜单。");
	});

	it("renders the protip continuation across its five nodes", () => {
		// <strong>ProTip!</strong> 之后的说明句被 iOS / Android 两个链接拆成
		// `Triage …for ` + <a>iOS</a> + ` or ` + <a>Android</a> + `.` 五个节点
		// （维护者 2026-10-31 实机 HTML）：专有名词与独立句号节点保留英文，
		// or 是链接间的独立节点（裸词撞车面由模块路由收窄）
		expect(
			renderNodes([
				"\n        Triage notifications on the go with GitHub Mobile for ",
				"iOS",
				" or ",
				"Android",
				".",
			]),
		).toBe(
			"\n        随时随地用 GitHub Mobile 分类处理通知，支持 iOS 或 Android.",
		);
	});

	it("has japanese templates for the new keys too", () => {
		const japanese = buildView(
			"/notifications",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Select by", japanese)).toBe(
			"選択",
		);
		expect(translateText("Type", japanese)).toBe("種類");
		expect(translateText("Others", japanese)).toBe(
			"その他",
		);
		expect(translateText("Bots", japanese)).toBe("ボット");
		expect(translateText("Read", japanese)).toBe("既読");
		expect(translateText("Unread", japanese)).toBe("未読");
		// ja 语序：端点碎片承载「開くには…を押します」框架，按键居中
		expect(
			renderNodes(
				[
					"You can press ",
					"Shift",
					" + ",
					"S",
					" to open this menu.",
				],
				japanese,
			),
		).toBe("このメニューを開くには Shift + S を押します。");
		expect(
			translateText(
				"Triage notifications on the go with GitHub Mobile for",
				japanese,
			),
		).toBe(
			"いつでもどこでも GitHub Mobile で通知をトリアージ、",
		);
		expect(translateText("or", japanese)).toBe("または");
	});
});
