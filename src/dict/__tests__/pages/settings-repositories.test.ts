// 仓库默认设置页（/settings/repositories）实机文本与属性回归。
//
// 边界强度：**实机截图 + 同类组件的既有实测**。这一页维护者只提供了整页截图
// （2026-09-27），而截图本身不足以定节点边界（换行、缩进、纯符号节点都看不出来），
// 故凡截图看不出边界的地方，一律按本仓**已实测过的同类形态**判断，并逐条写上判断依据：
//   1. 两段说明都在链接处断开（截图里「Learn more about default branches.」与
//      「commit comments」都是链接色）——说明段被 `<a>` 切开的形态在 /settings/emails、
//      /settings/keys 等页已多次实测；
//   2. 下拉是 Rails 的 `<details><summary>` select-menu：按 /settings/appearance 的实测
//      （`Selected theme:` + 主题名两个节点），**标签含冒号、当前值各成一个文本节点**，
//      故这里收 `Commit comments:` + `Enabled by default` / `Disabled by default` 三条。
//      该下拉的 aria-label 是拼好的整句（`Commit comments: Enabled by default`），
//      属属性、不适用规则，只能保留英文（下方反例断言钉住）。
//
// 刻意**不收录**（下方反例断言）：
//   - 输入框里的默认分支名（截图里是 `main`）：文本输入框的 value 是用户内容，
//     引擎本来也只翻按钮类 `<input>` 的 value；
//   - 纯专名 / 缩写：`GitHub`、`“master”`。
// 未命中即保留英文，这才是正确做法。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /settings/repositories 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/repositories",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（截图逐字录入；边界依据见文件头注释） */
const REPOSITORY_NODES: readonly string[] = [
	// —— Repository default branch 区块 ——
	"Repository default branch",
	"Choose the default branch for your new personal repositories. You might want to change the default name due to different workflows, or because your integrations still require “master” as the default branch name. You can always change the default branch name on individual repositories.",
	"Learn more about default branches.",
	"Update",
	// —— Commit comments 区块 ——
	"Commit comments",
	// 说明段被链接切成三段
	"Choose whether",
	"commit comments",
	"are enabled or disabled by default for repositories you own. Individual repositories can override this default. Existing commit comments are not affected by this setting and will remain viewable, editable, and deletable.",
	// 下拉：标签 + 两个选项值
	"Commit comments:",
	"Enabled by default",
	"Disabled by default",
];

/**
 * 必须保持英文的实机节点：用户内容与纯专名，
 * 以及拼好的、含动态值的 select-menu aria-label。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 输入框里的默认分支名（文本输入框的 value 是用户内容）
	"main",
	// 下拉的 aria-label：属性不适用规则，整句拼好也翻不了
	"Commit comments: Enabled by default",
	"GitHub",
	"“master”",
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

describe("仓库默认设置页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of REPOSITORY_NODES) {
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

	it("keeps user content, brand names and dynamic attributes as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the default-branch blurb across its link boundary", () => {
		// 实机：`… on individual repositories. <a>Learn more about default branches.</a>`
		const rendered = renderNodes([
			"Choose the default branch for your new personal repositories. You might want to change the default name due to different workflows, or because your integrations still require “master” as the default branch name. You can always change the default branch name on individual repositories.",
			" ",
			"Learn more about default branches.",
		]);
		expect(rendered).toBe(
			"为你的新个人仓库选择默认分支。由于不同的工作流，或因为你的集成仍需要将 “master” 作为默认分支名，你可能想更改默认名称。你随时可以在单个仓库上更改默认分支名。 详细了解默认分支。",
		);
		expect(
			translateText("Repository default branch", view),
		).toBe("仓库默认分支");
		expect(translateText("Update", view)).toBe("更新");
	});

	it("renders the commit-comments blurb across its three nodes", () => {
		// 实机：`Choose whether <a>commit comments</a> are enabled or disabled by default for …`
		// ——链接把整句切成三段，链接近旁的 `/settings/repo-settings` 同键译文为「提交评论」
		const rendered = renderNodes([
			"Choose whether",
			" ",
			"commit comments",
			" ",
			"are enabled or disabled by default for repositories you own. Individual repositories can override this default. Existing commit comments are not affected by this setting and will remain viewable, editable, and deletable.",
		]);
		expect(rendered).toBe(
			"选择是否 提交评论 在你拥有的仓库中默认启用或禁用。各个仓库可以覆盖此默认设置。现有的提交评论不受此设置影响，仍可查看、编辑和删除。",
		);
		// 标题与链接是同义但大小写不同的两个键，两条都译作「提交评论」
		expect(translateText("Commit comments", view)).toBe(
			"提交评论",
		);
	});

	it("renders the select-menu label and its two option values", () => {
		// 实机（Rail 的 <details><summary>）：`Commit comments:` + 当前值
		expect(
			renderNodes([
				"Commit comments:",
				" ",
				"Enabled by default",
			]),
		).toBe("提交评论： 默认启用");
		expect(
			renderNodes([
				"Commit comments:",
				" ",
				"Disabled by default",
			]),
		).toBe("提交评论： 默认禁用");
	});
});
