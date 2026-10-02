// 已保存回复页（/settings/replies）实机文本与属性回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，`path` 为 /settings/replies）。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. **Markdown 工具栏与附件组件是站点级组件**（同一个 Rails 组件在议题 / PR 评论框里也渲染），
//      且它的 `Write` / `Preview` 切换标签**早已在 global**，故这批标签也进 global，
//      否则会出现「编辑侧中文、格式化侧英文」的中英混杂（理由写在 canonical 的对应注释里）；
//   2. 附件类型说明被链接切成两段：链接文本 `Markdown`（纯专名，保留英文）+ `is supported`
//      ——拼接后读作「Markdown 受支持」；
//   3. 「试用其他文件」那句话里是一长串**扩展名标识符**，译文只翻句子骨架、清单原样保留；
//   4. `SavedReply` 是代码里的模型名（出现在「创建失败」文案里），保留原文。
//
// 刻意**不收录**（下方反例断言）：`Markdown`、`Copilot`、`GitHub` 等纯专名与用户名等用户内容。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /settings/replies 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/replies",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** Markdown 工具栏与附件提示（进 global 的站点级组件文案） */
const TOOLBAR_NODES: readonly string[] = [
	"Bold",
	"Italic",
	"Quote",
	"Heading",
	"Code",
	"Link",
	"Mention",
	"Reference",
	"Numbered list",
	"Unordered list",
	"Task list",
	"Add a table",
	"Add collapsible content",
	"Attach files",
	"Add files",
	"Add a comment",
	"Comment",
	"Paste, drop, or click to add files",
	"is supported",
	"Attaching documents requires write permission to this repository.",
	"Something went really wrong, and we can’t process that file.",
	"This file is hidden.",
	"Try again.",
	"Try again with another file.",
	"Try again with a file that’s not empty.",
	"We don’t support that file type.",
	"Try again with GIF, JPEG, JPG, MOV, MP4, PNG, SVG, WEBM, WEBP, BMP, C, COPILOTMD, CPP, CPUPROFILE, CS, CSS, CSV, DEBUG, DMP, DOC, DOCX, DRAWIO, EML, FODG, FODP, FODS, FODT, GZ, HTM, HTML, IPYNB, JAVA, JS, JSON, JSONC, LOG, MD, MP3, MSG, ODF, ODG, ODP, ODS, ODT, PATCH, PDB, PDF, PHP, PPTX, PY, RTF, SH, SQL, TGZ, TIF, TIFF, TS, TSV, TSX, TXT, WAV, XLS, XLSM, XLSX, XML, YAML, YML or ZIP.",
];

/** 已保存回复区块（pages/settings 专属） */
const SAVED_REPLY_NODES: readonly string[] = [
	"Add a saved reply",
	"Add saved reply",
	"Add your saved reply",
	"Create a new saved reply",
	"Select a reply",
	"Saved reply title",
	"Add a short title to your reply",
	"Saved replies are re-usable text snippets that you can use throughout GitHub comment fields.\n    Saved replies can save you time if you’re often typing similar responses.",
	"No saved replies yet.",
	"Learn more about working with saved replies",
	"There was an error creating your SavedReply.",
];

/** 必须保持英文的实机节点：纯专名与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Markdown",
	"SavedReply",
	"Copilot",
	"GitHub",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 把一段实机节点序列按 walker 的语义过一遍并拼接成页面上的那一行 */
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

describe("已保存回复页的实机节点边界", () => {
	it("translates every text node and attribute GitHub actually renders", () => {
		for (const node of [
			...TOOLBAR_NODES,
			...SAVED_REPLY_NODES,
		]) {
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

	it("keeps brand names and model names as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the markdown toolbar and the attachment hints", () => {
		expect(translateText("Bold", view)).toBe("粗体");
		expect(translateText("Italic", view)).toBe("斜体");
		expect(translateText("Quote", view)).toBe("引用");
		expect(translateText("Heading", view)).toBe("标题");
		expect(translateText("Code", view)).toBe("代码");
		expect(translateText("Link", view)).toBe("链接");
		expect(translateText("Mention", view)).toBe("提及");
		expect(translateText("Reference", view)).toBe(
			"引用他人",
		);
		expect(translateText("Numbered list", view)).toBe(
			"编号列表",
		);
		expect(translateText("Unordered list", view)).toBe(
			"无序列表",
		);
		expect(translateText("Task list", view)).toBe(
			"任务列表",
		);
		expect(translateText("Add a table", view)).toBe(
			"添加表格",
		);
		expect(translateText("Attach files", view)).toBe(
			"附加文件",
		);
		expect(
			translateText(
				"Paste, drop, or click to add files",
				view,
			),
		).toBe("粘贴、拖放或点击以添加文件");
		// 链接文本 Markdown 保留英文，只译后半句
		expect(
			renderNodes(["Markdown", " ", "is supported"]),
		).toBe("Markdown 受支持");
		expect(
			translateText(
				"Attaching documents requires write permission to this repository.",
				view,
			),
		).toBe("附加文档需要对此仓库的写入权限。");
	});

	it("renders the attachment error messages", () => {
		expect(
			translateText(
				"Something went really wrong, and we can’t process that file.",
				view,
			),
		).toBe("出了严重问题，我们无法处理该文件。");
		expect(
			translateText("This file is hidden.", view),
		).toBe("此文件已隐藏。");
		expect(translateText("Try again.", view)).toBe(
			"请重试。",
		);
		expect(
			translateText("Try again with another file.", view),
		).toBe("请改用其他文件重试。");
		expect(
			translateText(
				"Try again with a file that’s not empty.",
				view,
			),
		).toBe("请改用非空文件重试。");
		expect(
			translateText(
				"We don’t support that file type.",
				view,
			),
		).toBe("我们不支持该文件类型。");
		// 扩展名清单原样保留，只有句子骨架被翻译
		expect(
			translateText(
				"Try again with GIF, JPEG, JPG, MOV, MP4, PNG, SVG, WEBM, WEBP, BMP, C, COPILOTMD, CPP, CPUPROFILE, CS, CSS, CSV, DEBUG, DMP, DOC, DOCX, DRAWIO, EML, FODG, FODP, FODS, FODT, GZ, HTM, HTML, IPYNB, JAVA, JS, JSON, JSONC, LOG, MD, MP3, MSG, ODF, ODG, ODP, ODS, ODT, PATCH, PDB, PDF, PHP, PPTX, PY, RTF, SH, SQL, TGZ, TIF, TIFF, TS, TSV, TSX, TXT, WAV, XLS, XLSM, XLSX, XML, YAML, YML or ZIP.",
				view,
			),
		).toBe(
			"请改用 GIF、JPEG、JPG、MOV、MP4、PNG、SVG、WEBM、WEBP、BMP、C、COPILOTMD、CPP、CPUPROFILE、CS、CSS、CSV、DEBUG、DMP、DOC、DOCX、DRAWIO、EML、FODG、FODP、FODS、FODT、GZ、HTM、HTML、IPYNB、JAVA、JS、JSON、JSONC、LOG、MD、MP3、MSG、ODF、ODG、ODP、ODS、ODT、PATCH、PDB、PDF、PHP、PPTX、PY、RTF、SH、SQL、TGZ、TIF、TIFF、TS、TSV、TSX、TXT、WAV、XLS、XLSM、XLSX、XML、YAML、YML 或 ZIP 重试。",
		);
	});

	it("renders the saved-replies block", () => {
		expect(translateText("Add a saved reply", view)).toBe(
			"添加保存的回复",
		);
		expect(translateText("Add saved reply", view)).toBe(
			"添加保存的回复",
		);
		expect(
			translateText("Create a new saved reply", view),
		).toBe("创建新的保存的回复");
		expect(translateText("Select a reply", view)).toBe(
			"选择回复",
		);
		expect(translateText("Saved reply title", view)).toBe(
			"保存的回复标题",
		);
		expect(
			translateText(
				"Add a short title to your reply",
				view,
			),
		).toBe("为你的回复添加简短标题");
		expect(
			translateText(
				"Saved replies are re-usable text snippets that you can use throughout GitHub comment fields.\n    Saved replies can save you time if you’re often typing similar responses.",
				view,
			),
		).toBe(
			"保存的回复是可重复使用的文本片段，你可以在 GitHub 的各个评论框中直接使用。如果你经常需要输入类似的回复，保存的回复可以帮你节省时间。",
		);
		expect(
			translateText("No saved replies yet.", view),
		).toBe("还没有保存的回复。");
		expect(
			translateText(
				"Learn more about working with saved replies",
				view,
			),
		).toBe("详细了解如何使用保存的回复");
		// 模型名 SavedReply 保留原文
		expect(
			translateText(
				"There was an error creating your SavedReply.",
				view,
			),
		).toBe("创建你的 SavedReply 时出错。");
	});
});
