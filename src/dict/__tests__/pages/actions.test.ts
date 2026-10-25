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
		// 审批通过的 flash 提示（2026-10-25 实机）：句号在节点内部，译中文句号
		[
			"The deployments have been approved.",
			"部署已获批准。",
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
		// —— 自动刷新下拉(2026-10-25 实机 HTML):aria-label 与五个选项;
		// Off 互斥键沿用 settings 系的「关闭」——
		["Auto-refresh", "自动刷新"],
		["Every 10 seconds", "每 10 秒"],
		["Every 30 seconds", "每 30 秒"],
		["Every minute", "每分钟"],
		["Every 5 minutes", "每 5 分钟"],
		["Off", "关闭"],
		// —— 动作反馈提示(删除日志 / 删除运行成功),句号在节点内部 ——
		["Logs deleted successfully.", "日志已删除。"],
		[
			"Workflow run deleted successfully.",
			"工作流运行已删除。",
		],
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

	it("translates the approval flash alert with its raw node whitespace", () => {
		// 实机 div 里文本节点带前后缩进与句后的空行（尾部空白），归一化后命中；
		// 同 div 里 sr-only 的 &nbsp;（\u00a0）是纯符号节点，保持不动
		expect(
			translateText(
				"\n      The deployments have been approved.\n\n    ",
				view,
			),
		).toBe("部署已获批准。");
		expect(translateText("\u00a0", view)).toBeNull();
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

/**
 * 部署审批工作流（维护者 2026-10-25 popup 导出，run/job/lockfile/usage/workflow
 * 五个子页，/Koishi-CE/koishi/actions/runs/40165923537）。
 *
 * 审批弹层的说明句拆多节点、按节点顺序拼接：环境名 release 与用户名是用户内容，
 * 不收；「Agents」与 repo-settings 同键同译（顶部 tab，actions 路由吃不到）。
 * 本批同时实锤引擎缺口——aria-label 此前只查静态表，checks-ok /
 * download-artifact 规则在属性路径上失效（引擎修正见 walker.test.ts 的
 * 「applies rules to attribute values too」）。
 */
describe("部署审批工作流的实机节点边界", () => {
	it("translates the approval dialog and log toolbar", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Agents", "代理"],
			["Review deployments", "审查部署"],
			["Review pending deployments", "审查待处理部署"],
			["Approve and deploy", "批准并部署"],
			["Reject", "拒绝"],
			["Leave a comment:", "留下评论："],
			["Waiting", "等待中"],
			["Waiting for review:", "等待审查："],
			["waiting for review", "等待审查"],
			[
				"needs approval to start deploying changes.",
				"需要审批才能开始部署变更。",
			],
			["Cancel workflow", "取消工作流"],
			["Show timestamps", "显示时间戳"],
			["Show full screen (Shift+F)", "全屏显示（Shift+F）"],
			["Download log archive", "下载日志归档"],
			["View raw logs", "查看原始日志"],
			["Search logs", "搜索日志"],
			["Check run summary", "检查运行摘要"],
			["Go to next result", "转到下一个结果"],
			["Go to previous result", "转到上一个结果"],
			["Lockfile for this run", "此运行的锁定文件"],
			["Lockfile not found", "未找到锁定文件"],
			["Job", "作业"],
			["Run time", "运行时长"],
			[
				"Learn about OS pricing on GitHub Actions",
				"了解 GitHub Actions 的操作系统定价",
			],
			["Workflow file for this run", "此运行的工作流文件"],
			["Edit workflow file", "编辑工作流文件"],
		];
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, view),
				`未命中：${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("assembles the deployment sentences around the user and environment", () => {
		// 「Review pending deployments requested by <用户> in <环境> #N」：
		// 五节点逐段拼装（环境名 / 用户名用户内容原样保留）。输入按 popup 记录的
		// nodeValue 原样（无首尾空白），引擎紧贴拼装不添空格——实机节点若带
		// 源码缩进空白，写回时会自然保留（applyTextNode 的 lead + trail）
		expect(
			renderNodes([
				"Review pending deployments",
				"requested\n             by",
				"Oppenheymu",
				"in",
				"Release #26",
			]),
		).toBe(
			"审查待处理部署，请求人Oppenheymu，位于Release #26",
		);
		// 「<用户> requested your review to deploy to <环境>」
		expect(
			renderNodes([
				"Oppenheymu",
				"requested your review\n              to deploy to",
				"release",
			]),
		).toBe("Oppenheymu请求你审查以部署到release");
		// 「<job 名> is waiting for <环境> deployment approval」
		expect(
			renderNodes([
				"publish（OIDC 发包，需 environment 审批）",
				"is waiting for",
				"release",
				"deployment approval",
			]),
		).toBe(
			"publish（OIDC 发包，需 environment 审批）正在等待release的部署审批",
		);
		// lockfile 空状态的提示句碎片（中间 gh actions-lock 是命令文本）
		expect(
			renderNodes([
				"No lockfile was found for this workflow run.\n          Lock your workflow dependencies by running",
				"gh actions-lock",
				"in your repository.",
			]),
		).toBe(
			"未找到此工作流运行的锁定文件。运行gh actions-lock即可锁定你仓库中的工作流依赖。",
		);
	});

	it("translates the notice count and star title through rules", () => {
		expect(translateText("1 notice", view)).toBe(
			"1 条注记",
		);
		expect(translateText("2 notices", view)).toBe(
			"2 条注记",
		);
		expect(
			translateText(
				"Repository starred by 7 people, including you",
				view,
			),
		).toBe("仓库已获得 7 人星标，其中包括你");
		// workflow / lockfile 页头的「<文件> at <SHA>」
		expect(translateText("at", view)).toBe("位于");
	});

	it("keeps the environment name and dynamic log lines in english", () => {
		// 环境名（release / Release #26）是用户内容；PageHeader 父链接文本即环境名。
		// 日志内容（ubuntu-latest 迁移提示）是用户内容，URL 节点同理
		expect(translateText("Release", view)).toBeNull();
		expect(translateText("Release #26", view)).toBeNull();
		expect(translateText("release", view)).toBeNull();
		expect(
			translateText("release-workspace", view),
		).toBeNull();
		expect(
			translateText(
				'"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see',
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"https://github.com/actions/runner-images/issues/14748",
				view,
			),
		).toBeNull();
	});

	it("has japanese templates for the approval flow", () => {
		const japanese = buildView(
			"/NapukettoDev/NapukettoQQ/actions/runs/40109514577",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText("Review deployments", japanese),
		).toBe("デプロイをレビュー");
		expect(
			translateText("Review pending deployments", japanese),
		).toBe("レビュー待ちのデプロイ");
		expect(
			translateText("Approve and deploy", japanese),
		).toBe("承認してデプロイ");
		expect(translateText("1 notice", japanese)).toBe(
			"1 件の注記",
		);
		expect(
			translateText(
				"Repository starred by 7 people, including you",
				japanese,
			),
		).toBe(
			"リポジトリはあなたを含む 7 人にスターされました",
		);
	});
});

// —— 2026-10-25 维护者导出的漏翻清单（/NapukettoDev/NapukettoQQ/actions 列表页）——
// 运行列表项的 aria-label 整串是动态值（运行序号 / 工作流名 / 触发源），
// 可见文本里的碎片键 `completed successfully:` 命中不了它，走 actions/run-status-aria 规则。
describe("Actions 运行列表项 aria-label 的实机节点边界", () => {
	const listView = buildView(
		"/NapukettoDev/NapukettoQQ/actions",
		zh,
		new Map(Object.entries(dictCore.aliases)),
	);

	it("reassembles the run status aria with captured values", () => {
		expect(
			translateText(
				"completed successfully: Run 75 of CodeQL. PR #19",
				listView,
			),
		).toBe("已成功完成：CodeQL 的第 75 次运行。PR #19");
		expect(
			translateText(
				"completed successfully: Run 76 of CodeQL. Push on main",
				listView,
			),
		).toBe(
			"已成功完成：CodeQL 的第 76 次运行。Push on main",
		);
	});
});
