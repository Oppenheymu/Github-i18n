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
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

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
