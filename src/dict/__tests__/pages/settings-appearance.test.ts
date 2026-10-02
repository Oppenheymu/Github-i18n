// 外观设置页（/settings/appearance）实机文本节点回归。
//
// 为什么单独锁这一页：本页有两个 Rails `<details><summary>` 下拉与一个分段控件，
// 「当前值」本身就是独立文本节点（`Sync with system` / `Light default` / `Off` …），
// 另有若干主题名同时充当按钮文案与选项文案。引擎是「整节点精确匹配」，
// 只要边界对不上就静默保留英文，看代码完全看不出来。这里的值按实机渲染文本录入，
// 是「按真实边界收录」这条约定的回归保护。
//
// 已知未覆盖（留待实机确认后再补，勿凭猜测登记死键）：
//   - 下拉按钮的 `title` / `aria-label`（实机形如 `Theme mode: Sync with system`）；
//   - emoji 肤色 `select` 若渲染成 Primer 的自定义弹层而非原生 `<option>`，
//     选项文本可能带额外前后缀。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /settings 子树命中的模块视图（pages/settings + pages/repo + global） */
const view = buildView(
	"/settings/appearance",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 外观页的实机文本节点（原文逐字录入，不做 trim——引擎自己会归一空白） */
const APPEARANCE_NODES: readonly string[] = [
	"\n        Theme preferences\n      ",
	"\n        Choose how GitHub looks to you. Select a single theme, or sync with your system and automatically switch between day and night themes. Selections are applied immediately and saved automatically.\n      ",
	"Theme mode",
	// 下拉按钮的当前值（<details><summary>）：跟随系统 / 单主题两个模式
	"Sync with system",
	"Single theme",
	"GitHub theme will match your system active settings",
	// 浅色主题区
	"Light theme",
	"This theme will be active when your system is set to “light mode”",
	"Light default",
	"Light protanopia and deuteranopia",
	"Light tritanopia",
	// 深色主题区
	"Dark theme",
	"This theme will be active when your system is set to “dark mode”",
	"Dark default",
	"Dark protanopia and deuteranopia",
	"Dark tritanopia",
	"Soft dark",
	// 选中态徽标（与主题名相邻的独立节点，以冒号收尾）
	"Selected theme:",
	// 对比度分段控件
	"Contrast",
	"Increase contrast",
	"Enable high contrast for light or dark mode (or both) based on your system settings",
	"Light mode",
	"Dark mode",
	"Off",
	"On",
	// 表情符号肤色偏好
	"Preferred default emoji skin tone",
	"👋 Neutral",
	"👋🏻 Light Skin Tone",
	"👋🏼 Medium-Light Skin Tone",
	"👋🏽 Medium Skin Tone",
	"👋🏾 Medium-Dark Skin Tone",
	"👋🏿 Dark Skin Tone",
	// 制表符宽度偏好
	"Tab size preference",
	"Choose the number of spaces a tab is equal to when rendering code",
	"4 (Default)",
	// Markdown 编辑器字体偏好
	"Markdown editor font preference",
	"Font preference for plain text editors that support Markdown styling (e.g. pull request and issue descriptions, comments.)",
	"Use a fixed-width (monospace) font when editing Markdown",
];

describe("外观设置页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of APPEARANCE_NODES) {
			const translated = translateText(node, view);
			expect(
				translated,
				`未命中：${JSON.stringify(node)}`,
			).not.toBeNull();
			// 译文必须是中文（防「收录了键但值还是英文」这类静默失效）
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("normalizes whitespace before lookup", () => {
		// 分段控件的两态文案在实机里可能带源码缩进与换行；查词前会 trim + 折叠空白
		// （译文本身由 walker 负责拼接首尾空白，translateText 只返回译文）
		expect(translateText("\n    Off\n  ", view)).toBe(
			"关闭",
		);
		expect(translateText(" On ", view)).toBe("开启");
	});

	it("keeps the emoji prefix and its space in skin tone options", () => {
		// 肤色选项是 emoji + 空格 + 名称；译文不得吃掉 emoji 或那个空格
		expect(
			translateText(
				"\n      👋🏽 Medium Skin Tone\n    ",
				view,
			),
		).toBe("👋🏽 中等肤色");
		expect(translateText("👋 Neutral", view)).toBe(
			"👋 中性",
		);
	});

	it("keeps the two theme-mode sections apart", () => {
		// 浅色 / 深色两句除引号内容外完全同形，必须各自成条、不得互相顶替
		expect(
			translateText(
				"This theme will be active when your system is set to “light mode”",
				view,
			),
		).toBe("当你的系统设为「浅色模式」时，将使用此主题");
		expect(
			translateText(
				"This theme will be active when your system is set to “dark mode”",
				view,
			),
		).toBe("当你的系统设为「深色模式」时，将使用此主题");
	});
});
