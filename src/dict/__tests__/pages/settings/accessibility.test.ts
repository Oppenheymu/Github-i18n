// 辅助功能设置页（/settings/accessibility）实机文本节点回归。
//
// 为什么单独锁这一页：
//   1. 本页有三个长说明句在实机里被拆成多个节点（链接 / `<kbd>` / `sr-only` 各自成节点），
//      整句键永远不会命中——必须按节点逐片收录，且片段译文要能直接拼接。这里把
//      **实机真实节点边界**（取自页面 Elements 面板的 outerHTML）逐条锁住；
//   2. 片段里有按键名与符号（`Ctrl` `⇧` `V` `Alt` `↑` `g` `n` `?`），译文里绝不能
//      把它们译掉（用户显式要求「按键千万别翻译」），故拼接结果也要断言；
//   3. 本页保存按钮随区块不同（keyboard shortcut / motion / content / hovercard /
//      editor / assistive technology hint），截图上确认过的按钮文案逐条锁住。
//
// 已知未覆盖（留待实机确认后再补，勿凭猜测登记死键）：
//   - 页面标题键 `Accessibility settings`：截图未包含标题栏，实机若渲染成
//     `Accessibility`（与侧边栏同键）则本条不生效，届时按实机文本改键；
//   - 未翻译节点 `g` / `n` / `?` / `Alt` / `↑` 与 `sr-only` 里的 `alt up`：本身
//     就是英文原样保留，不收录、也不断言。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /settings 子树命中的模块视图（pages/settings + pages/repo + global） */
const view = buildView(
	"/settings/accessibility",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 辅助功能页的实机文本节点（原文逐字录入，不做 trim——引擎自己会归一空白） */
const ACCESSIBILITY_NODES: readonly string[] = [
	"General",
	"Keyboard shortcuts",
	"Character keys",
	"Motion",
	"Autoplay animated images",
	"Select whether animated images should play automatically.",
	"Follow system",
	"Adopts your system preference for reduced motion",
	"Enabled",
	"Automatically plays animated images",
	"Disabled",
	"Prevents animated images from playing automatically",
	"Content",
	"Link underlines",
	"Toggle the visibility of underlines on links that are adjacent to text.",
	"Hide link underlines",
	"Show link underlines",
	"Hovercards",
	"Hovercards preview information about other parts of GitHub.",
	// 实机里「Hovercards」是链接（指向 docs 的 hover cards 文档），链接后的说明文本是独立节点
	" preview information about other parts of GitHub.",
	"Show hovercards",
	"Editor settings",
	"URL paste behavior",
	"Formatted link",
	"Pasting a URL while having text selected will format to a Markdown link",
	"Plain text",
	"Pasting a URL while having text selected will replace the text",
	"Assistive technology hints",
	"Add or remove instructions for how to operate complex controls.",
	"Enable screen reader hint",
	"Disable screen reader hint",
	// 各区块的保存按钮（截图上确认过的四条 + 同一模板的另外两条）
	"Save keyboard shortcut preferences",
	"Save motion preferences",
	"Save content preferences",
	"Save hovercard preferences",
	"Save editor settings",
	"Save assistive technology hint preferences",
];

/**
 * 三个长说明句在实机里被拆成的节点序列（取自页面 Elements 面板的 outerHTML，
 * 节点内文本逐字照抄，含 `\n` 换行与不换行空格 `\u00a0`）。
 * `<kbd>` 与配置了 `aria-hidden` 的符号节点原样保留英文，故这里不登记、也不断言。
 */
const CHARACTER_KEYS_NODES: readonly string[] = [
	"\n      Enable ",
	"GitHub shortcuts",
	" that don't use modifier keys in their activation. For example, the ",
	"g",
	"n",
	" and ",
	" shortcut to navigate notifications, or ",
	"question mark",
	"?",
	" to view context relevant shortcuts.\n\n  ",
];

const HOVERCARD_NODES: readonly string[] = [
	"\n      Enable previewing link content via mouse hover or keyboard focus before navigation. Move focus to hovercard content using ",
	"alt up",
	"Alt",
	"↑",
	".\n\n  ",
];

const URL_PASTE_NODES: readonly string[] = [
	"\n    Select if URLs should be formatted on paste. You can use ",
	"control shift and V",
	"Ctrl",
	" ",
	"⇧",
	" ",
	"V",
	"\u00a0to paste a link in the opposite way.\n  ",
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

describe("辅助功能设置页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of ACCESSIBILITY_NODES) {
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

	it("renders the split character-keys sentence with key names intact", () => {
		// 实机里整句被拆成 9 个节点（链接 + <kbd>g</kbd><kbd>n</kbd> + sr-only + <kbd>?</kbd>），
		// 拼接后必须是通顺中文，且 g / n / ? 原样保留
		const rendered = renderNodes(CHARACTER_KEYS_NODES);
		// 逐字锁住拼接结果（含节点自带空白造成的一处双空格：<kbd> 之间是 " and " 节点）
		expect(rendered).toContain(
			"启用 GitHub 快捷键 这些快捷键在激活时不使用修饰键。例如  gn 用  快捷键跳转到通知，或 question mark? 查看与当前上下文相关的快捷键。",
		);
		for (const raw of ["g", "n", "?", "GitHub"]) {
			expect(rendered).toContain(raw);
		}
		// 按键节点（sr-only 的 question mark 与四个 <kbd>）保留英文，不属于漏翻；
		// 其余每个「文本节点」都必须真的命中了词典。
		const keyNodes = new Set([
			"question mark",
			"g",
			"n",
			"?",
		]);
		for (const node of CHARACTER_KEYS_NODES) {
			if (keyNodes.has(node)) continue;
			expect(
				translateText(node, view),
				`未命中：${JSON.stringify(node)}`,
			).not.toBeNull();
		}
	});

	it("renders the split hovercard sentence with the Alt ↑ keys intact", () => {
		const rendered = renderNodes(HOVERCARD_NODES);
		// 末段 "." 是纯符号节点，可翻译判定（必须含拉丁字母）会跳过它，故保留英文句点
		expect(rendered).toContain("按 alt upAlt↑.");
		expect(rendered).toContain(
			"启用后，可在导航前通过鼠标悬停或键盘聚焦预览链接内容。",
		);
		// sr-only 的 `alt up` 与两个 <kbd> 节点（Alt / ↑）保留英文
		expect(rendered).toContain("alt up");
		expect(
			translateText("Alt", view),
			"<kbd>Alt</kbd> 不应被翻译",
		).toBeNull();
		expect(
			translateText("↑", view),
			"<kbd>↑</kbd> 不应被翻译",
		).toBeNull();
	});

	it("renders the split URL paste sentence with Ctrl ⇧ V intact", () => {
		const rendered = renderNodes(URL_PASTE_NODES);
		expect(rendered).toContain("Ctrl ⇧ V");
		expect(rendered).toContain(
			"选择粘贴 URL 时是否进行格式化。你可以使用",
		);
		expect(rendered).toContain("以相反的方式粘贴链接。");
		expect(rendered).toContain("control shift and V");
	});

	it("renders the hovercards blurb with the linked heading", () => {
		// 实机里「Hovercards」是指向 docs 的链接，句子的其余部分是独立节点
		const rendered = renderNodes([
			"\n      ",
			"Hovercards",
			" preview information about other parts of GitHub.\n    ",
		]);
		expect(rendered).toContain(
			"悬停卡片 可预览 GitHub 其他部分的信息。",
		);
	});

	it("keeps the two URL paste options apart", () => {
		// 两句只差一个动词（format / replace），必须各自成条
		expect(
			translateText(
				"Pasting a URL while having text selected will format to a Markdown link",
				view,
			),
		).toBe(
			"在选中文本时粘贴 URL，会格式化为 Markdown 链接",
		);
		expect(
			translateText(
				"Pasting a URL while having text selected will replace the text",
				view,
			),
		).toBe("在选中文本时粘贴 URL，会替换所选文本");
	});

	it("keeps the motion toggle options apart", () => {
		// 自动播放动画图片的两态：启用 / 禁用，说明句不得互相顶替
		expect(translateText("Enabled", view)).toBe("启用");
		expect(translateText("Disabled", view)).toBe("禁用");
		expect(
			translateText(
				"Automatically plays animated images",
				view,
			),
		).toBe("自动播放动画图片");
		expect(
			translateText(
				"Prevents animated images from playing automatically",
				view,
			),
		).toBe("阻止动画图片自动播放");
	});

	it("keeps the hide/show underline options apart", () => {
		expect(
			translateText("Hide link underlines", view),
		).toBe("隐藏链接下划线");
		expect(
			translateText("Show link underlines", view),
		).toBe("显示链接下划线");
	});

	it("keeps the screen reader hint options apart", () => {
		expect(
			translateText("Enable screen reader hint", view),
		).toBe("启用屏幕阅读器提示");
		expect(
			translateText("Disable screen reader hint", view),
		).toBe("禁用屏幕阅读器提示");
	});
});
