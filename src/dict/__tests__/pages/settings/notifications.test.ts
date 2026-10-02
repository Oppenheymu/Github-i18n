// 通知设置页（/settings/notifications）实机文本节点回归。
//
// 为什么单独锁这一页：
//   1. 本页的键整批来自开发者模式导出的漏翻 JSON（2026-09 该页会话），导出记录的是
//      **逐个文本节点的 trimmed 原文**——长说明句被链接拆开后的碎片、React 对话框里的
//      勾选框文案、设置页外壳的侧栏标签都在里面。这是「不凭视觉整句登记键」的唯一依据，
//      故把这份清单原样锁在这里；
//   2. 本页有四处拼接必须成立（链接把句子切成多段，译文要能直接接上）：
//      关注仓库说明句 + 链接、Dependabot 说明句（链接在中间）、工作流运行说明句
//      （链接在句尾）、通知渠道摘要行（"Notify me:" + "on …"）；
//   3. 用户内容与纯专名 / 纯缩写**必须不被翻译**：邮箱、昵称、头像 alt、
//      `GitHub Actions`、`CLI`、`Copilot`。门禁要求译文含中文字系，这类词条正确做法
//      就是不收录（未命中即保留英文），这里反向断言，防止后人「补」成死键或造出循环。
//
// 实机节点清单来源：popup 开发者模式导出的 github-zh-misses/1 JSON，path 全为
// /settings/notifications。截图另确认了三个只在展开时才渲染的弹窗文案
// （Select notification channels / On GitHub / Only notify for failed workflows），
// 已在下方标注。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /settings 子树命中的模块视图（pages/settings + pages/profile + pages/repo + global） */
const view = buildView(
	"/settings/notifications",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/**
 * 导出的漏翻文本节点（原文逐字录入，不做 trim——引擎自己会归一空白）。
 * 顺序按页面上出现的先后排列，便于人工对照实机。
 */
const NOTIFICATION_NODES: readonly string[] = [
	// —— 设置页外壳：页面名、范围切换器、左侧栏 ——
	"Notification Settings",
	"User settings",
	"Switch",
	"context",
	"settings",
	"Menu",
	"Type",
	"AI usage",
	"Cloud agent",
	"Credentials",
	"Moderation",
	"Sessions",
	"Access",
	"Licensing",
	"Features",
	"Usage",
	// —— 默认通知邮箱 ——
	"Default notifications email",
	"Choose where you'd like emails to be sent. You can add more email addresses. Use custom routes to specify different email addresses to be used for individual organizations.",
	"Custom routing",
	// —— 订阅 ——
	"Subscriptions",
	"Notifications for all repositories, teams, or conversations you're watching.",
	"View watched repositories",
	"Participating, @mentions and custom",
	"Notifications for the conversations you are participating in, or if someone cites you with an @mention. Also for all activity when subscribed to specific events.",
	"Customize email updates",
	"Choose which additional events you'll receive emails for when participating or watching.",
	// 「Customize email updates」旁已选事件的摘要串（顺序固定，整串一个节点）
	"Reviews, Pushes, Comments",
	"Ignored repositories",
	"You'll never be notified.",
	"View ignored repositories",
	// —— 系统 ——
	"System",
	// 链接是纯专名 GitHub Actions（不收录）→ 该节点是链接前的片段
	"Notifications for workflow runs on repositories set up with",
	"Dependabot alerts: New vulnerabilities",
	// 链接 Dependabot alerts 把说明句切成两段
	"When you're given access to",
	"automatically receive notifications when a new vulnerability is found in one of your dependencies.",
	"Dependabot alerts",
	"Dependabot alerts: Email digest",
	"Email a regular summary of Dependabot alerts for up to 10 of your repositories.",
	"Security campaign emails",
	"Receive email notifications about security campaigns in repositories where you have access to security alerts.",
	"Agent sessions",
	"Notifications for agent sessions that you started.",
	"'Deploy key' alert email",
	"When you are given admin permissions to an organization, automatically receive notifications when a new deploy key is added.",
	"In-product messages",
	"Get tips, solutions and exclusive offers from GitHub about products, services and events we think you might find interesting.",
	// —— 通知渠道摘要行与频率下拉 ——
	"Notify me:",
	"on GitHub, Email",
	"on GitHub, Email, CLI",
	"Failed workflows only",
	// 「Select notification channels」弹窗里的勾选框（截图确认，展开时才渲染）
	"On GitHub",
	"Email",
	"Only notify for failed workflows",
	// 邮件摘要频率下拉（"Send weekly" 同时也是下拉的当前值，见导出）
	"Send weekly",
];

/** 全局模块的快捷跳转提示（与已有的 g then n / g then d 同模板） */
const SHORTCUT_NODES: readonly string[] = [
	"g then i",
	"g then p",
];

/**
 * 用户内容与纯专名 / 纯缩写：字面上含拉丁字母，会通过「可翻译判定」，
 * 但**必须**保持英文——收录它们要么让译文与键同形（自触发循环，门禁也会拒），
 * 要么把用户名 / 邮箱当成 UI 文案改坏。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"oppenheymu@gmail.com",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
	"GitHub",
	"GitHub Actions",
	"CLI",
	"Copilot",
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

describe("通知设置页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of [
			...NOTIFICATION_NODES,
			...SHORTCUT_NODES,
		]) {
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

	it("keeps user content, product names and abbreviations as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the watched/ignored blurb with its trailing link", () => {
		// 实机边界：`<p>Notifications … watching. <a>View watched repositories</a>.</p>`
		// ——链接文本不含句点，句点是纯符号节点（翻不了，保持英文句点）
		const watched = renderNodes([
			"Notifications for all repositories, teams, or conversations you're watching. ",
			"View watched repositories",
			".",
		]);
		expect(watched).toBe(
			"你正在关注的所有仓库、团队或会话的通知。 查看已关注的仓库.",
		);
		const ignored = renderNodes([
			"You'll never be notified. ",
			"View ignored repositories",
			".",
		]);
		expect(ignored).toBe(
			"你永远不会收到通知。 查看已忽略的仓库.",
		);
	});

	it("renders the Dependabot blurb with the link in the middle", () => {
		// 实机边界：`When you're given access to <a>Dependabot alerts</a> automatically receive …`
		// 链接节点两侧的源码空格由 walker 原样保留，故拼接结果里「警报／的」之间有一个空格
		const rendered = renderNodes([
			"When you're given access to ",
			"Dependabot alerts",
			" automatically receive notifications when a new vulnerability is found in one of your dependencies.",
		]);
		expect(rendered).toBe(
			"获得 Dependabot 警报 的访问权限后，当你的某个依赖中发现新漏洞时，你会自动收到通知。",
		);
	});

	it("renders the workflow blurb with the link at the end of the sentence", () => {
		// 实机边界：`Notifications … set up with <a>GitHub Actions</a>.`——链接之后的节点
		// 只有纯符号 "."（翻不了），所以中文只能把「仓库需已设置」放在链接之前。
		// GitHub Actions 是纯专名（不收录、保留英文），"." 保持英文句点。
		const rendered = renderNodes([
			"Notifications for workflow runs on repositories set up with ",
			"GitHub Actions",
			".",
		]);
		expect(rendered).toBe(
			"工作流运行通知：仓库需已设置 GitHub Actions.",
		);
		for (const raw of ["GitHub Actions", "."]) {
			expect(rendered).toContain(raw);
		}
	});

	it("renders the notification channel summary line", () => {
		// 实机边界：`Notify me:` + `on <渠道列表>` 两个节点拼成一行，句点是纯符号节点
		expect(
			renderNodes([
				"Notify me:",
				" ",
				"on GitHub, Email",
				".",
			]),
		).toBe("通知我： 在 GitHub 上、电子邮件.");
		// 勾选「只对失败的 workflow 通知」时，摘要行末尾追加括注
		expect(
			renderNodes([
				"Notify me:",
				" ",
				"on GitHub, Email",
				".",
				" (",
				"Failed workflows only",
				")",
			]),
		).toBe(
			"通知我： 在 GitHub 上、电子邮件. (仅失败的工作流)",
		);
		expect(
			renderNodes([
				"Notify me:",
				" ",
				"on GitHub, Email, CLI",
				".",
			]),
		).toBe("通知我： 在 GitHub 上、电子邮件、CLI.");
	});

	it("covers the remaining channel combinations of the same template", () => {
		// 渠道顺序恒为 GitHub → Email → CLI，摘要行是「on 」+ 已选渠道的连接结果。
		// 导出里只见到 GitHub+Email 与 GitHub+Email+CLI 两种组合，其余按同一模板补齐；
		// 单独的 "on CLI" 无法给出含中文的译文（门禁要求），保留英文。
		expect(translateText("on GitHub", view)).toBe(
			"在 GitHub 上",
		);
		expect(translateText("on Email", view)).toBe(
			"电子邮件",
		);
		expect(translateText("on GitHub, CLI", view)).toBe(
			"在 GitHub 上、CLI",
		);
		expect(translateText("on Email, CLI", view)).toBe(
			"电子邮件、CLI",
		);
		expect(translateText("on CLI", view)).toBeNull();
	});

	it("keeps the channel checkboxes and the summary apart", () => {
		// 勾选框是 "On GitHub"（大写 O），摘要行是 "on GitHub"（小写 o）：两条键互不顶替
		expect(translateText("On GitHub", view)).toBe(
			"在 GitHub 上",
		);
		expect(translateText("Email", view)).toBe("电子邮件");
		expect(
			translateText("Select notification channels", view),
		).toBe("选择通知渠道");
		expect(
			translateText(
				"Only notify for failed workflows",
				view,
			),
		).toBe("仅对失败的工作流发送通知");
	});

	it("keeps the email digest frequencies apart", () => {
		expect(translateText("Don't send", view)).toBe(
			"不发送",
		);
		expect(translateText("Send weekly", view)).toBe(
			"每周发送",
		);
		expect(translateText("Send daily", view)).toBe(
			"每天发送",
		);
	});

	it("keeps the two Dependabot rows apart", () => {
		expect(
			translateText(
				"Dependabot alerts: New vulnerabilities",
				view,
			),
		).toBe("Dependabot 警报：新漏洞");
		expect(
			translateText(
				"Dependabot alerts: Email digest",
				view,
			),
		).toBe("Dependabot 警报：邮件摘要");
	});

	it("overrides the Actions section heading with the GitHub Actions wording", () => {
		// 本页那个区块标题指的是 GitHub Actions；pages/repo 的同键译文「操作」是别的语义，
		// 本模块在前故压过它（有意同键异译，视图快照里记的就是这条）
		expect(translateText("Actions", view)).toBe(
			"Actions 工作流",
		);
	});

	it("translates the shortcut hints like the existing g then n / g then d", () => {
		expect(translateText("g then i", view)).toBe(
			"g 然后 i",
		);
		expect(translateText("g then p", view)).toBe(
			"g 然后 p",
		);
	});
});
