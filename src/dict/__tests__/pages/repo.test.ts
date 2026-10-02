// 仓库页（/owner/repo 及其子页）实机文本节点回归。
//
// 节点清单来源：2026-09 用无扩展的无头 Edge 抓 https://github.com/microsoft/vscode
// 的真实渲染 DOM，逐个文本节点记录 nodeValue（含源码换行缩进）与父元素路径，
// 再用仓库自己的 translateText + 该路径的 buildView 判定命中。这里锁的是
// **节点边界**这一层事实——整句键在实机上永不命中，只有逐节点的原文才算数。
//
// 为什么这些反例必须留在文件里：仓库页最像「用户内容」的位置是文件/目录列表
// （实测确实渲染成孤立文本节点：div.react-directory-filename-cell > a.Link--primary
// 里的 "src" / "test" / "build" / "extensions" …）。引擎按「整节点精确匹配」工作，
// 分不清 UI 文案与文件名，唯一的保护就是**不收录**这类小写常用词——下面的反例
// 断言就是这条纪律的回归保护，别把它们「补」成词条。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /microsoft/vscode 命中的模块视图（pages/repo + global） */
const view = buildView(
	"/microsoft/vscode",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/**
 * 实机渲染的文本节点原文（逐字录入；带缩进换行的按原样保留）。
 * 末尾标注的是实机译文，便于人工对照。
 */
const REPO_NODES: readonly string[] = [
	// —— 仓库导航 ——
	"Code", // → 代码
	"Issues", // → 议题
	"Pull requests", // → 拉取请求
	"Actions", // → 操作
	"Projects", // → 项目
	"Wiki", // → 维基
	"Security and quality", // → 安全与质量
	"Insights", // → 洞察
	"Additional navigation options", // → 更多导航选项
	// 同一批导航项在窄屏下拉里带源码缩进，是**另一组文本节点**
	"\n          Code\n",
	"\n          Actions\n",
	"\n          Projects\n",
	"\n          Wiki\n",
	"\n          Security and quality\n",
	"\n          Insights\n",
	// —— 仓库头部动作 ——
	"You must be signed in to change notification settings",
	"Fork\n    ",
	"\n          Star\n",
	// —— 分支 / 标签入口 ——
	"Branches",
	"Tags",
	"Go to file",
	"Open more actions menu",
	// —— 文件列表表头 ——
	"Latest commit",
	"History",
	"Folders and files",
	"Name",
	"Last commit message",
	"Last commit date",
	"View all files",
	"Repository files navigation",
	// —— 侧栏 ——
	"About",
	"Readme",
	"MIT license",
	"Code of conduct",
	"Contributing",
	"Security policy",
	"Activity",
	"Custom properties",
	"Watchers",
	"Releases",
	"Latest",
	"Contributors",
	"Languages",
	"Report repository",
];

/** 用户内容 / 仓库元数据：一律保留英文（未收录即不命中） */
const USER_CONTENT: readonly string[] = [
	// 仓库标识
	"microsoft",
	"vscode",
	// 分支名与默认分支
	"main",
	// 文件 / 目录名（实机确实是这样一组孤立节点）
	"src",
	"test",
	"build",
	"extensions",
	"resources",
	"scripts",
	"cli",
	"remote",
	".github",
	".config",
	".devcontainer",
	".vscode",
	".editorconfig",
	".git-blame-ignore-revs",
	// 带扩展名的文件名：README 收，README.md 不收
	"README.md",
	"package.json",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("仓库页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of REPO_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps file names, branch names and owner names in english", () => {
		for (const raw of USER_CONTENT) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("distinguishes the README label from the README.md file name", () => {
		expect(translateText("README", view)).toBe("自述文件");
		expect(translateText("README.md", view)).toBeNull();
	});

	it("matches a fragment that carries source indentation", () => {
		// "Fork\n    " 是实机里真实存在的形态（节点自带源码缩进）。引擎先归一化再匹配，
		// 故译文是干净的「复刻」；写回时由 walker 负责保留原节点的首尾空白
		expect(translateText("Fork\n    ", view)).toBe("复刻");
		expect(translateText("\n          Star\n", view)).toBe(
			"星标",
		);
	});

	it("translates the sidebar counts through the repo count rules", () => {
		// 侧栏三个计数（星标 / 关注 / 复刻）是「数字 + 单位」的单个节点，
		// 数字随仓库变化，故走规则而不是静态词条（静态词条只能解采集时的那一个值）。
		// 2026-09 维护者按截图 + `<span> stars</span>` 片段确认了这三个节点的存在。
		expect(translateText("5 stars", view)).toBe("5 个星标");
		expect(translateText("1 star", view)).toBe("1 个星标");
		expect(translateText("2 watching", view)).toBe(
			"2 人在关注",
		);
		expect(translateText("1 fork", view)).toBe("1 个复刻");
		expect(translateText("3 forks", view)).toBe("3 个复刻");
		// 千位缩写与带逗号的计数同样命中（GitHub 会渲染成 4.1k / 1,234 这类形态）
		expect(translateText("4.1k stars", view)).toBe(
			"4.1k 个星标",
		);
		expect(translateText("1,234 stars", view)).toBe(
			"1,234 个星标",
		);
	});

	it("keeps repository names that contain count words untouched", () => {
		// 规则锚定整节点且要求「数字 + 单位」形态，故仓库名 / 描述里的这些词不会被误伤
		for (const raw of [
			"stars",
			"watching",
			"5 stars and 2 forks",
			"awesome-stars",
			"star charts",
			"fork it",
		]) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});
