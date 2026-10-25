// 仓库安全中心（/owner/repo/security 及其子路径）的实机节点回归。
//
// 证据来源：维护者 2026-10-25 贴的 popup 漏翻导出（/Koishi-CE/koishi/security
// 全族七个子页，schema github-zh-misses/3），约 300 条。
//
// 模块是本次新建的：settings-security 是账号安全设置（/settings/security），
// 与仓库安全中心路由无关，此前整族页面靠 repo + global 裸奔。严重性档位沿用
// insights 的 Critical 严重 / High 高危体系；checks OK 徽标走 global/checks-ok
// （本次自 actions 组迁入 global）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const zh = dictForLocale("zh-CN");

/** 安全概览页命中的模块视图（pages/security + pages/repo + global） */
const view = buildView(
	"/Koishi-CE/koishi/security",
	zh,
	new Map(Object.entries(dictCore.aliases)),
);

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 引擎语义的节点拼接：命中则保留首尾空白写回（见 walker.ts 的 applyTextNode） */
function renderNodes(
	nodes: readonly string[],
	localeView: typeof view,
): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, localeView);
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

describe("安全中心的路由与静态词条", () => {
	it("matches /owner/repo/security and its subpages ahead of the repo fallback", () => {
		for (const path of [
			"/Koishi-CE/koishi/security",
			"/Koishi-CE/koishi/security/advisories",
			"/Koishi-CE/koishi/security/secret-scanning",
		]) {
			const names = matchModules(path, zh.modules).map(
				(module) => module.name,
			);
			expect(
				names.indexOf("pages/security"),
			).toBeGreaterThanOrEqual(0);
			// security 比 repo 的兜底更具体：同键异译时 security 先到先得
			expect(names.indexOf("pages/security")).toBeLessThan(
				names.indexOf("pages/repo"),
			);
		}
	});

	it("translates the sidebar navigation and its group headers", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Advisories", "安全公告"],
			["Code scanning", "代码扫描"],
			["Code quality", "代码质量"],
			["Malware", "恶意软件"],
			["Secret scanning", "密钥扫描"],
			["Vulnerabilities", "漏洞"],
			["Findings", "发现"],
			["Reporting", "报告"],
			["Agents", "代理"],
			["items", "项"],
		];
		for (const [node, expected] of NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("translates the Code Quality blankslate", () => {
		const NODES: readonly (readonly [string, string])[] = [
			[
				"Checking code scanning status...",
				"正在检查代码扫描状态…",
			],
			[
				"Code Quality is not enabled for this repository",
				"此仓库未启用代码质量",
			],
			["Enable Code Quality", "启用代码质量"],
			[
				"Enable Code Quality to start identifying and fixing code quality issues in your repository.",
				"启用代码质量，开始识别并修复仓库中的代码质量问题。",
			],
			[
				"Learn more about Code Quality",
				"了解有关代码质量的更多信息",
			],
		];
		for (const [node, expected] of NODES) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
		}
	});

	it("translates the alert list furniture across the alert subpages", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Loading tools", "正在加载工具"],
			["Tools", "工具"],
			["All alerts are resolved.", "所有告警均已解决。"],
			["Dismiss alerts", "忽略告警"],
			// 严重性档位（Critical 严重 / High 高危已由 insights 收录，不在本模块）
			["Error", "错误"],
			["Warning", "警告"],
			["Note", "注意"],
			["Medium", "中危"],
			["Low", "低危"],
			["Other", "其他"],
			["Filter alerts", "筛选告警"],
			["Filter by language", "按语言筛选"],
			["Filter by rule", "按规则筛选"],
			["Filter by severity", "按严重性筛选"],
			["Filter by tool", "按工具筛选"],
			["Keep up the good work!", "继续保持！"],
			["Newest", "最新"],
			["Oldest", "最早"],
			["Least recently updated", "最早更新"],
			["Severity", "严重性"],
			["selected", "已选中"],
			["No open alerts", "无打开的告警"],
			[
				"There are no open Dependabot alerts for this repository.",
				"此仓库没有打开的 Dependabot 告警。",
			],
			[
				"There are no open Malware alerts for this repository.",
				"此仓库没有打开的恶意软件告警。",
			],
			["ProTip!", "小贴士！"],
			// ProTip 说明句碎片：链接与句号是独立节点（查询语法 / 纯符号，均不收）
			[
				"Find alerts on your dev dependencies using",
				"查找开发依赖告警时可使用",
			],
			[
				"See auto-dismissed alerts with",
				"查看已自动忽略的告警可使用",
			],
			["No secrets found.", "未找到密钥。"],
			["Secret scanning alerts", "密钥扫描告警"],
			["Validity", "有效性"],
			["Secret type", "密钥类型"],
			["Provider", "提供商"],
			["Select all alerts", "全选告警"],
			[
				"Your repository doesn't have any unresolved secrets.",
				"此仓库没有任何未解决的密钥。",
			],
			["Active", "有效"],
			["Unknown", "未知"],
		];
		for (const [node, expected] of NODES) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
		}
	});

	it("translates counters, titles and tooltips through rules", () => {
		// 公告列表的计数 tab（数字动态）
		expect(translateText("0 Triage", view)).toBe(
			"0 个待处理",
		);
		expect(translateText("3 Draft", view)).toBe("3 个草稿");
		expect(translateText("12 Published", view)).toBe(
			"12 个已发布",
		);
		expect(translateText("0 Closed", view)).toBe(
			"0 个已关闭",
		);
		// 告警列表头部的状态计数
		expect(translateText("0 Open", view)).toBe("0 个打开");
		// 各子页的浏览器标签页标题（仓库名捕获保留）
		expect(
			translateText("Overview · Koishi-CE/koishi", view),
		).toBe("概览 · Koishi-CE/koishi");
		expect(
			translateText(
				"Security Advisories · Koishi-CE/koishi",
				view,
			),
		).toBe("安全公告 · Koishi-CE/koishi");
		expect(
			translateText(
				"Code scanning alerts · Koishi-CE/koishi",
				view,
			),
		).toBe("代码扫描告警 · Koishi-CE/koishi");
		expect(
			translateText(
				"Dependabot alerts · Koishi-CE/koishi",
				view,
			),
		).toBe("Dependabot 告警 · Koishi-CE/koishi");
		expect(
			translateText(
				"Secret scanning · Koishi-CE/koishi",
				view,
			),
		).toBe("密钥扫描 · Koishi-CE/koishi");
		expect(
			translateText(
				"Security Policy · Koishi-CE/koishi",
				view,
			),
		).toBe("安全策略 · Koishi-CE/koishi");
		expect(
			translateText(
				"Malware alerts · Koishi-CE/koishi",
				view,
			),
		).toBe("恶意软件告警 · Koishi-CE/koishi");
		expect(
			translateText(
				"Code quality · Standard findings · Koishi-CE/koishi",
				view,
			),
		).toBe("代码质量 · 标准发现 · Koishi-CE/koishi");
		// 公告筛选框的 aria-label / placeholder（查询串捕获保留）
		expect(
			translateText(
				"Filter advisories: severity:critical, ecosystem:npm",
				view,
			),
		).toBe(
			"筛选安全公告：severity:critical, ecosystem:npm",
		);
		// 提供商 / 密钥类型筛选弹窗的 sr-only 计数
		expect(
			translateText("Found 0 out of 0 items.", view),
		).toBe("在 0 项中找到 0 项");
		expect(
			translateText("Found 4 out of 21 items.", view),
		).toBe("在 21 项中找到 4 项");
		// 页头「更多 X 选项」tooltip（Dependabot 专名捕获原样）
		expect(
			translateText("More Dependabot options", view),
		).toBe("更多 Dependabot 选项");
		expect(
			translateText("More Malware options", view),
		).toBe("更多 Malware 选项");
		// checks OK 徽标：自 actions 组迁入 global 后本页直接命中
		expect(translateText("6 / 8 checks OK", view)).toBe(
			"6 / 8 项检查通过",
		);
	});

	it("keeps product names, languages, query syntax and user content in english", () => {
		for (const node of [
			"Dependabot", // 左侧导航的产品名
			"CodeQL", // 扫描引擎产品名
			"TypeScript", // Filter by language 的语言档位（Vue / SCSS / JavaScript / HTML / Smarty 同理）
			".github/SECURITY.md", // 文件路径
			"is:open", // 查询语法
			"is", // 查询语法碎片
			"scope:development", // ProTip 链接（查询语法）
			"resolution:auto-dismissed", // 同上
			"Koishi-CE", // 组织名
			"koishi", // 仓库名
			"M. Oppenheymu", // 用户名
			"@Koishi-CE", // 头像 alt
			"GitHub", // 品牌名
			"alt shift r", // 切换仓库快捷键的 sr-only 提示
			".", // ProTip 尾句号（独立纯符号节点）
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});

	it("has japanese templates for the navigation, alerts and rules", () => {
		const japanese = buildView(
			"/Koishi-CE/koishi/security",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Advisories", japanese)).toBe(
			"アドバイザリ",
		);
		expect(translateText("Secret scanning", japanese)).toBe(
			"シークレットスキャン",
		);
		expect(translateText("Vulnerabilities", japanese)).toBe(
			"脆弱性",
		);
		expect(translateText("Dismiss alerts", japanese)).toBe(
			"アラートを無視",
		);
		expect(translateText("Medium", japanese)).toBe("中");
		expect(
			translateText("No secrets found.", japanese),
		).toBe("シークレットが見つかりません。");
		expect(translateText("0 Triage", japanese)).toBe(
			"0 件のトリアージ",
		);
		expect(
			translateText(
				"Overview · Koishi-CE/koishi",
				japanese,
			),
		).toBe("概要 · Koishi-CE/koishi");
		expect(
			translateText(
				"Filter advisories: severity:critical, ecosystem:npm",
				japanese,
			),
		).toBe(
			"アドバイザリをフィルター：severity:critical, ecosystem:npm",
		);
		expect(
			translateText("Found 4 out of 21 items.", japanese),
		).toBe("21 件中 4 件見つかりました");
		expect(
			translateText("More Dependabot options", japanese),
		).toBe("その他の Dependabot オプション");
		// checks OK 徽标的日语模板随规则迁入 global 后照常命中
		expect(translateText("6 / 8 checks OK", japanese)).toBe(
			"6 / 8 件のチェックが成功",
		);
	});
});

describe("二次导出补漏的筛选栏、弹窗与页头菜单", () => {
	it("translates the filter bar trio and the remaining advisory blankslates", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Available filters", "可用筛选器"],
			[
				"Clear current search query, filters, and sorts",
				"清除当前搜索查询、筛选器和排序",
			],
			["Clear filters", "清除筛选器"],
			[
				"There aren't any triage security advisories",
				"暂无待处理的安全公告",
			],
			[
				"There aren't any draft security advisories",
				"暂无安全公告草稿",
			],
			[
				"There aren't any closed security advisories",
				"暂无已关闭的安全公告",
			],
			["Manifest", "清单文件"],
			["Package", "包"],
			["open alerts", "打开的告警"],
		];
		for (const [node, expected] of NODES) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
		}
	});

	it("translates the select panel skeleton and the overflow menu", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Filter items", "筛选项目"],
			[
				"Items will be filtered as you type",
				"输入时会自动筛选项目",
			],
			["No options available", "无可用选项"],
			["Filter by manifest", "按清单文件筛选"],
			["Filter by package", "按包筛选"],
			["Filter by ecosystem", "按生态系统筛选"],
			["Search manifest options", "搜索清单文件选项"],
			["Search package options", "搜索包选项"],
			["Search ecosystem options", "搜索生态系统选项"],
			["Search severity options", "搜索严重性选项"],
			["Manifest path", "清单文件路径"],
			["Package name", "包名"],
			["Give feedback", "反馈"],
			[
				"Manage Advanced Security",
				"管理 Advanced Security",
			],
			["Manage Dependabot rules", "管理 Dependabot 规则"],
			["Manage account notifications", "管理账号通知"],
			["Opens in a new tab", "在新标签页中打开"],
			[
				"Reprocess your project's current dependency files.",
				"重新处理项目的当前依赖文件。",
			],
		];
		for (const [node, expected] of NODES) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
		}
		// 「Refresh Dependabot alerts」被拆成三节点：Refresh / <产品名> / alerts，
		// 产品名不翻（拼接实机为「刷新 Dependabot 告警」，节点间空白由引擎保留）
		expect(translateText("Refresh", view)).toBe("刷新");
		expect(translateText("alerts", view)).toBe("告警");
		expect(translateText("Dependabot", view)).toBeNull();
		// 高级筛选按钮：无计数走静态键，带计数走规则
		expect(
			translateText("Advanced filter dialog", view),
		).toBe("高级筛选对话框");
		expect(
			translateText(
				"Advanced filter dialog: 1 valid filter",
				view,
			),
		).toBe("高级筛选对话框：1 个有效筛选器");
	});

	it("assembles the ProTip patch hint around the query-syntax link", () => {
		// 「ProTip! Add -has:patch to see alerts without an available fix.」：
		// 链接（查询语法）与句号外的三节点逐段命中，链接本身不翻
		expect(translateText("Add", view)).toBe("添加");
		expect(translateText("-has:patch", view)).toBeNull();
		expect(
			translateText(
				"to see alerts without an available fix.",
				view,
			),
		).toBe("以查看没有可用修复的告警。");
		// EPSS 是漏洞利用预测评分系统的缩写，专有名词不翻
		expect(translateText("EPSS", view)).toBeNull();
	});

	it("has japanese templates for the patched fragments", () => {
		const japanese = buildView(
			"/Koishi-CE/koishi/security/dependabot",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Refresh", japanese)).toBe("更新");
		expect(translateText("alerts", japanese)).toBe(
			"アラート",
		);
		expect(
			translateText(
				"Items will be filtered as you type",
				japanese,
			),
		).toBe("入力すると項目が絞り込まれます");
		expect(
			translateText(
				"Advanced filter dialog: 1 valid filter",
				japanese,
			),
		).toBe(
			"詳細フィルターダイアログ：1 件の有効なフィルター",
		);
		expect(
			translateText(
				"to see alerts without an available fix.",
				japanese,
			),
		).toBe(
			"すると、利用可能な修正のないアラートが表示されます。",
		);
	});
});

describe("三次导出补漏的告警空态与 Closed as 筛选组", () => {
	it("translates the alert blankslates and the Closed as filter skeleton", () => {
		// 证据：/NapukettoDev/NapukettoQQ/security/{advisories,code-scanning,
		// dependabot} 三次导出——空态骨架是代码扫描的，其余告警页也预渲染
		const NODES: readonly (readonly [string, string])[] = [
			[
				"There aren't any code scanning alerts yet",
				"暂无代码扫描告警",
			],
			[
				"As alerts are created, they'll appear here.",
				"告警创建后会显示在这里。",
			],
			[
				"No results matched your search.",
				"没有与你的搜索匹配的结果。",
			],
			[
				"You can upload code scanning analyses from other third-party tools using GitHub Actions.",
				"你可以使用 GitHub Actions 上传来自其他第三方工具的代码扫描分析。",
			],
			[
				"You can run CodeQL locally using Visual Studio Code.",
				"你可以使用 Visual Studio Code 在本地运行 CodeQL。",
			],
			["Closed as", "关闭原因"],
			["Filter by closed as", "按关闭原因筛选"],
			["Filter by closure reason", "按关闭原因筛选"],
			["Select closed as option", "选择关闭原因选项"],
			["Search closed as options", "搜索关闭原因选项"],
			["All dismissed", "全部忽略"],
			["False positive", "误报"],
			["Used in tests", "用于测试"],
			["Won't fix", "不予修复"],
			["Mitigated", "已缓解"],
		];
		for (const [node, expected] of NODES) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
		}
	});

	it("translates the Dependabot closure reasons and the reopen tooltip", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Auto-dismissed", "自动忽略"],
			["Fix started", "已开始修复"],
			["Inaccurate", "不准确"],
			["No bandwidth", "无暇处理"],
			["Not used", "未使用"],
			["Tolerable risk", "可接受的风险"],
			["Fixed", "已修复"],
			["Reopen", "重新打开"],
			[
				"Some selected alerts have been fixed and cannot be reopened.",
				"部分已选告警已修复，无法重新打开。",
			],
			["No closed alerts", "无已关闭的告警"],
			[
				"There are no closed Dependabot alerts for this repository.",
				"此仓库没有已关闭的 Dependabot 告警。",
			],
			// 与 open alerts 同形态的 section aria-label
			["closed alerts", "已关闭的告警"],
			[
				"Malware alerts are disabled.",
				"恶意软件告警已停用。",
			],
			["alerts are not enabled.", "告警未启用。"],
			["Refresh is unavailable.", "刷新不可用。"],
		];
		for (const [node, expected] of NODES) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
		}
	});

	it("assembles the malware-enrollment sentence across the settings link", () => {
		// 三节点拼接：说明句（实机带尾随空格）+ 链接 + 独立句号节点；
		// 中文把「在 <链接> 中启用」语序提前，前段以冒号收尾，句号不收保持英文
		expect(translateText(".", view)).toBeNull();
		expect(
			renderNodes(
				[
					"To receive Malware alerts, you must first enable Malware alerts in ",
					"this repository's settings",
					".",
				],
				view,
			),
		).toBe(
			"若要接收恶意软件告警，必须先在以下位置启用恶意软件告警： 此仓库的设置.",
		);
	});

	it("keeps query syntax, language names and brand labels in english", () => {
		// 导出里的噪音：查询语法 token 与 protip 链接、语言名与品牌名裸词
		// （撞仓库语言 / 用户内容）、head 里 <link title> 元数据均不收
		for (const node of [
			"is:open",
			"is:closed",
			"scope:development",
			"resolution:auto-dismissed",
			"TypeScript",
			"Shell",
			"CodeQL",
			"Dependabot",
			"GitHub",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});

	it("has japanese templates for the closure reasons and the enrollment sentence", () => {
		const japanese = buildView(
			"/Koishi-CE/koishi/security/dependabot",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Closed as", japanese)).toBe(
			"クローズ理由",
		);
		expect(
			translateText("Filter by closed as", japanese),
		).toBe("クローズ理由でフィルター");
		expect(translateText("False positive", japanese)).toBe(
			"誤検知",
		);
		expect(translateText("Auto-dismissed", japanese)).toBe(
			"自動的に無視",
		);
		expect(translateText("Reopen", japanese)).toBe(
			"再オープン",
		);
		expect(
			translateText(
				"There aren't any code scanning alerts yet",
				japanese,
			),
		).toBe("コードスキャンのアラートはまだありません");
		expect(
			translateText(
				"No results matched your search.",
				japanese,
			),
		).toBe("検索に一致する結果がありません。");
		expect(
			translateText("Refresh is unavailable.", japanese),
		).toBe("更新は利用できません。");
		// 拼接形态与 zh 同构：前段以コロン收尾，句号节点保持英文
		expect(
			renderNodes(
				[
					"To receive Malware alerts, you must first enable Malware alerts in ",
					"this repository's settings",
					".",
				],
				japanese,
			),
		).toBe(
			"マルウェアアラートを受け取るには、まず次の場所でマルウェアアラートを有効にする必要があります： このリポジトリの設定.",
		);
	});
});
