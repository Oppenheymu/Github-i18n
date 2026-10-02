// 首页（登录后）的实机节点回归。
//
// 证据来源：维护者 2026-10-02 贴出的**实机 HTML**（未加载扩展的原始英文页）：
// Copilot 对话区（问候语 / 输入框 / 工具栏 / 启动器胶囊 / 动作菜单 / 提示词库 /
// `/create-issue` 命令列表）、Copilot 应用宣传横幅、议题列表的「查看全部」链接。
// 截图只用于核对语义与数量。
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
	buildView,
	matchModules,
} from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

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
		// —— AutoTierPicker（「Optimized for: …」）展开后的三档：档位名与说明各一个节点 ——
		["Efficiency", "效率"],
		[
			"Prioritizes speed and efficiency",
			"优先考虑速度与效率",
		],
		["Balance", "均衡"],
		[
			"Balances speed and intelligence",
			"在速度与智能之间取得平衡",
		],
		["Intelligence", "智能"],
		["Prioritizes intelligence", "优先考虑智能"],
		["Send now", "立即发送"],
		// —— 启动器胶囊 ——
		["Debug", "调试"],
		["Agent", "智能代理"],
		["Create issue", "创建议题"],
		["Write code", "编写代码"],
		// —— 对话区的动作菜单（ActionList 覆盖层，各是一个菜单项节点）——
		["My open pull requests", "我打开的拉取请求"],
		["Summarize my latest PR", "总结我最新的 PR"],
		// —— 提示词库的四个建议（ActionList.Item.Label 里的 <div>）——
		["Create a profile README", "创建个人资料 README"],
		["Generate a simple calculator", "生成一个简单计算器"],
		["Make a Pong game", "做一个 Pong 游戏"],
		[
			"Design a Mermaid architecture overview",
			"设计一个 Mermaid 架构概览",
		],
		// —— `/create-issue` 命令的两条说明句（行首标签是另一个节点，见反例断言）——
		[
			"First, create a new draft issue. Then ask for additional information to fill out the issue.",
			"先创建一个草稿议题，然后补充信息把议题填完整。",
		],
		[
			"First, create an issue with sub issues. Then ask for additional information to fill out these issues.",
			"先创建一个带子议题的议题，然后补充信息把这些议题填完整。",
		],
		// —— `Git` 胶囊展开后的命令菜单（截图证据：三条仍英文；专名 Git 留在译文里）——
		["Basic Git commands", "基本 Git 命令"],
		["Git branching", "Git 分支"],
		["Advanced Git commands", "高级 Git 命令"],
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

	it("translates only the prefix of the tier button and never swallows the tier name", () => {
		// 中文界面下这个按钮的实机节点是**半中半英**的「Optimized for: 均衡」：档位名由
		// GitHub 自己译出，前缀是上游漏翻的英文。它能走到规则，靠的是 filters 放行
		// 「含拉丁字母的混合节点」；规则只用 `\\s*` 吃前缀，档位名原样留下。
		expect(translateText("Optimized for: 均衡", view)).toBe(
			"优化目标：均衡",
		);
		// 英文界面下的形态由静态词条整串接手（档位名一并译成中文）
		expect(
			translateText("Optimized for: Balance", view),
		).toBe("优化目标：均衡");
		expect(
			translateText("Optimized for: Efficiency", view),
		).toBe("优化目标：效率");
	});

	it("keeps the Git starter and product names as upstream text", () => {
		// 「Git」是纯专名，刻意不收录：未命中即保留英文，这是正确行为而非漏译。
		// 注意它与 `Git` 胶囊展开后的三条命令词条并存：胶囊标签仍英文，
		// 菜单项（Basic Git commands 等）已译——两者不是同一条词条。
		expect(translateText("Git", view)).toBeNull();
	});

	it("keeps slash-command tags in english", () => {
		// 命令列表行首的 `/create-issue` 是**斜杠命令标识符**（与代码同类），
		// 刻意不收录：译了反而与命令对不上。它自己是一个节点，说明句另走词条。
		expect(translateText("/create-issue", view)).toBeNull();
	});

	it("keeps account names and owner names in english", () => {
		// 反例：账户名 / 仓库名是用户内容，整节点不收录（问候语规则也只搬运捕获组）
		expect(translateText("Oppenheymu", view)).toBeNull();
		expect(translateText("Github-i18n", view)).toBeNull();
	});
});
