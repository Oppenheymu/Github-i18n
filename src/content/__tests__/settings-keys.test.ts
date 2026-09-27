// SSH / GPG 密钥页（/settings/keys）实机文本与属性回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，`path` 全为 /settings/keys），另有一张**未加载本扩展**的
// 原始英文整页截图用于核对条目数量与语义。与 /settings/sessions 同一形态：没有途径 B
// （Console 逐节点采集）的证据，故按「导出条目本身就是一个文本节点」登记——导出里出现
// 整句，说明它在实机里确实是一个节点（被 <a> / <strong> 拆开的句子只会以碎片形式出现）。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. SSH 说明句被两个链接切成四段（`Check out our guide to` + 链接 + `or troubleshoot`
//      + 链接），句末的 `.` 是**纯符号节点**（可翻译判定要求含拉丁字母），不收录；
//   2. GPG 说明段与 Vigilant mode 说明段是**含源码换行的单个节点**，键按 normalizeKey
//      折叠空白后的形态写（`… your GPG or S/MIME key.`）；
//   3. 删除弹窗的 `This action cannot be undone.` 由 `<strong>cannot</strong>` 切成三段，
//      译文必须能直接拼起来（`此操作` + `无法` + `被撤销。…`）；
//   4. `Added` 与它后面的日期是**两个节点**：标签在这里收录，日期节点由 global/short-date-*
//      规则译出（截图里仍显示 `Mar 29, 2026` 是 `<relative-time>` 自渲染的那一轮，
//      观察器会再翻一遍收敛）；
//   5. 属性只走精确命中、**不适用正则规则**：复选框的无障碍文案 `Enable Vigilant mode`
//      是定值，收一条；`Delete <密钥名>` 与 `Mar 29, 2026, 16:02 GMT+8` 含动态值，
//      收键必是死键，故不收（反例断言钉住）。
//
// 刻意**不收录**（下方反例断言）：
//   - 用户内容：`oppenheymu@gmail.com`、密钥名 `CanoKey Main` / `CanoKey Backup`、
//     Key ID 与 Subkeys 的值；
//   - 纯专名 / 纯缩写：`GitHub`、`Copilot`、行内徽标 `GPG`（译文必须含中文字系）；
//   - `M. Oppenheymu` / `(Oppenheymu)` / `@Oppenheymu`（头像 alt 与用户名）。
// 未命中即保留英文，这才是正确做法。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /settings/keys 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/keys",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（原文逐字录入，含实机存在的内部换行与缩进） */
const KEY_NODES: readonly string[] = [
	// —— SSH keys 区块 ——
	"SSH keys",
	"New SSH key",
	"There are no SSH keys associated with your account.",
	"Check out our guide to",
	"connecting to GitHub using SSH keys",
	"or troubleshoot",
	"common SSH problems",
	// —— GPG keys 区块 ——
	"GPG keys",
	"New GPG key",
	"This is a list of GPG keys associated with your account.\n        Remove any keys that you do not recognize.",
	"Email address:",
	"Key ID:",
	"Subkeys:",
	"Added",
	"Learn how to",
	"generate a GPG key and add it to your account",
	// —— GPG 密钥删除确认弹窗 ——
	"Are you sure you want to delete this GPG key?",
	"This action",
	"cannot",
	"be undone. This will permanently delete the GPG key, and if you’d like to use it in the future, you will need to upload it again.",
	"I understand, delete this GPG key",
	"Commits you signed with this key may become unverified after removing it.",
	"Learn more about persistent commit signature verification.",
	// —— Vigilant mode 区块 ——
	"Vigilant mode",
	"Flag unsigned commits as unverified",
	"This will include any commit attributed to your account but not signed with your GPG or\n        S/MIME key.",
	"Note that this will include your existing unsigned commits.",
	"Learn about vigilant mode",
];

/** 实机里被翻译的属性值（精确命中语义，不走规则） */
const KEY_ATTRS: readonly string[] = [
	"Enable Vigilant mode",
];

/**
 * 必须保持英文的实机节点：用户内容、纯专名 / 缩写，
 * 以及含动态值、结构上无法翻译的属性。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"oppenheymu@gmail.com",
	"CanoKey Main",
	"CanoKey Backup",
	"104E76F09F1F7A6C0",
	"C0B22DF2D692269C, AFB7AFF8546C4AA1",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
	"GitHub",
	"Copilot",
	"GPG",
	"Delete CanoKey Main",
	"Mar 29, 2026, 16:02 GMT+8",
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

describe("SSH / GPG 密钥页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of [...KEY_NODES, ...KEY_ATTRS]) {
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

	it("keeps user content, brand names and abbreviations as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the SSH empty state and its guide sentence across four nodes", () => {
		expect(translateText("SSH keys", view)).toBe(
			"SSH 密钥",
		);
		expect(translateText("New SSH key", view)).toBe(
			"新建 SSH 密钥",
		);
		expect(
			translateText(
				"There are no SSH keys associated with your account.",
				view,
			),
		).toBe("你的账户没有关联任何 SSH 密钥。");
		// 实机：`Check out our guide to <a>…</a> or troubleshoot <a>…</a>.`
		// ——两个链接把说明句切成四段，句末的 "." 单独成节点、翻不了也不收
		const rendered = renderNodes([
			"Check out our guide to",
			" ",
			"connecting to GitHub using SSH keys",
			" or troubleshoot ",
			"common SSH problems",
			".",
		]);
		expect(rendered).toBe(
			"查看我们的指南： 使用 SSH 密钥连接到 GitHub 或排查 常见 SSH 问题.",
		);
		expect(translateText(".", view)).toBeNull();
	});

	it("renders the GPG list header and the key row labels", () => {
		expect(translateText("GPG keys", view)).toBe(
			"GPG 密钥",
		);
		expect(translateText("New GPG key", view)).toBe(
			"新建 GPG 密钥",
		);
		// 说明段是**含源码换行的单个节点**，折叠空白后才等于词典键
		expect(
			translateText(
				"This is a list of GPG keys associated with your account.\n        Remove any keys that you do not recognize.",
				view,
			),
		).toBe(
			"这是与你的账户关联的 GPG 密钥列表。请移除任何你无法识别的密钥。",
		);
		// 密钥行：标签是独立节点，值是用户内容（保持英文）
		expect(
			renderNodes([
				"Email address:",
				" ",
				"oppenheymu@gmail.com",
			]),
		).toBe("电子邮箱地址： oppenheymu@gmail.com");
		expect(
			renderNodes(["Key ID:", " ", "104E76F09F1F7A6C0"]),
		).toBe("密钥 ID： 104E76F09F1F7A6C0");
		expect(
			renderNodes([
				"Subkeys:",
				" ",
				"C0B22DF2D692269C, AFB7AFF8546C4AA1",
			]),
		).toBe("子密钥： C0B22DF2D692269C, AFB7AFF8546C4AA1");
		// 「Added <日期>」：日期节点走 global/short-date-* 规则
		expect(
			renderNodes(["Added", " ", "Mar 29, 2026"]),
		).toBe("添加于 2026 年 3 月 29 日");
		// 列表下方的说明行同样被链接切段
		expect(
			renderNodes([
				"Learn how to",
				" ",
				"generate a GPG key and add it to your account",
				".",
			]),
		).toBe("了解如何 生成 GPG 密钥并将它添加到你的账户.");
	});

	it("renders the delete dialog as one readable sentence", () => {
		// 实机：`This action <strong>cannot</strong> be undone. …`
		// ——三段拼接后必须是「此操作 无法 被撤销。…」
		const rendered = renderNodes([
			"Are you sure you want to delete this GPG key?",
			"\n        ",
			"This action",
			" ",
			"cannot",
			" ",
			"be undone. This will permanently delete the GPG key, and if you’d like to use it in the future, you will need to upload it again.",
		]);
		expect(rendered).toBe(
			"你确定要删除这个 GPG 密钥吗？\n        此操作 无法 被撤销。这将永久删除该 GPG 密钥，如果你将来还想使用它，需要重新上传。",
		);
		expect(
			translateText(
				"I understand, delete this GPG key",
				view,
			),
		).toBe("我明白，删除这个 GPG 密钥");
		expect(
			translateText(
				"Commits you signed with this key may become unverified after removing it.",
				view,
			),
		).toBe(
			"使用此密钥签名的提交在移除该密钥后可能会变为未验证。",
		);
		expect(
			translateText(
				"Learn more about persistent commit signature verification.",
				view,
			),
		).toBe("详细了解持久的提交签名验证。");
	});

	it("renders the Vigilant mode block", () => {
		expect(translateText("Vigilant mode", view)).toBe(
			"警觉模式",
		);
		expect(
			translateText(
				"Flag unsigned commits as unverified",
				view,
			),
		).toBe("将未签名的提交标记为未验证");
		// 复选框的无障碍文案是定值属性，精确命中即可
		expect(
			translateText("Enable Vigilant mode", view),
		).toBe("启用警觉模式");
		// 说明段跨两行（`… your GPG or\n        S/MIME key.`），折叠空白后命中
		expect(
			translateText(
				"This will include any commit attributed to your account but not signed with your GPG or\n        S/MIME key.",
				view,
			),
		).toBe(
			"这将包括归属于你的账户、但未使用你的 GPG 或 S/MIME 密钥签名的任何提交。",
		);
		expect(
			translateText(
				"Note that this will include your existing unsigned commits.",
				view,
			),
		).toBe("请注意，这也将包括你已有的未签名提交。");
		expect(
			translateText("Learn about vigilant mode", view),
		).toBe("了解警觉模式");
	});

	it("keeps the dynamic attributes in English", () => {
		// 属性不适用正则规则：含密钥名 / 绝对时间戳的属性收键必是死键
		expect(
			translateText("Delete CanoKey Main", view),
		).toBeNull();
		expect(
			translateText("Mar 29, 2026, 16:02 GMT+8", view),
		).toBeNull();
	});
});
