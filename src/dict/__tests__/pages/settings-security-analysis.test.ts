// 安全与分析页（/settings/security_analysis）实机文本与属性回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，`path` 全为 /settings/security_analysis），含源码换行的长条目
// 按**原样**录入（引擎先 normalizeKey 折叠空白）。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. 每个功能卡片都有「默认对新仓库启用 / 全部启用 / 全部禁用」这类**动作文案**，
//      以及一条「你即将…」确认句；确认句**除私密漏洞报告那一对外都是静态串**，
//      那一对含动态账户名（`… in Oppenheymu.`），走
//      `settings/enable-` / `settings/disable-private-vulnerability-reporting-all` 规则；
//   2. 推送保护说明句被链接切成三段：`Block commits that contain` + `supported secrets`
//      + `across all public repositories on GitHub.`（第三段承担「的提交（适用于…）」的收尾）；
//   3. 页面里那批 snake_case 字面量（`security_alerts` / `dependency_graph` /
//      `private_vulnerability_reporting` / `dependabot_self_hosted` /
//      `vulnerability_updates` / `vulnerability_updates_grouping` / `push_protection_user`）
//      是 DOM / 模板里的键名，**不收录**（与 OAuth 范围标识符同一取舍）。
//
// 刻意**不收录**（下方反例断言）：功能标识符、纯专名 `Dependabot` / `GitHub`，
// 以及用户名、头像 alt 等用户内容。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /settings/security_analysis 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/security_analysis",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（原文逐字录入，含实机存在的内部换行与缩进） */
const ANALYSIS_NODES: readonly string[] = [
	"Security & analysis",
	// —— 页面级说明 ——
	"Security and analysis features help keep your repositories secure and updated.",
	"Security and analysis features help keep your repositories secure and updated. By enabling these features, you're granting us permission to perform read-only analysis on your repositories.",
	"Security and analysis features help keep you secure and updated, wherever you are.",
	// —— 通用开关文案 ——
	"Enable by default for new repositories",
	"Automatically enable for new repositories",
	"Enable by default for new private repositories",
	"Enable by default for new public repositories",
	"Automatically enable for new public repositories",
	"Enable all",
	"Disable all",
	"User",
	// —— 依赖项关系图 ——
	"Dependency graph",
	"Understand your dependencies.",
	"Enable dependency graph",
	"Disable dependency graph",
	"Enable all dependency graph",
	"Disable all dependency graph",
	// —— Dependabot 警报与安全更新 ——
	"Enable Dependabot alerts",
	"Disable Dependabot alerts",
	"Enable all Dependabot alerts",
	"Disable all Dependabot alerts",
	"Dependabot security updates",
	"Enable Dependabot security updates",
	"Disable Dependabot security updates",
	"Enable all Dependabot security updates",
	"Disable all Dependabot security updates",
	"Keep your dependencies secure and up-to-date.",
	"Receive alerts for vulnerabilities that affect your dependencies and manually generate Dependabot pull requests to resolve these vulnerabilities.",
	"Enabling this option will result in Dependabot automatically attempting to open pull requests to resolve every open Dependabot alert with an available patch.",
	"Learn more about Dependabot",
	"Configure alert notifications",
	// —— 分组安全更新 ——
	"Grouped security updates",
	"Enable grouped security updates",
	"Disable grouped security updates",
	"Enable all grouped security updates",
	"Disable all grouped security updates",
	"Learn how to group updates.",
	"Groups all available updates that resolve a Dependabot alert into one pull request (per package manager and directory of requirement manifests). This option may be overridden by group rules specified in dependabot.yml -",
	// —— Dependabot 自托管 ——
	"Dependabot on self-hosted runners",
	"Run Dependabot security and version updates on self-hosted Actions runners.",
	"Enable dependabot self-hosted",
	"Disable dependabot self-hosted",
	"Enable all dependabot self-hosted",
	"Disable all dependabot self-hosted",
	// —— 私密漏洞报告 ——
	"Private vulnerability reporting",
	"Allow your community to privately report potential security vulnerabilities to maintainers and repository owners.",
	"Enable private vulnerability reporting",
	"Disable private vulnerability reporting",
	"Enable all private vulnerability reporting",
	"Disable all private vulnerability reporting",
	"Learn more about private vulnerability reporting",
	// 含动态账户名的确认句（规则覆盖）
	"You're about to enable private vulnerability reporting on all public repositories in Oppenheymu.",
	"You're about to disable private vulnerability reporting on all public repositories in Oppenheymu.",
	// —— 推送保护 ——
	"Push protection for yourself",
	"Block commits that contain",
	"supported secrets",
	"across all public repositories on GitHub.",
	"Disable push protection",
	"Disable push protection for yourself",
	"Pushes that contain secrets will not be blocked.",
	// —— 各功能的确认句 ——
	"You're about to enable dependency graph on all your private repositories.",
	"You're about to disable dependency graph on all your private repositories. This will also disable Dependabot alerts and Dependabot security updates on those repositories.",
	"You're about to enable Dependabot alerts on all your repositories.\n      Alerts require the dependency graph, so we'll also turn that on for all repositories.\n      No notifications will be sent while Dependabot alerts are being enabled.",
	"You're about to disable Dependabot alerts on all your repositories. This will also disable Dependabot security updates on those repositories.",
	"You're about to enable Dependabot security updates on all your repositories. Dependabot security updates require the dependency graph and Dependabot alerts, so we'll also turn that on for all repositories.",
	"You're about to disable Dependabot security updates on all your repositories.",
	"You're about to enable grouped security updates on all your repositories. Grouped security updates require the dependency graph, Dependabot alerts, Dependabot security updates and Dependabot security updates, so we'll also turn that on for all repositories.",
	"You're about to disable grouped security updates on all your repositories.",
	"You're about to enable dependabot self-hosted on all your repositories. Dependabot self-hosted depends on Dependabot on Actions so we'll also turn that on for all repositories.",
	"You're about to disable dependabot self-hosted on all your repositories.",
];

/** 必须保持英文的实机节点：功能标识符、纯专名与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"security_alerts",
	"dependency_graph",
	"private_vulnerability_reporting",
	"dependabot_self_hosted",
	"vulnerability_updates",
	"vulnerability_updates_grouping",
	"push_protection_user",
	"Dependabot",
	"GitHub",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n  `];
}

/** 把一段实机节点序列按 walker 的语义过一遍并拼接成页面上的那一行 */
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

describe("安全与分析页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of ANALYSIS_NODES) {
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

	it("keeps feature identifiers, brand names and user content as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the generic switch labels", () => {
		expect(translateText("Enable all", view)).toBe(
			"全部启用",
		);
		expect(translateText("Disable all", view)).toBe(
			"全部禁用",
		);
		expect(
			translateText(
				"Enable by default for new repositories",
				view,
			),
		).toBe("默认对新仓库启用");
		expect(
			translateText(
				"Automatically enable for new private repositories",
				view,
			),
		).toBeNull(); // 实机只见证了 public 形态，未收的保留英文
		expect(
			translateText(
				"Automatically enable for new public repositories",
				view,
			),
		).toBe("自动对新公开仓库启用");
		expect(translateText("User", view)).toBe("用户");
	});

	it("translates the dependency-graph and Dependabot cards", () => {
		expect(translateText("Dependency graph", view)).toBe(
			"依赖项关系图",
		);
		expect(
			translateText("Understand your dependencies.", view),
		).toBe("了解你的依赖项。");
		expect(
			translateText("Enable all dependency graph", view),
		).toBe("启用所有依赖项关系图");
		expect(
			translateText("Dependabot security updates", view),
		).toBe("Dependabot 安全更新");
		expect(
			translateText("Learn more about Dependabot", view),
		).toBe("详细了解 Dependabot");
		expect(
			translateText("Configure alert notifications", view),
		).toBe("配置警报通知");
		expect(
			translateText("Grouped security updates", view),
		).toBe("分组安全更新");
		expect(
			translateText("Learn how to group updates.", view),
		).toBe("了解如何对更新进行分组。");
		expect(
			translateText(
				"Dependabot on self-hosted runners",
				view,
			),
		).toBe("在自托管运行器上使用 Dependabot");
	});

	it("renders the private-vulnerability-reporting confirmations through the rules", () => {
		// 账户名是动态值，整句走规则、按原样带回；启用 / 禁用各一条规则
		expect(
			translateText(
				"You're about to enable private vulnerability reporting on all public repositories in Oppenheymu.",
				view,
			),
		).toBe(
			"你即将在 Oppenheymu 的所有公开仓库中启用私密漏洞报告。",
		);
		expect(
			translateText(
				"You're about to disable private vulnerability reporting on all public repositories in octocat.",
				view,
			),
		).toBe(
			"你即将在 octocat 的所有公开仓库中禁用私密漏洞报告。",
		);
		// 同一批确认句里其余几条都是静态串，直接命中词典
		expect(
			translateText(
				"You're about to disable Dependabot alerts on all your repositories. This will also disable Dependabot security updates on those repositories.",
				view,
			),
		).toBe(
			"你即将在你所有的仓库中禁用 Dependabot 警报。这同时会在这些仓库中禁用 Dependabot 安全更新。",
		);
		expect(
			translateText(
				"You're about to enable grouped security updates on all your repositories. Grouped security updates require the dependency graph, Dependabot alerts, Dependabot security updates and Dependabot security updates, so we'll also turn that on for all repositories.",
				view,
			),
		).toBe(
			"你即将在你所有的仓库中启用分组安全更新。分组安全更新需要依赖项关系图、Dependabot 警报、Dependabot 安全更新和 Dependabot 安全更新，因此我们也会为所有仓库开启它们。",
		);
	});

	it("renders the push-protection sentence across its three nodes", () => {
		// 实机：`Block commits that contain <a>supported secrets</a> across all public repositories on GitHub.`
		expect(
			renderNodes([
				"Block commits that contain",
				" ",
				"supported secrets",
				" ",
				"across all public repositories on GitHub.",
			]),
		).toBe(
			"阻止包含 受支持的机密 的提交（适用于 GitHub 上的所有公开仓库）。",
		);
		expect(
			translateText("Push protection for yourself", view),
		).toBe("针对你个人的推送保护");
		expect(
			translateText("Disable push protection", view),
		).toBe("禁用推送保护");
		expect(
			translateText(
				"Pushes that contain secrets will not be blocked.",
				view,
			),
		).toBe("包含机密的推送将不会被阻止。");
	});
});
