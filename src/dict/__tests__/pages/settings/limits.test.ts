// 交互限制 / 代码审查限制 / 已屏蔽用户 / 组织
// （/settings/interaction_limits、/settings/code_review_limits、/settings/blocked_users、
// /settings/organizations）实机文本与属性回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，四条 path 各一份），没有途径 B（Console 逐节点采集）的证据，
// 故按「导出条目本身就是一个文本节点」登记；含内部换行的长条目按 normalizeKey 折叠空白
// 后的形态写。**/settings/enterprises 不在导出清单里**（当时没采集到），它的四条键来自
// 维护者粘贴的**实机 HTML**（blankslate：H2 + 说明段 + 按钮 + 链接），是更强的证据形态。
//
// 这四页最关键的边界事实（都在下方断言里锁住）：
//   1. 屏蔽弹窗的两条清单条目与两个开关都是独立文本节点；备注框的剩余字数动态变化
//      （`250 characters remaining.`），走 `settings/characters-remaining` 规则；
//   2. 「你的账户的 <a>public repositories</a> 中可能已存在交互限制。…」被链接切成三段，
//      **句号属于链接后的那个节点**，故第三条键以 `. ` 起头、译文以「中。」起头——
//      拼接后才读得通（renderNodes 断言锁住）；
//   3. 代码审查限制的两段说明都是**含源码换行的单个节点**，折叠空白后才等于词典键；
//   4. 组织列表的「离开组织」确认弹窗整句含动态组织名，走
//      `settings/leave-organization-confirm` 规则；而 `Settings for <组织名>` 是
//      **aria-label**——属性不适用规则，只能保留英文（反例断言钉住）；
//   5. 属性只走精确命中：`Block user` / `Find blocked users` / `results` 三个无障碍文案
//      与一个 placeholder 都可收（它们与同文案的文本节点共用同一个键）。
//
// 刻意**不收录**（下方反例断言）：
//   - 用户内容：组织名 `Koishi-CE` / `Kuro-Bridge` / `NapukettoDev` / `OppenApps` /
//     `TextCraft-War`、`M. Oppenheymu` / `(Oppenheymu)` / `@Oppenheymu`；
//   - 纯专名 / 缩写：`GitHub`、`Copilot`。
// 未命中即保留英文，这才是正确做法。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 按路径取该页的合并视图（pages/settings + global + 各页专属模块） */
function viewFor(pathname: string) {
	return buildView(
		pathname,
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);
}

const blockedView = viewFor("/settings/blocked_users");
const limitsView = viewFor("/settings/interaction_limits");
const reviewView = viewFor("/settings/code_review_limits");
const orgsView = viewFor("/settings/organizations");
const enterprisesView = viewFor("/settings/enterprises");

/** /settings/blocked_users 的实机文本节点 */
const BLOCKED_NODES: readonly string[] = [
	"Block a user",
	"You can block a user to deny them access to repositories and more.",
	"Learn more about blocking a user",
	"Search by username, full name or email address",
	"Block user",
	// 屏蔽弹窗
	"You are about to block:",
	"Blocking a user prevents the following on all your repositories:",
	"opening or commenting on issues or pull requests",
	"adding or editing wiki pages",
	"follow your account's public activity",
	"starring, forking, or watching",
	"send you notifications by @mentioning your username in public repositories",
	"invite you as a collaborator to their repositories",
	"Additionally, blocked users are not able to:",
	"Close all open issues, pull requests, and discussions opened by this user",
	"Add an optional note",
	"Maximum 250 characters. Please don’t include any personal information such as legal names or email addresses. Markdown is supported. This note will only be visible to you.",
	"250 characters remaining.",
	"Warn me when blocked users have contributed to a repository",
	"We will show this warning each time you visit a repository where someone you blocked has committed code, unless you own the repository or have also contributed a commit. This warning does not restrict your access.",
	// 下方「已屏蔽」区块
	"Currently blocked",
	"You have not blocked anyone.",
	"Find blocked users",
	"Search by username, full name, or public email",
];

/** /settings/blocked_users 的实机可翻译属性（与同文案的文本节点同键） */
const BLOCKED_ATTRS: readonly string[] = [
	"Block user",
	"Find blocked users",
	"results",
];

/** /settings/interaction_limits 的实机文本节点 */
const LIMITS_NODES: readonly string[] = [
	"Temporary interaction limits",
	"Temporarily restrict which external users can interact with your repositories (comment, open issues, or create pull requests) for a configurable period of time.",
	"Enable interaction limits for:",
	// 三档限制对象：短标签 + 长说明
	"Limit to existing users",
	"Users that have recently created their account will be unable to interact with your repositories.",
	"Limit to prior contributors",
	"Users that have not previously committed to the default branch of one of your repositories will be unable to interact with that repository.",
	"Limit to repository collaborators",
	"Users that are not collaborators of one of your repositories will not be able to interact with that repository.",
	"New users",
	"Users",
	"Contributors",
	"Collaborators",
	// 五档时长选项
	"24 hours",
	"3 days",
	"1 week",
	"1 month",
	"6 months",
	// 说明句与「已有限制」提示（三段被链接切开）
	'This may be used to force a "cool-down" period during heated discussions or prevent unwanted interactions.',
	"Interaction limits may already exist in your account's",
	"public repositories",
	".\n    Any changes here will override those limits.",
];

/** /settings/interaction_limits 的三个无障碍属性（精确命中） */
const LIMITS_ATTRS: readonly string[] = [
	"Enable interaction limit to existing users",
	"Enable interaction limit to prior contributors",
	"Enable interaction limit to repository collaborators",
];

/** /settings/code_review_limits 的实机文本节点（两段说明都含源码换行） */
const REVIEW_NODES: readonly string[] = [
	"Restrict users who are permitted to approve or request changes on pull requests in your public repositories.",
	'Code review limits are currently managed individually for all repositories. Enable limits to permit only\n            users who have explicitly been granted access to each repository to submit reviews that "approve" or\n            "request changes". Remove limits to allow all users to submit pull request reviews. All users able to submit\n            comment pull request reviews will continue to be able to do so.',
	"Limit reviews on all repositories",
	"Remove review limits from all repositories",
	"Code review limits may already be specified by individual repositories. Any changes here will override those\n        limits until unset.",
];

/** /settings/organizations 的实机文本节点（含动态组织名的确认弹窗，走规则） */
const ORGANIZATION_NODES: readonly string[] = [
	"Your personal account cannot be converted to an organization.\n    You must create a new organization and transfer your repositories and projects to it instead.\n    You can then rename your personal account and the organization if you want your organization to have the\n    same name that you are currently using for your personal account.",
	"Move work to an organization",
	"Move to an organization",
	"Compare plans",
	"2FA required",
	"Leave",
	"Leave organization",
	"Are you positive you want to leave Koishi-CE? You will lose access to all repositories and teams.",
];

/**
 * 必须保持英文的实机节点：组织名、用户名与纯专名，
 * 以及含动态组织名、结构上无法翻译的 aria-label。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Koishi-CE",
	"Kuro-Bridge",
	"NapukettoDev",
	"OppenApps",
	"TextCraft-War",
	"Settings for Koishi-CE",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
	"GitHub",
	"Copilot",
];

/**
 * /settings/enterprises 的实机节点（证据是维护者粘贴的 outerHTML）。
 * H2 与说明段在 HTML 里都带源码缩进与换行，这里按归一后的键录入，
 * 另用 withWhitespace 覆盖带缩进的形态。
 */
const ENTERPRISES_NODES: readonly string[] = [
	"You don't have any enterprises",
	"Designed for businesses or teams who collaborate on GitHub.com",
	"Start free for 30 days",
	"Learn more about enterprises",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白，最后拼接成页面上真实看到的那一行。
 */
function renderNodes(
	nodes: readonly string[],
	view: ReturnType<typeof viewFor>,
): string {
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

describe("已屏蔽用户页（/settings/blocked_users）的实机节点边界", () => {
	it("translates every text node and attribute GitHub actually renders", () => {
		for (const node of [
			...BLOCKED_NODES,
			...BLOCKED_ATTRS,
		]) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					blockedView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the page header and the two search boxes", () => {
		expect(translateText("Block a user", blockedView)).toBe(
			"屏蔽用户",
		);
		expect(
			translateText(
				"You can block a user to deny them access to repositories and more.",
				blockedView,
			),
		).toBe("你可以屏蔽用户，以禁止其访问你的仓库等。");
		expect(
			translateText(
				"Learn more about blocking a user",
				blockedView,
			),
		).toBe("详细了解如何屏蔽用户");
		// 上方的搜索串（无牛津逗号）与下方「已屏蔽」区块的搜索串（有逗号、且是 public email）
		// 是两个不同的键
		expect(
			translateText(
				"Search by username, full name or email address",
				blockedView,
			),
		).toBe("按用户名、全名或电子邮件地址搜索");
		expect(
			translateText(
				"Search by username, full name, or public email",
				blockedView,
			),
		).toBe("按用户名、全名或公开电子邮箱搜索");
		expect(
			translateText("Find blocked users", blockedView),
		).toBe("查找已屏蔽的用户");
		expect(translateText("results", blockedView)).toBe(
			"结果",
		);
		expect(
			translateText(
				"You have not blocked anyone.",
				blockedView,
			),
		).toBe("你还没有屏蔽任何人。");
		expect(
			translateText("Currently blocked", blockedView),
		).toBe("已屏蔽");
	});

	it("renders the block dialog lists and the note field", () => {
		expect(
			translateText("You are about to block:", blockedView),
		).toBe("你即将屏蔽：");
		expect(
			translateText(
				"Blocking a user prevents the following on all your repositories:",
				blockedView,
			),
		).toBe("屏蔽用户后，会在你的所有仓库中阻止以下操作：");
		expect(
			renderNodes(
				[
					"opening or commenting on issues or pull requests",
					"adding or editing wiki pages",
					"follow your account's public activity",
					"starring, forking, or watching",
					"send you notifications by @mentioning your username in public repositories",
					"invite you as a collaborator to their repositories",
					"Additionally, blocked users are not able to:",
				],
				blockedView,
			),
		).toBe(
			"打开议题或拉取请求，或对其发表评论添加或编辑 wiki 页面关注你账户的公开动态星标、复刻或关注在公开仓库中通过 @ 提及你的用户名向你发送通知邀请你作为其仓库的协作者此外，被屏蔽的用户无法进行以下操作：",
		);
		expect(
			translateText(
				"Close all open issues, pull requests, and discussions opened by this user",
				blockedView,
			),
		).toBe("关闭此用户打开的所有议题、拉取请求和讨论");
		expect(
			translateText("Add an optional note", blockedView),
		).toBe("添加可选备注");
		expect(
			translateText(
				"Maximum 250 characters. Please don’t include any personal information such as legal names or email addresses. Markdown is supported. This note will only be visible to you.",
				blockedView,
			),
		).toBe(
			"最多 250 个字符。请不要包含任何个人信息，例如法定姓名或电子邮箱地址。支持 Markdown。此备注仅你自己可见。",
		);
		// 剩余字数走规则（数字动态、单复数同形）
		expect(
			translateText(
				"250 characters remaining.",
				blockedView,
			),
		).toBe("剩余 250 个字符。");
		expect(
			translateText("1 character remaining.", blockedView),
		).toBe("剩余 1 个字符。");
		expect(
			translateText(
				"Warn me when blocked users have contributed to a repository",
				blockedView,
			),
		).toBe("当被屏蔽的用户曾为仓库做出贡献时提醒我");
		expect(
			translateText(
				"We will show this warning each time you visit a repository where someone you blocked has committed code, unless you own the repository or have also contributed a commit. This warning does not restrict your access.",
				blockedView,
			),
		).toBe(
			"当你访问的仓库中有你屏蔽过的用户提交过代码时，我们会显示此警告——除非该仓库归你所有，或你本人也曾提交过。此警告不会限制你的访问。",
		);
	});
});

describe("临时交互限制页（/settings/interaction_limits）的实机节点边界", () => {
	it("translates every text node and attribute GitHub actually renders", () => {
		for (const node of [...LIMITS_NODES, ...LIMITS_ATTRS]) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					limitsView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the three limit targets and the five durations", () => {
		expect(
			translateText(
				"Temporary interaction limits",
				limitsView,
			),
		).toBe("临时交互限制");
		expect(
			translateText(
				"Temporarily restrict which external users can interact with your repositories (comment, open issues, or create pull requests) for a configurable period of time.",
				limitsView,
			),
		).toBe(
			"在可配置的一段时间内，临时限制哪些外部用户可与你的仓库交互（发表评论、打开议题或创建拉取请求）。",
		);
		expect(
			translateText(
				"Enable interaction limits for:",
				limitsView,
			),
		).toBe("为以下对象启用交互限制：");
		expect(
			translateText("Limit to existing users", limitsView),
		).toBe("限制为现有用户");
		expect(
			translateText(
				"Limit to prior contributors",
				limitsView,
			),
		).toBe("限制为之前的贡献者");
		expect(
			translateText(
				"Limit to repository collaborators",
				limitsView,
			),
		).toBe("限制为仓库协作者");
		// 短标签（与别模块同键同译）
		expect(translateText("New users", limitsView)).toBe(
			"新用户",
		);
		expect(translateText("Users", limitsView)).toBe("用户");
		expect(translateText("Contributors", limitsView)).toBe(
			"贡献者",
		);
		expect(translateText("Collaborators", limitsView)).toBe(
			"协作者",
		);
		// 五档时长选项（固定枚举，静态键）
		expect(translateText("24 hours", limitsView)).toBe(
			"24 小时",
		);
		expect(translateText("3 days", limitsView)).toBe(
			"3 天",
		);
		expect(translateText("1 week", limitsView)).toBe(
			"1 周",
		);
		expect(translateText("1 month", limitsView)).toBe(
			"1 个月",
		);
		expect(translateText("6 months", limitsView)).toBe(
			"6 个月",
		);
	});

	it("renders the existing-limits hint across its split nodes", () => {
		// 实机：`Interaction limits may already exist in your account's <a>public repositories</a>. Any changes …`
		// ——句号落在链接之后的节点上，所以那段译文以「中。」起头
		const rendered = renderNodes(
			[
				"Interaction limits may already exist in your account's",
				" ",
				"public repositories",
				".\n    Any changes here will override those limits.",
			],
			limitsView,
		);
		expect(rendered).toBe(
			"交互限制可能已存在于你的账户的 公开仓库中。此处的任何更改都会覆盖那些限制。",
		);
		expect(
			translateText(
				'This may be used to force a "cool-down" period during heated discussions or prevent unwanted interactions.',
				limitsView,
			),
		).toBe(
			"这可用于在激烈讨论期间强制设置「冷却」期，或防止不受欢迎的交互。",
		);
	});
});

describe("代码审查限制页（/settings/code_review_limits）的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of REVIEW_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					reviewView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the blurb and the two buttons", () => {
		expect(
			translateText(
				"Restrict users who are permitted to approve or request changes on pull requests in your public repositories.",
				reviewView,
			),
		).toBe(
			"限制哪些用户可以在你的公开仓库中对拉取请求进行批准或请求更改。",
		);
		// 含源码换行的单个节点，折叠空白后命中
		expect(
			translateText(
				'Code review limits are currently managed individually for all repositories. Enable limits to permit only\n            users who have explicitly been granted access to each repository to submit reviews that "approve" or\n            "request changes". Remove limits to allow all users to submit pull request reviews. All users able to submit\n            comment pull request reviews will continue to be able to do so.',
				reviewView,
			),
		).toBe(
			"代码审查限制目前由各个仓库单独管理。启用限制后，只有已明确获得每个仓库访问权限的用户才能提交「批准」或「请求更改」的审查。移除限制则允许所有用户提交拉取请求审查。所有能够提交评论式拉取请求审查的用户仍可继续这样做。",
		);
		expect(
			translateText(
				"Limit reviews on all repositories",
				reviewView,
			),
		).toBe("限制所有仓库的审查");
		expect(
			translateText(
				"Remove review limits from all repositories",
				reviewView,
			),
		).toBe("移除所有仓库的审查限制");
		expect(
			translateText(
				"Code review limits may already be specified by individual repositories. Any changes here will override those\n        limits until unset.",
				reviewView,
			),
		).toBe(
			"代码审查限制可能已由各个仓库单独指定。此处的更改在这些限制被取消之前会覆盖它们。",
		);
	});
});

describe("组织设置页（/settings/organizations、/settings/enterprises）的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of ORGANIZATION_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, orgsView);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps organization names and the dynamic aria-label as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, orgsView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the personal-account notice and the organization row", () => {
		expect(
			translateText(
				"Your personal account cannot be converted to an organization.\n    You must create a new organization and transfer your repositories and projects to it instead.\n    You can then rename your personal account and the organization if you want your organization to have the\n    same name that you are currently using for your personal account.",
				orgsView,
			),
		).toBe(
			"你的个人账户无法转换为组织。你需要改为创建一个新组织，并将你的仓库和项目转移到该组织。如果你希望该组织使用你当前个人账户所用的名称，可以随后重命名你的个人账户和该组织。",
		);
		expect(
			translateText(
				"Move work to an organization",
				orgsView,
			),
		).toBe("将工作迁移到组织");
		expect(
			translateText("Move to an organization", orgsView),
		).toBe("迁移到组织");
		expect(translateText("Compare plans", orgsView)).toBe(
			"比较方案",
		);
		expect(translateText("2FA required", orgsView)).toBe(
			"需要双因素认证",
		);
		// 按钮文案与它自己的 aria-label 同串
		expect(translateText("Leave", orgsView)).toBe("离开");
		expect(
			translateText("Leave organization", orgsView),
		).toBe("离开组织");
	});

	it("renders the leave-organization dialog through the dynamic rule", () => {
		// 组织名是动态值，整句走 settings/leave-organization-confirm 规则、按原样带回
		expect(
			translateText(
				"Are you positive you want to leave Koishi-CE? You will lose access to all repositories and teams.",
				orgsView,
			),
		).toBe(
			"你确定要离开 Koishi-CE 吗？你将失去对所有仓库和团队的访问权限。",
		);
	});

	it("renders the /settings/enterprises blankslate from the pasted HTML", () => {
		// 该页不在漏翻导出里，四条键来自维护者粘贴的 outerHTML（blankslate）。
		// H2 与说明段在 HTML 里都带源码缩进与换行，两种形态都必须命中。
		for (const node of ENTERPRISES_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					enterprisesView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
		// 实机 HTML：`<h2 class="blankslate-heading">        You don't have any enterprises\n</h2>`
		// ——注意是**直撇号**，与实机形态逐字一致
		expect(
			translateText(
				"        You don't have any enterprises\n",
				enterprisesView,
			),
		).toBe("你还没有任何企业");
		expect(
			translateText(
				"          Designed for businesses or teams who collaborate on GitHub.com\n",
				enterprisesView,
			),
		).toBe("专为在 GitHub.com 上协作的企业或团队打造");
		// 两个动作：按钮（Button-label 的文本节点）与文档链接
		expect(
			translateText(
				"\n    Start free for 30 days\n  ",
				enterprisesView,
			),
		).toBe("免费试用 30 天");
		expect(
			translateText(
				"Learn more about enterprises",
				enterprisesView,
			),
		).toBe("详细了解企业");
	});
});
