// 首页（登录后）的实机节点回归。
//
// 证据来源：维护者 2026-10-02 贴出的**实机 HTML**（未加载扩展的原始英文页）：
// Copilot 对话区（问候语 / 输入框 / 工具栏 / 启动器胶囊）、Copilot 应用宣传横幅、
// 议题列表的「查看全部」链接。截图只用于核对语义与数量。
//
// 关键边界事实（都在断言里锁住）：
//   1. 首页有**两个地址**（`/` 与 `/dashboard`），两条都必须命中 pages/dashboard——
//      维护者 2026-10-02 反馈「补了却没生效」的根因就是路由只覆盖了 `^/$`；
//   2. 问候语 `Good afternoon, Oppenheymu!` 是**单个节点**，用户名随账户变化、
//      时段随访问时间变化，只能靠 dashboard/greeting-* 规则（三个时段各一条 pattern）；
//   3. `View all` 与被 sr-only 包住的 ` issues` 是**两个**文本节点（后者带前导空格），
//      整句键 `View all issues` 在实机永不命中；
//   4. `Git` 启动器是纯专名，按硬性约束 3 **刻意不收录**（未命中即保留英文）；
//   5. 输入框的 placeholder 与 aria-label 是**两条不同长度**的文案，各自成词条。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView, matchModules } from "../view.ts";
import { translateText } from "../walker.ts";

const zh = dictForLocale("zh-CN");

/** `/` 命中的模块视图（pages/dashboard + global） */
const view = buildView(
	"/",
	zh,
	new Map(Object.entries(dictCore.aliases)),
);

/** `/dashboard` 命中的模块视图（应与 `/` 完全一致） */
const dashboardView = buildView(
	"/dashboard",
	zh,
	new Map(Object.entries(dictCore.aliases)),
);

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 实机文本 → 应渲染的译文（逐字录入，顺序即页面出现顺序） */
const STATIC_NODES: readonly (readonly [string, string])[] =
	[
		// —— Copilot 对话区：输入框的两条文案 ——
		[
			"Ask anything or type @ to add context",
			"问点什么，或输入 @ 用 Copilot 添加上下文",
		],
		[
			"Ask anything or type @ to add context with Copilot",
			"问点什么，或输入 @ 用 Copilot 添加上下文",
		],
		// —— 工具栏 ——
		["Ask", "提问"],
		[
			"Select repositories to attach to conversation",
			"选择要附加到对话的仓库",
		],
		["All repositories", "所有仓库"],
		["Add files, and spaces", "添加文件与空间"],
		["Auto", "自动"],
		["Model:", "模型："],
		["Send now", "立即发送"],
		// —— 启动器胶囊 ——
		["Debug", "调试"],
		["Agent", "智能代理"],
		["Create issue", "创建议题"],
		["Write code", "编写代码"],
		// —— Copilot 应用宣传横幅 ——
		["The GitHub Copilot app", "GitHub Copilot 应用"],
		[
			"An agent-driven desktop experience built natively on GitHub.",
			"原生构建于 GitHub 的智能代理桌面体验。",
		],
		["Download for Windows", "下载 Windows 版"],
		["Dismiss banner", "关闭横幅"],
		[
			"The GitHub Copilot app, New",
			"GitHub Copilot 应用，新建",
		],
		// —— 议题列表的「查看全部」链接 ——
		["View all", "查看全部"],
		["issues", "议题"],
	];

describe("pages/dashboard 的实机节点边界", () => {
	it("matches both addresses of the signed-in home page", () => {
		// `/` 与 `/dashboard` 渲染同一页，路由必须两条都命中 pages/dashboard。
		// 只覆盖 `^/$` 时的实机表现是「往本模块加了词条，从 /dashboard 访问却全是英文」
		// ——那正是维护者 2026-10-02 报的问题，故这里把两条地址都钉住。
		for (const pathname of [
			"/",
			"/dashboard",
			"/dashboard/",
		]) {
			expect(
				matchModules(pathname, zh.modules).map(
					(module) => module.name,
				),
				pathname,
			).toEqual(["pages/dashboard", "global"]);
		}
		// `(?:dashboard)?/?$` 是整段锚定的：形如 /dashboard-archive 的**合法用户名**
		// 不会被吞进来（它照旧由 pages/profile 接手）
		expect(
			matchModules("/dashboard-archive", zh.modules).map(
				(module) => module.name,
			),
		).toEqual(["pages/profile", "global"]);
	});

	it("renders identically on both addresses", () => {
		// 两个视图的词条映射必须逐键一致：地址不同不该产生不同译文
		expect([...dashboardView.entries]).toEqual([
			...view.entries,
		]);
	});

	it("translates every node the dashboard HTML shows", () => {
		for (const [node, expected] of STATIC_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("translates the greeting through the rule with Chinese word order", () => {
		// 时段随访问时间变化、用户名随账户变化，故三个时段各断言一次；
		// 中文语序是「时段好，用户名！」——模板里的捕获组与英文原文顺序相反
		expect(
			translateText("Good afternoon, Oppenheymu!", view),
		).toBe("下午好，Oppenheymu！");
		expect(
			translateText("Good morning, octocat!", view),
		).toBe("早上好，octocat！");
		expect(
			translateText("Good evening, Oppenheymu!", view),
		).toBe("晚上好，Oppenheymu！");
		// 含空格的显示名（`M. Oppenheymu`）不命中——pattern 的 `\S+` 刻意不跨空格：
		// 那是**显示名**而非账户名，宁可保留英文也不要用贪婪匹配把用户内容切错
		expect(
			translateText("Good evening, M. Oppenheymu!", view),
		).toBeNull();
	});

	it("keeps the model tier and the Git starter as upstream text", () => {
		// 「Optimized for: Balance」里的档位名是产品档位（Balance），只翻前缀、原样保留档位名
		expect(
			translateText("Optimized for: Balance", view),
		).toBe("优化目标：Balance");
		// 「Git」是纯专名，刻意不收录：未命中即保留英文，这是正确行为而非漏译
		expect(translateText("Git", view)).toBeNull();
	});

	it("keeps account names and owner names in english", () => {
		// 反例：账户名 / 仓库名是用户内容，整节点不收录（问候语规则也只搬运捕获组）
		expect(translateText("Oppenheymu", view)).toBeNull();
		expect(translateText("Github-i18n", view)).toBeNull();
	});
});
