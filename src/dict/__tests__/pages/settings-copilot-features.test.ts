// Copilot 功能设置页（/settings/copilot/features）实机文本与属性回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，`path` 全为 /settings/copilot/features），没有途径 B
// （Console 逐节点采集）的证据，故按「导出条目本身就是一个文本节点」登记；
// 含源码换行的长条目按**原样**录入（引擎先 normalizeKey 折叠空白）。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. 说明句普遍被链接切开，且**句号常常落在后一个节点上**（`". When disabled, …"`、
//      `". Enforcement begins …"`），译文必须以「。」起头，拼接后才读得通；
//   2. 「自动模型选择」那句是四段拼接：`If enabled, you may be served` + `evaluation models`
//      + `through` + `Copilot Auto model selection`——连接词 `through` 单独成节点，
//      译文用「，来自」把它接成一句；
//   3. Copilot Spaces 的三组说明是「`If enabled, …` + 链接 + `". When disabled, …"`」三段；
//   4. 用量摘要是动态百分比（`14% used` / `30% used`），走
//      `settings/copilot-usage-percent` 规则；
//   5. 产品名（`Copilot` / `GitHub Copilot` / `Copilot CLI` / `Copilot Spaces`）与组织名
//      保留英文——它们中间夹在句子里时，中文句子照样成立（见 Copilot Spaces 的拼接断言）。
//
// 刻意**不收录**（下方反例断言）：产品名与组织名、用户名等用户内容，
// 以及 `Buy Copilot Business for <组织名>` 这类**属性里的动态值**（属性不适用规则）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /settings/copilot/features 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/copilot/features",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（原文逐字录入，含实机存在的内部换行与缩进） */
const FEATURE_NODES: readonly string[] = [
	// —— 套餐与用量 ——
	"Get Copilot from an organization",
	"Organizations can provide their members (including you) and their teams access to GitHub Copilot.",
	"Buy Copilot Business",
	"Upgrade plan",
	"Upgrade your Copilot plan for higher usage limits, premium models, AI reviews and more.",
	"Included credits",
	"14% used",
	"30% used",
	// —— 可见性与入口 ——
	"Visibility",
	"Show Copilot",
	"Enable Copilot for all GitHub features, including navigation bar, search, and dashboard.",
	"When disabled, Copilot will be hidden and unavailable. This setting does not apply to Copilot search on GitHub Docs.",
	"Dashboard Entry Point",
	"Allows instant chatting when landing on GitHub.com",
	"Copilot Chat in GitHub.com",
	"You can use Copilot Chat in GitHub.com. Preview features are only available for paid licenses.",
	"Learn more about Copilot in GitHub.com",
	// —— 状态徽标 ——
	"Allowed",
	"Blocked",
	"Coming soon",
	"You will have access to the feature",
	"You won't have access to the feature",
	// —— 云端代理 / 应用 / CLI ——
	"Copilot cloud agent",
	"Delegate tasks to Copilot cloud agent in repositories where it is enabled",
	"GitHub Copilot app",
	"It can take up to 30 minutes for the changes to take effect. Restart your code editor for the changes to take effect immediately.",
	"GitHub Copilot for assistance in terminal",
	"GitHub Copilot for assistance in GitHub Desktop",
	"Copilot in GitHub Desktop",
	// —— 提交信息与内联建议 ——
	"Copilot-generated commit messages",
	"Allow Copilot to suggest commit messages when you make changes on GitHub.com.",
	"Learn more about Copilot-generated commit messages.",
	"Inline suggestions",
	"Suggestions matching public code",
	"Copilot can allow or block suggestions matching public code. Learn more about",
	"GitHub Copilot will show suggestions matching public code.",
	"GitHub Copilot won't show suggestions matching public code.",
	// —— 联网搜索 ——
	"Copilot can search the web",
	"Copilot can answer questions about new trends and give improved answers, via Bing. See",
	// —— MCP ——
	"MCP servers in Copilot",
	"Connect MCP servers to Copilot in\n                all Copilot editors and Copilot cloud agent.",
	// —— 自动模型选择（四段）——
	"Copilot Auto model selection",
	"Evaluation models in Copilot auto model selection",
	"If enabled, you may be served",
	"evaluation models",
	"through",
	// —— Copilot Spaces（三组「启用 / 禁用」）——
	"Copilot Spaces Individual Access",
	"Copilot Spaces Individual Sharing",
	"If enabled, you can view and create",
	"If enabled, you can create individually owned",
	"If enabled, you can share individually owned",
	". When disabled, you cannot view or create any Copilot Spaces.",
	". When disabled, you cannot create individual spaces.",
	". When disabled, you cannot share individual spaces.",
	// —— 内联代码建议 ——
	"If enabled you can use",
	"code suggestions",
	// —— 语义索引 ——
	"Semantic indexing for Non-GitHub Repositories",
	"You can use the",
	"to index your non-GitHub repositories in VSCode.",
	"You can use",
	// —— 数据使用与隐私 ——
	"Allow GitHub to use my data for AI model training",
	"Allow GitHub to collect and use my Inputs, Outputs, and associated context to train and improve AI models. Read more in the",
	"GitHub's Privacy Statement",
	"Microsoft Privacy Statement",
	"Privacy Statement",
	"For more information about the data your organization receives regarding your use of GitHub Copilot, please review",
	"Learn more.",
	// —— 云端访问策略与新版本说明 ——
	"Enables access to Copilot in the cloud, including GitHub.com and GitHub Mobile. This policy replaces previous Copilot Chat and Copilot cloud agent policies.",
	". Enforcement begins July 27th, 2026 in version 1.1 of the GitHub Copilot app. The Copilot CLI policy continues to govern the GitHub Copilot App until version 1.1\n",
];

/**
 * 必须保持英文的实机节点：产品名与用户内容，
 * 以及含动态组织名、结构上无法翻译的 aria-label。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Copilot",
	"GitHub Copilot",
	"Copilot CLI",
	"Copilot Spaces",
	"GitHub",
	"Koishi-CE",
	"Kuro-Bridge",
	"NapukettoDev",
	"OppenApps",
	"TextCraft-War",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
	"Buy Copilot Business for Koishi-CE",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白，最后拼接成页面上真实看到的那一行。
 */
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

describe("Copilot 功能设置页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of FEATURE_NODES) {
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

	it("keeps product names, organization names and dynamic attributes as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the usage percentages through the rule", () => {
		expect(translateText("14% used", view)).toBe(
			"已使用 14%",
		);
		expect(translateText("30% used", view)).toBe(
			"已使用 30%",
		);
		expect(translateText("100% used", view)).toBe(
			"已使用 100%",
		);
		// 同模块的其它数字串不受影响
		expect(translateText("14%", view)).toBeNull();
	});

	it("renders the plan block", () => {
		expect(
			translateText(
				"Get Copilot from an organization",
				view,
			),
		).toBe("从组织获取 Copilot");
		expect(
			translateText(
				"Organizations can provide their members (including you) and their teams access to GitHub Copilot.",
				view,
			),
		).toBe(
			"组织可以为其成员（包括你）及其团队提供 GitHub Copilot 访问权限。",
		);
		expect(
			translateText("Buy Copilot Business", view),
		).toBe("购买 Copilot Business");
		expect(translateText("Upgrade plan", view)).toBe(
			"升级方案",
		);
		expect(translateText("Included credits", view)).toBe(
			"所含点数",
		);
	});

	it("renders the auto-model-selection sentence across its four nodes", () => {
		// 实机：`If enabled, you may be served` + 链接 + `through` + 链接
		// ——连接词单独成节点，译文用「，来自」把它接成一句
		expect(
			renderNodes([
				"If enabled, you may be served",
				" ",
				"evaluation models",
				" ",
				"through",
				" ",
				"Copilot Auto model selection",
			]),
		).toBe(
			"启用后，你可能会获得 评估模型 ，来自 Copilot 自动模型选择",
		);
		expect(
			translateText(
				"Evaluation models in Copilot auto model selection",
				view,
			),
		).toBe("Copilot 自动模型选择中的评估模型");
	});

	it("renders the Copilot Spaces rows with the product name kept in English", () => {
		// 实机：`If enabled, you can create individually owned` + <a>Copilot Spaces</a> + `". When disabled, …"`
		expect(
			renderNodes([
				"If enabled, you can create individually owned",
				" ",
				"Copilot Spaces",
				". When disabled, you cannot create individual spaces.",
			]),
		).toBe(
			"启用后，你可以创建个人拥有的 Copilot Spaces。禁用后，你无法创建个人空间。",
		);
		expect(
			renderNodes([
				"If enabled, you can share individually owned",
				" ",
				"Copilot Spaces",
				". When disabled, you cannot share individual spaces.",
			]),
		).toBe(
			"启用后，你可以共享个人拥有的 Copilot Spaces。禁用后，你无法共享个人空间。",
		);
		expect(
			renderNodes([
				"If enabled, you can view and create",
				" ",
				"Copilot Spaces",
				". When disabled, you cannot view or create any Copilot Spaces.",
			]),
		).toBe(
			"启用后，你可以查看和创建 Copilot Spaces。禁用后，你无法查看或创建任何 Copilot Spaces。",
		);
		expect(
			translateText(
				"Copilot Spaces Individual Access",
				view,
			),
		).toBe("Copilot Spaces 个人访问");
	});

	it("renders the privacy fragments across their link boundaries", () => {
		// 实机：`Allow GitHub to collect … Read more in the <a>GitHub's Privacy Statement</a>.`
		expect(
			renderNodes([
				"Allow GitHub to collect and use my Inputs, Outputs, and associated context to train and improve AI models. Read more in the",
				" ",
				"GitHub's Privacy Statement",
				".",
			]),
		).toBe(
			"允许 GitHub 收集并使用我的输入、输出及相关上下文来训练和改进 AI 模型。详见 GitHub 隐私声明.",
		);
		expect(
			translateText(
				"Allow GitHub to use my data for AI model training",
				view,
			),
		).toBe("允许 GitHub 使用我的数据训练 AI 模型");
		// 联网搜索句 + 链接
		expect(
			renderNodes([
				"Copilot can answer questions about new trends and give improved answers, via Bing. See",
				" ",
				"Microsoft Privacy Statement",
				".",
			]),
		).toBe(
			"Copilot 可以通过 Bing 回答有关新趋势的问题并给出更好的回答。请参阅 Microsoft 隐私声明.",
		);
		// 公开代码匹配句 + 链接
		expect(
			renderNodes([
				"Copilot can allow or block suggestions matching public code. Learn more about",
				" ",
				"Suggestions matching public code",
			]),
		).toBe(
			"Copilot 可以允许或阻止与公开代码匹配的建议。详细了解 与公开代码匹配的建议",
		);
	});

	it("renders the inline-suggestions and semantic-indexing rows", () => {
		expect(
			renderNodes([
				"If enabled you can use",
				" ",
				"code suggestions",
				".",
			]),
		).toBe("启用后，你可以使用 代码建议.");
		expect(
			translateText(
				"Semantic indexing for Non-GitHub Repositories",
				view,
			),
		).toBe("为非 GitHub 仓库建立语义索引");
		// 中间的链接是产品名（保留英文），可见拼接仍然通顺
		expect(
			renderNodes([
				"You can use the",
				" ",
				"GitHub Copilot app",
				" to index your non-GitHub repositories in VSCode.",
			]),
		).toBe(
			"你可以使用 GitHub Copilot 应用 在 VSCode 中为你的非 GitHub 仓库建立索引。",
		);
	});

	it("renders the visibility block and the version note", () => {
		expect(translateText("Visibility", view)).toBe(
			"可见性",
		);
		expect(translateText("Show Copilot", view)).toBe(
			"显示 Copilot",
		);
		expect(
			translateText(
				"When disabled, Copilot will be hidden and unavailable. This setting does not apply to Copilot search on GitHub Docs.",
				view,
			),
		).toBe(
			"禁用后，Copilot 将被隐藏且不可用。此设置不适用于 GitHub Docs 上的 Copilot 搜索。",
		);
		expect(
			translateText(
				"Enables access to Copilot in the cloud, including GitHub.com and GitHub Mobile. This policy replaces previous Copilot Chat and Copilot cloud agent policies.",
				view,
			),
		).toBe(
			"允许在云端（包括 GitHub.com 和 GitHub Mobile）使用 Copilot。此策略将取代此前的 Copilot Chat 和 Copilot 云端代理策略。",
		);
		// 以句号起头的节点：译文同样以「。」起头，拼接后不出现双句号
		expect(
			translateText(
				". Enforcement begins July 27th, 2026 in version 1.1 of the GitHub Copilot app. The Copilot CLI policy continues to govern the GitHub Copilot App until version 1.1",
				view,
			),
		).toBe(
			"。该强制执行自 2026 年 7 月 27 日起在 GitHub Copilot 应用 1.1 版中生效。在 1.1 版之前，Copilot CLI 策略继续管辖 GitHub Copilot 应用",
		);
	});
});
