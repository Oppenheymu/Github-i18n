// global 模块（兜底模块，任意路径命中）的实机节点回归。
//
// 节点清单来源：2026-09 无头 Edge 抓 https://github.com/microsoft/vscode 的真实渲染 DOM。
// global 覆盖的是**全站外壳**——营销页顶栏、页脚、GitHub 通用的动作与动态时间文本；
// 这些节点在每个页面上都存在，所以它们的回归价值最高（一次坏掉，全站都坏）。
//
// 为什么单独列「动态文本」一组：global 是唯一承载相对时间 / 绝对日期规则的模块
// （core/rules.jsonc 的 global/* 组）。规则一旦写坏，页面上所有时间都会变成
// 「September 1 - September 30, 2026」那种中英残句，而静态词条测试完全发现不了。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** global 节点在任意页面都生效；这里用仓库页的视图（pages/repo + global） */
const view = buildView(
	"/microsoft/vscode",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机渲染的文本节点原文（逐字录入；末尾是实机译文） */
const GLOBAL_NODES: readonly string[] = [
	// —— 无障碍外壳 ——
	"Skip to content", // → 跳到主要内容
	"Navigation Menu", // → 导航菜单
	// —— 营销顶栏 ——
	"Sign in", // → 登录
	"Appearance settings", // → 外观设置
	"Platform", // → 平台
	"AI CODE CREATION", // → AI 代码创作
	"Write better code with AI", // → 借助 AI 编写更优质的代码
	"Direct agents from issue to merge", // → 智能代理从议题直达合并
	"Integrate external tools", // → 集成外部工具
	"DEVELOPER WORKFLOWS", // → 开发者工作流
	"Automate any workflow", // → 自动化任意工作流
	"Codespaces", // → 代码空间
	"Instant dev environments", // → 即时开发环境
	"Issues", // → 议题
	"Plan and track work", // → 规划并跟踪工作
	"Code Review", // → 代码审查
	"Manage code changes", // → 管理代码变更
	"Code Quality", // → 代码质量
	"Enforce quality at merge", // → 在合并时保障质量
	"APPLICATION SECURITY", // → 应用安全
	"Find and fix vulnerabilities", // → 发现并修复漏洞
	"Code security", // → 代码安全
	"Secure your code as you build", // → 在开发过程中保障代码安全
	"Secret protection", // → 机密防护
	"Stop leaks before they start", // → 防泄露于未然
	"EXPLORE", // → 探索
	"Why GitHub", // → 为什么选择 GitHub
	"Documentation", // → 文档
	"Blog", // → 博客
	"Changelog", // → 更新日志
	"Marketplace", // → 市场
	"View all features", // → 查看所有功能
	"Solutions", // → 解决方案
	"BY COMPANY SIZE", // → 按公司规模
	"Enterprises", // → 大型企业
	"Small and medium teams", // → 中小型团队
	"Startups", // → 初创企业
	"Nonprofits", // → 非营利组织
	"BY USE CASE", // → 按使用场景
	"App Modernization", // → 应用现代化
	"View all use cases", // → 查看所有使用场景
	"BY INDUSTRY", // → 按行业
	"Healthcare", // → 医疗保健
	"Financial services", // → 金融服务
	"Manufacturing", // → 制造业
	"Government", // → 政府
	"View all industries", // → 查看所有行业
	"View all solutions", // → 查看所有解决方案
	"Resources", // → 资源
	"EXPLORE BY TOPIC", // → 按主题探索
	"Software Development", // → 软件开发
	"Security", // → 安全
	"View all topics", // → 查看所有主题
	"EXPLORE BY TYPE", // → 按类型探索
	"Customer stories", // → 客户案例
	"Events & webinars", // → 活动与网络研讨会
	"Ebooks & reports", // → 电子书与报告
	"Business insights", // → 商业洞察
	"SUPPORT & SERVICES", // → 支持与服务
	"Customer support", // → 客户支持
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 相对时间的**完整变体集**：维护者 2026-10-02 报「`2 minutes ago` 没翻译」时，
 * 顺带在 Node 里用 `Intl.RelativeTimeFormat`（`<relative-time>` 的驱动）把英文集合
 * 枚举了一遍，再把标点/冠词/模糊限定词各形态列全。
 *
 * 这一组是回归网：任何一条变成 null（或不再是中文）都会被下面两个用例挡住。
 * 关键边界事实：
 *   1. 数量可带小数（`1.5 hours ago`），`\\d+` 的 pattern 会漏掉这类；
 *   2. 冠词形态（`a minute ago`）与省略数量的模糊形态（`less than a minute ago`）
 *      在模板里只能写成「1」——模板只能搬运捕获组，不能做值映射；
 *   3. `yesterday` 走静态词条（global 的 `yesterday`），不属规则族；
 *   4. 未来方向的 `in a minute` 等同样成族。
 */
const RELATIVE_TIME_NODES: readonly (readonly [
	string,
	string,
])[] = [
	["now", "刚刚"],
	["yesterday", "昨天"],
	// —— 纯数量（既有规则）——
	["2 seconds ago", "2 秒前"],
	["2 minutes ago", "2 分钟前"],
	["2 hours ago", "2 小时前"],
	["2 days ago", "2 天前"],
	["2 weeks ago", "2 周前"],
	["2 months ago", "2 个月前"],
	["2 years ago", "2 年前"],
	// —— 小数数量 ——
	["1.5 hours ago", "1.5 小时前"],
	["1.5 days ago", "1.5 天前"],
	// —— 冠词形态 ——
	["a second ago", "1 秒前"],
	["a minute ago", "1 分钟前"],
	["an hour ago", "1 小时前"],
	["a day ago", "1 天前"],
	["a week ago", "1 周前"],
	["a month ago", "1 个月前"],
	["a year ago", "1 年前"],
	// —— 模糊限定词（数量可省）——
	["less than a minute ago", "不到 1 分钟前"],
	["less than 2 minutes ago", "不到 2 分钟前"],
	["about a minute ago", "大约 1 分钟前"],
	["about 3 minutes ago", "大约 3 分钟前"],
	["over an hour ago", "超过 1 小时前"],
	["almost 2 days ago", "快 2 天前"],
	["half an hour ago", "半小时前"],
	["half a day ago", "半天前"],
	// —— 未来方向 ——
	["in a minute", "1 分钟后"],
	["in less than a minute", "1 分钟后"],
	["in about 2 hours", "2 小时后"],
];

describe("global 模块的相对时间变体", () => {
	it("translates every relative-time shape to Chinese", () => {
		for (const [node, expected] of RELATIVE_TIME_NODES) {
			expect(
				translateText(node, view),
				`相对时间 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("never leaves the relative-time unit word in english", () => {
		// 兜底网：pattern 若被改成漏掉某个前缀/小数形态，这里会因为「译文里还有 ago」
		// 或「根本没命中」而变红——比逐条断言更能抓住新出现的变体
		for (const [node] of RELATIVE_TIME_NODES) {
			const translated = translateText(node, view);
			expect(translated, node).not.toBeNull();
			expect(translated ?? "", node).not.toMatch(
				/\b(?:ago|yesterday|now)\b/i,
			);
		}
	});

	it("keeps prose that merely contains a duration in english", () => {
		// 反例：整段锚定意味着**只有整节点就是相对时间**时才翻；
		// 含时长的散文（issue 标题、README 句子）绝不会被规则命中
		for (const node of [
			"Updated 2 minutes ago",
			"I created this 2 minutes ago by mistake",
			"about the last 30 days",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});

describe("global 模块的实机节点边界", () => {
	it("translates every shell text node GitHub actually renders", () => {
		for (const node of GLOBAL_NODES) {
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

	it("translates the absolute dates shown in the file list", () => {
		// 文件列表的「最后提交日期」由 <relative-time> 渲染成绝对日期，实机原文形如
		// "Sep 26, 2026"（短月份），归 global 的 short-date-* 规则
		expect(translateText("Sep 26, 2026", view)).toBe(
			"2026 年 9 月 26 日",
		);
		expect(translateText("Dec 19, 2018", view)).toBe(
			"2018 年 12 月 19 日",
		);
	});

	it("keeps product names and owner names in english", () => {
		// 「Code」是词条（→ 代码），但「VS Code」是产品专名，整节点不收录
		expect(translateText("VS Code", view)).toBeNull();
		expect(translateText("microsoft", view)).toBeNull();
		expect(translateText("vscode", view)).toBeNull();
	});
});

/**
 * 行尾的关联拉取请求计数（「数字 + 名词」的通用计数行）。
 *
 * 实机证据：维护者 2026-10-18 两次贴出同一段 DOM，第二次补了页面地址
 * `https://github.com/Oppenheymu`（个人主页）：
 * `<span class="col-3 flex-shrink-0 f6 color-fg-muted width-auto text-right">`
 * 里只有 `2 pull requests` **一个文本节点**（节点边界与页面来源的回归见
 * `profile.test.ts` 的「行尾的拉取请求计数」一组）。
 *
 * 前两版分别把这份 pattern 挂在 pages/commits 与 pages/repo 上，实机都不生效——
 * 那段 DOM 只给了行结构、没给页面地址，而真正的页面命中 pages/profile；
 * 计数行本身又是 GitHub 的通用部件，故**改挂 global**：任何路径都接住，
 * 也不必为同一 pattern 在每个模块各收一份（同 `global/commits-count` 一类计数的做法）。
 *
 * 三条断言缺一不可：
 *   1. 数字动态 ⇒ 只能走规则（静态词条收不了任意数字）；千分位与单复数都要接住；
 *   2. 本视图必须查不到裸短语 `pull requests`：收了它，数字节点会单独留下、
 *      整行渲染成「个拉取请求」；
 *   3. 规则两端锚定，带尾巴的句子不归它管，不产出中英残句。
 */
describe("global 模块的拉取请求计数", () => {
	it("translates the count node on a non-profile path too", () => {
		// 用仓库页视图断言「挂在 global 上」这件事：个人主页由 profile.test.ts 守
		expect(translateText("2 pull requests", view)).toBe(
			"2 个拉取请求",
		);
		expect(translateText("1 pull request", view)).toBe(
			"1 个拉取请求",
		);
		expect(translateText("1,024 pull requests", view)).toBe(
			"1,024 个拉取请求",
		);
	});

	it("does not swallow the number through a bare phrase entry", () => {
		expect(translateText("pull requests", view)).toBeNull();
		expect(
			translateText("2 pull requests were merged", view),
		).toBeNull();
	});

	it("has a japanese template", () => {
		const japanese = buildView(
			"/microsoft/vscode",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("2 pull requests", japanese)).toBe(
			"2 件のプルリクエスト",
		);
		expect(translateText("1 pull request", japanese)).toBe(
			"1 件のプルリクエスト",
		);
	});
});

/**
 * 仓库名后的可见性标签（`Label Label--secondary`）。
 *
 * 实机证据：维护者 2026-10-02 在 `/Oppenheymu?tab=repositories` 贴的
 * `<span class="Label Label--secondary v-align-middle ml-1 mb-1">Public template</span>`
 * ——标签是**独立节点**，内容是「可见性 + 类型」拼成的固定短语。
 * 这类标签在仓库页头部同样出现（`Public` / `Private` / `Public archive` 早已收在 global），
 * 故整族都归 global，仓库页与个人主页共用。
 */
describe("global 模块的仓库可见性标签", () => {
	const LABELS: readonly (readonly [string, string])[] = [
		["Public", "公开"],
		["Private", "私有"],
		["Public template", "公开模板"],
		["Private template", "私有模板"],
		["Public archive", "公开归档"],
		["Archived", "已归档"],
	];

	it("translates every visibility label GitHub renders next to a repository name", () => {
		for (const [node, expected] of LABELS) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("leaves prose that merely contains those words alone", () => {
		// 反例：整节点精确匹配，散文 / 用户内容不会被这种多词短语命中
		for (const node of [
			"public template repository",
			"My public template",
			"template",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});

/**
 * 全局侧边栏（汉堡菜单）的导航词条。
 *
 * 实机证据：维护者 2026-10-25 的 /settings/applications 截图——菜单里「所有议题 /
 * 所有拉取请求 / 所有仓库 / 显示更多」早已由 global 翻出，而 Home / Feed /
 * Projects / Top repositories 留英文：它们只登记在 pages/dashboard、pages/profile
 * 等具体模块（Projects 甚至分散在三个模块），侧边栏却是全站组件，/settings 等
 * 路由吃不到 → 与「Your personal account」同型的路由互斥，五条进 global 同译兜底
 * （MCP registry 为全新键）。
 *
 * 裸 `Copilot`（菜单里的 Copilot 入口）**有意不收录**：品牌名无可译——译文同形
 * 禁令（"Copilot": "Copilot" 会让观察器无限自转），GitHub 官方中文界面同样保留英文。
 */
describe("global 模块的全局侧边栏菜单", () => {
	/** 用截图同款路径建视图：侧边栏在 /settings/* 由 global 兜底，具体模块不命中 */
	const sidebarView = buildView(
		"/settings/applications",
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);

	const SIDEBAR_NODES: readonly (readonly [
		string,
		string,
	])[] = [
		["Home", "主页"],
		["Feed", "动态"],
		["Projects", "项目"],
		["Top repositories", "热门仓库"],
		["MCP registry", "MCP 注册表"],
	];

	it("translates the sidebar entries on a non-dashboard path", () => {
		for (const [node, expected] of SIDEBAR_NODES) {
			expect(
				translateText(node, sidebarView),
				`未命中：${node}`,
			).toBe(expected);
		}
	});

	it("keeps the Copilot brand name in english", () => {
		expect(
			translateText("Copilot", sidebarView),
		).toBeNull();
	});

	it("has japanese templates too", () => {
		const japanese = buildView(
			"/settings/applications",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		for (const [node, expected] of [
			["Home", "ホーム"],
			["Feed", "フィード"],
			["Projects", "プロジェクト"],
			["Top repositories", "トップリポジトリ"],
			["MCP registry", "MCP レジストリ"],
		] as const) {
			expect(translateText(node, japanese), node).toBe(
				expected,
			);
		}
	});
});

/**
 * 头部搜索按钮的占位文案：`Type ` + `<kbd>/</kbd>` + ` to search`。
 *
 * 这里锁的是**词典层**的决定：整句键有效，两段碎片**没有词条**。碎片收不得——
 * `Type` 同形异义（页头读作「键入」、设置页正文读作「类型」，同页共存），
 * 只收后半段则只剩中英残句「Type / 以搜索」（维护者 2026-10-17 实机贴图确认）。
 *
 * 实机并不会因此留英文：引擎在「文本 + `<kbd>` + 文本」三段结构成立时，用整句键
 * 按 kbd 自身的文本切分回填（`输入 / 以搜索` → `输入 ` + `<kbd>/</kbd>` + ` 以搜索`）。
 * 切分规则、kbd 保护与「设置页正文的 Type 不受影响」由
 * `src/content/__tests__/walker.test.ts` 的「三段标签」一组锁住；本文件只守词典侧。
 *
 * 三个断言缺一不可：
 *   1. 整句键仍然有效（回填与上游单节点形态都靠它）；
 *   2. 两段碎片在 zh-CN 的词典里**必须查不到**：第 2 条一旦失败，通常就是有人
 *      把这条「顺手」收进了 global（设置页立刻会出现「类型 / 以搜索」）；
 *   3. 同形异义的另一面：设置页路径上 `Type` 仍由 pages/settings 译作「类型」。
 */
describe("global 模块的搜索占位符（kbd 断句）", () => {
	/** 设置页路径：pages/settings 在 global 之前，故 `Type` 由它胜出 */
	const settingsView = buildView(
		"/settings/profile",
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);

	it("translates the whole placeholder when it is a single node", () => {
		expect(translateText("Type / to search", view)).toBe(
			"输入 / 以搜索",
		);
	});

	it("keeps both halves out of the dictionary, so Type stays unambiguous", () => {
		expect(translateText("Type", view)).toBeNull();
		expect(translateText("to search", view)).toBeNull();
	});

	it("keeps the settings module's own Type label", () => {
		expect(translateText("Type", settingsView)).toBe(
			"类型",
		);
	});
});
