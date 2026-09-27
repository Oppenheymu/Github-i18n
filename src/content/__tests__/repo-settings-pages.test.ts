// 仓库设置页的 Pages 子页（/owner/repo/settings/pages）实机文本回归。
//
// 边界强度：**实机 outerHTML 实证**（2026-09-27 维护者提供的 classic 版页面片段）。
// 该页是本模块里被链接拆节点最多的一页，登记时逐段对齐：
//   ① 开头说明句被 `<a>GitHub Pages</a>` 切成「链接 + 后半句」，只收后半句（产品名不译）；
//   ②「当前已禁用」那段是「整句 + 链接 + 纯符号尾节点 `.`」（纯符号不收）；
//   ③ `Use a suggested workflow, <a…>browse all workflows</a>, or <a…>create your own</a>.`
//      被拆成四段，逐段登记后拼接可读——段与段之间实机自带空格，译文**不带首尾空格**；
//   ④ 部署后提示是「整句 + `View workflow runs.` 链接」两段；
//   ⑤ 选择分支 / 文件夹两个弹层各有标题与 `aria-label`（属性只走精确命中，故各收一条）。
//
// 与账户级「已验证域名页」（/settings/pages，见 settings-pages.test.ts）**不是同一页**：
// 那条路由只命中 pages/settings + global，本页命中 pages/repo-settings，两边的键各自独立。
// `Visibility` 与 `Start free for 30 days` 在账户级已有同译，本模块为同一页面另收一份，
// 译文必须保持一致。
//
// 刻意**不收录**（下方反例断言）：产品名 `GitHub Pages` / `GitHub Actions` /
// `GitHub Enterprise` / `GitHub`，分支名 `main` 与目录路径 `/docs`，以及用户内容
// `Oppenheymu` / `Github-i18n`。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Oppenheymu/Github-i18n/settings/pages 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/pages",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机片段里的节点（原文 → 期望译文），顺序与页面出现顺序一致 */
const NODES: readonly (readonly [string, string])[] = [
	// —— 页头说明句的后半段（前半段是 GitHub Pages 链接）——
	[
		"is designed to host your personal, organization, or project pages from a GitHub repository.",
		"用于托管来自 GitHub 仓库的个人、组织或项目页面。",
	],
	// —— 构建与部署 ——
	["Build and deployment", "构建与部署"],
	["Source", "来源"],
	["Deploy from a branch", "从分支部署"],
	[
		"Best for using frameworks and customizing your build process",
		"最适合使用各类框架并自定义构建过程",
	],
	["Classic Pages experience", "经典版 Pages 体验"],
	// 保存成功指示图标的 aria-label
	["Page source has been saved", "页面源已保存"],
	[
		"GitHub Pages is currently disabled. Select a source below to enable GitHub Pages for this repository.",
		"GitHub Pages 当前已禁用。请在下方选择来源，为此仓库启用 GitHub Pages。",
	],
	[
		"Learn more about configuring the publishing source for your site",
		"进一步了解如何为你的站点配置发布源",
	],
	// 选择分支 / 文件夹弹层（标题 + 列表 aria-label）
	["Select branch", "选择分支"],
	["Select branch options", "选择分支选项"],
	["Select folder", "选择文件夹"],
	["Select folder options", "选择文件夹选项"],
	["/ (root)", "/（根目录）"],
	// —— 构建方式为 GitHub Actions 时才显示的提示（实机是 hidden 区块，切换后可见）——
	["Use a suggested workflow,", "使用建议的工作流，"],
	["browse all workflows", "浏览所有工作流"],
	[", or", "，或"],
	["create your own", "创建你自己的"],
	[
		"Workflow details will appear here once your site has been deployed.",
		"站点部署完成后，工作流详情会显示在这里。",
	],
	["View workflow runs.", "查看工作流运行。"],
	// —— 可见性（企业版）——
	["Visibility", "可见性"],
	[
		"With a GitHub Enterprise account, you can restrict access to your GitHub Pages site by publishing it privately. You can use privately published sites to share your internal documentation or knowledge base with members of your enterprise. You can try GitHub Enterprise risk-free for 30 days.",
		"使用 GitHub Enterprise 账户，你可以将 GitHub Pages 站点私有发布，从而限制访问。你可以用私有发布的站点与企业成员共享内部文档或知识库。你可以免费试用 GitHub Enterprise 30 天，无需承担风险。",
	],
	[
		"Learn more about the visibility of your GitHub Pages site.",
		"进一步了解 GitHub Pages 站点的可见性。",
	],
	["Start free for 30 days", "免费试用 30 天"],
];

/** 产品名、分支名、目录路径与用户内容：整节点不收录，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"GitHub Pages",
	"GitHub Actions",
	"GitHub Enterprise",
	"GitHub",
	"main",
	"/docs",
	"Oppenheymu",
	"Github-i18n",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 按节点顺序拼接译文（未命中的节点保留原文），用于核对拆句后是否读得通 */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => translateText(node, view) ?? node)
		.join("");
}

describe("仓库设置页的 Pages 子页的实机节点边界", () => {
	it("translates every text node and translatable attribute", () => {
		for (const [node, expected] of NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps product names, branch names, paths and user content in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("reassembles the split sentences into readable chinese", () => {
		// 「<GitHub Pages 链接> is designed to host …」：实机上前导空格由引擎保留，
		// 故显示为「GitHub Pages 用于托管…」；translateText 只返回不带空白的译文
		expect(
			renderNodes([
				"GitHub Pages",
				"is designed to host your personal, organization, or project pages from a GitHub repository.",
			]),
		).toBe(
			"GitHub Pages用于托管来自 GitHub 仓库的个人、组织或项目页面。",
		);
		// 「GitHub Pages is currently disabled. … <链接>」
		expect(
			renderNodes([
				"GitHub Pages is currently disabled. Select a source below to enable GitHub Pages for this repository.",
				"Learn more about configuring the publishing source for your site",
			]),
		).toBe(
			"GitHub Pages 当前已禁用。请在下方选择来源，为此仓库启用 GitHub Pages。进一步了解如何为你的站点配置发布源",
		);
		// 「Use a suggested workflow, <a>…</a>, or <a>…</a>.」
		expect(
			renderNodes([
				"Use a suggested workflow,",
				"browse all workflows",
				", or",
				"create your own",
			]),
		).toBe(
			"使用建议的工作流，浏览所有工作流，或创建你自己的",
		);
		// 「Workflow details will appear here once your site has been deployed. <链接>」
		expect(
			renderNodes([
				"Workflow details will appear here once your site has been deployed.",
				"View workflow runs.",
			]),
		).toBe(
			"站点部署完成后，工作流详情会显示在这里。查看工作流运行。",
		);
	});

	it("keeps the label and the menu item of the source picker apart", () => {
		// `Source` 是表单标签，`Deploy from a branch` 是选中值 + 菜单项文案，
		// 两者是独立节点；拼接串不该命中
		expect(
			translateText("Source Deploy from a branch", view),
		).toBeNull();
		// GitHub Actions 选项的说明与标签同理，各自成条
		expect(
			translateText(
				"GitHub Actions Best for using frameworks and customizing your build process",
				view,
			),
		).toBeNull();
	});
});
