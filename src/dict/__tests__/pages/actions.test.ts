// Actions 运行详情页（/owner/repo/actions/runs/<id>）的实机节点回归。
//
// 证据来源：维护者 2026-10-24 用 popup 开发者模式导出的漏翻清单
// （schema github-zh-misses/3，90 条）——页面是 /NapukettoDev/NapukettoQQ/actions/runs/40109514577，
// 经 report:misses 分拣出 59 条候选，全部指向 pages/actions（模块此前只覆盖列表页）。
//
// 关键边界事实（都在断言里锁住）：
//   1. Re-run 对话框的说明句被拆成三节点：「…including」+（all the jobs 或**用户 job 名**）+
//      「and dependents:」——job 名是用户内容不收，两端的碎片词条按拼接语义翻译；
//   2. Artifacts 的下载 / 删除链接带**用户自定义 artifact 名**，走规则搬运（$1 原样保留），
//      静态键（Delete workflow run 等）先命中、规则只兜动态值；
//   3. 「Enable / Usage / Agents / items / Deployment protection rules / Size」是**路由互斥键**：
//      别的模块已有同名词条、actions 页吃不到，须在本模块重复登记（译文沿用）；
//   4. 事件行「<用户名> approved <相对时间>」「<用户名> pushed <SHA> <分支>」：相对时间由
//      GitHub 自渲染（已中文），用户名 / SHA / 分支是用户内容，只有动词碎片收录；
//   5. 快捷键提示 alt shift r（sr-only）按既定纪律保持英文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const zh = dictForLocale("zh-CN");

/** 运行详情页命中的模块视图（pages/actions + pages/repo + global） */
const view = buildView(
	"/NapukettoDev/NapukettoQQ/actions/runs/40109514577",
	zh,
	new Map(Object.entries(dictCore.aliases)),
);

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 实机文本 → 应渲染的译文（逐字录入，按页面区块分组） */
const STATIC_NODES: readonly (readonly [string, string])[] =
	[
		// —— Tab 页签（互斥键 Usage 沿用 settings 的「用量」）——
		["Usage", "用量"],
		["Workflow file", "工作流文件"],
		["Lockfile", "锁定文件"],
		// —— Re-run 对话框 ——
		["Re-run jobs", "重新运行作业"],
		["Re-run all jobs", "重新运行所有作业"],
		["Re-run single job", "重新运行单个作业"],
		["all the jobs", "所有作业"],
		["and dependents:", "及其依赖项:"],
		["Enable", "启用"],
		["debug logging", "调试日志"],
		// —— 摘要页菜单与下拉 ——
		["Create status badge", "创建状态徽章"],
		["Delete all logs", "删除所有日志"],
		["View job logs", "查看作业日志"],
		["View raw markdown", "查看原始 markdown"],
		["Copy permalink", "复制永久链接"],
		["Copy summary permalink", "复制摘要永久链接"],
		["Copy artifact digest", "复制产物摘要"],
		["All jobs", "所有作业"],
		["Run details", "运行详情"],
		["Filter by job status", "按作业状态筛选"],
		["Workflow run options", "工作流运行选项"],
		// —— Artifacts 区块（互斥键 Size 沿用 search 的「大小」）——
		["Artifacts", "产物"],
		["Produced during runtime", "运行期间生成"],
		["Digest", "摘要"],
		["Size", "大小"],
		["Total duration", "总时长"],
		["Triggered via push", "通过 push 触发"],
		// —— 部署保护区块 ——
		["Deployment protection rules", "部署保护规则"],
		[
			"Reviewers, timers, and other rules protecting deployments in this run",
			"审查者、计时器以及保护此次部署的其他规则",
		],
		// —— 事件行动词碎片 ——
		["approved", "批准于"],
		["pushed", "推送了"],
		// —— 无障碍文案 ——
		["Annotations", "注解"],
		["Workflow run", "工作流运行"],
		["Workflow run graph", "工作流运行图"],
		["Workflow run summary", "工作流运行摘要"],
		["Fit to window", "适应窗口"],
		["Zoom in", "放大"],
		["Zoom out", "缩小"],
		// —— 作业摘要尾注与页脚 ——
		[
			"Job summary generated at run-time",
			"作业摘要在运行时生成",
		],
		["Made with ❤️ by", "用 ❤️ 制作，作者"],
		[
			"Oh hello! Nice to see you.",
			"哦，你好！很高兴见到你。",
		],
		// 分页组件的 sr-only 碎片（互斥键，沿用 repo-settings 的「项」）
		["items", "项"],
	];

/** 必须保持英文的实机节点：用户内容与动态值（清单里的「有意保留」部分） */
const USER_CONTENT: readonly string[] = [
	"NapukettoDev",
	"Oppenheymu",
	"NapukettoQQ",
	"677f0ed",
	"main",
	"release.yml",
	"release",
	"release-workspace",
	"humans.txt",
	"alt shift r",
	"4.67 MB",
];

/** 引擎语义的节点拼接：命中则保留首尾空白写回（见 walker.ts 的 applyTextNode） */
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

describe("Actions 运行详情页的实机节点边界", () => {
	it("matches the run-details route into pages/actions", () => {
		expect(
			matchModules(
				"/NapukettoDev/NapukettoQQ/actions/runs/40109514577",
				zh.modules,
			)
				.map((module) => module.name)
				.indexOf("pages/actions"),
		).toBeGreaterThanOrEqual(0);
	});

	it("translates every node the miss export shows", () => {
		for (const [node, expected] of STATIC_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("assembles the re-run dialog sentence across its three nodes", () => {
		// 全作业版：中间节点是 all the jobs；单作业版中间是用户 job 名（不命中、原样保留）。
		// 节点间的空格是原文自带的，引擎保留（applyTextNode 的 lead + trail）
		expect(
			renderNodes([
				"A new attempt of this workflow will be started, including ",
				"all the jobs",
				" and dependents:",
			]),
		).toBe(
			"将开始此工作流的新一次尝试，包括 所有作业 及其依赖项:",
		);
		expect(
			renderNodes([
				"A new attempt of this workflow will be started, including ",
				"prepare（用户 job 名原样保留）",
				" and dependents:",
			]),
		).toBe(
			"将开始此工作流的新一次尝试，包括 prepare（用户 job 名原样保留） 及其依赖项:",
		);
	});

	it("assembles the enable-debug-logging label across its two nodes", () => {
		expect(renderNodes(["Enable ", "debug logging"])).toBe(
			"启用 调试日志",
		);
	});

	it("renders event lines with the verb fragment in place", () => {
		// 「<用户名> approved <相对时间>」：相对时间由 GitHub 自渲染（已中文）
		expect(
			renderNodes([
				"Oppenheymu ",
				"approved ",
				"2026 年 10 月 25 日",
			]),
		).toBe("Oppenheymu 批准于 2026 年 10 月 25 日");
		// 「<用户名> pushed <SHA> <分支>」
		expect(
			renderNodes([
				"Oppenheymu ",
				"pushed ",
				"677f0ed",
				" main",
			]),
		).toBe("Oppenheymu 推送了 677f0ed main");
	});

	it("rewrites named artifacts through the rules and keeps user names intact", () => {
		// 下载 / 删除链接的 artifact 名是用户内容：规则只搬运捕获组
		expect(
			translateText(
				"Download release-workspace (opens in a new tab)",
				view,
			),
		).toBe("下载 release-workspace（在新标签页中打开）");
		expect(
			translateText("Delete release-workspace", view),
		).toBe("删除 release-workspace");
		// 静态键先于规则命中，不受宽 pattern 影响
		expect(translateText("Delete all logs", view)).toBe(
			"删除所有日志",
		);
		// 裸 artifact 名没有动词上下文，保持英文
		expect(
			translateText("release-workspace", view),
		).toBeNull();
	});

	it("rewrites dynamic trigger type and check counts through the rules", () => {
		// 触发类型是封闭集合，事件名按 YAML 术语保留英文
		expect(translateText("Triggered via push", view)).toBe(
			"通过 push 触发",
		);
		expect(
			translateText("Triggered via schedule", view),
		).toBe("通过 schedule 触发");
		// 检查状态图标的 aria-label：两端数字动态
		expect(translateText("7 / 8 checks OK", view)).toBe(
			"7 / 8 项检查通过",
		);
		expect(
			translateText("1,234 / 2,000 checks OK", view),
		).toBe("1,234 / 2,000 项检查通过");
	});

	it("keeps user content, dynamic values and shortcut hints in english", () => {
		for (const node of USER_CONTENT) {
			expect(translateText(node, view), node).toBeNull();
		}
	});

	it("has japanese translations for the same nodes", () => {
		const japanese = buildView(
			"/NapukettoDev/NapukettoQQ/actions/runs/40109514577",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Re-run all jobs", japanese)).toBe(
			"すべてのジョブを再実行",
		);
		expect(
			translateText(
				"Download release-workspace (opens in a new tab)",
				japanese,
			),
		).toBe(
			"release-workspace をダウンロード（新しいタブで開きます）",
		);
		expect(translateText("7 / 8 checks OK", japanese)).toBe(
			"7 / 8 件のチェックが成功",
		);
	});
});
