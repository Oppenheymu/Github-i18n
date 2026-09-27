// 仓库设置页的「网络钩子」两支（/owner/repo/settings/hooks 列表页与 …/hooks/new 新建页）
// 实机文本回归。
//
// 证据：维护者 2026-09-27 贴出的**未装扩展**的实机 HTML（新建页），这是权威的节点边界；
// 列表页仍只有截图，那句说明改由 repo-settings/webhooks-intro 规则承担（撇号直弯都覆盖）。
//
// 本页最关键的四条边界事实（都由实机 HTML 证实，不是推断）：
//   1. 必填标记 `*` 是独立的 `<span aria-hidden="true">`，故标签键是 `Payload URL` / `Content type`
//      而不是带星号的整串；
//   2. `(not recommended)` 被独立的 `<span class="f6">` 包住，与前面的 `Disable` 分成两条键；
//   3. 说明段里的 `POST` 与 `x-www-form-urlencoded` 都在 `<code>` 里（排除容器，引擎不翻），
//      但 `<em>etc</em>` **不在**排除清单里、照常翻译——故整段在实机是五个文本节点；
//      两段 `<code>` 之间的 `, ` 是纯符号节点，引擎翻不了（保留英文逗号），拼接处会看到它；
//   4. 三个选项标签里前两个被 `<code>` / `<strong>` 切开（`Just the` + `push` + `event.`、
//      `Send me` + `everything` + `.`），只有第三条是整节点。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** 两支同属一个模块（规则是模块级的，故一份视图即可覆盖） */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/hooks/new",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 表单、说明段与确认弹层的实机节点 */
const NODES: readonly (readonly [string, string])[] = [
	["Add webhook", "添加网络钩子"],
	["Webhooks Guide", "网络钩子指南"],
	// `*` 独立成节点，故标签键不带星号
	["Payload URL", "负载 URL"],
	["Content type", "内容类型"],
	["Secret", "机密"],
	["SSL verification", "SSL 验证"],
	[
		"By default, we verify SSL certificates when delivering payloads.",
		"默认情况下，我们在投递负载时会验证 SSL 证书。",
	],
	["Enable SSL verification", "启用 SSL 验证"],
	["Disable", "禁用"],
	["(not recommended)", "（不推荐）"],
	[
		"Which events would you like to trigger this webhook?",
		"你希望哪些事件触发此网络钩子？",
	],
	["Just the", "仅"],
	["event.", "事件。"],
	["Send me", "发送给我"],
	["everything", "所有内容"],
	[
		"Let me select individual events.",
		"让我选择单个事件。",
	],
	[
		"We will deliver event details when this hook is triggered.",
		"此钩子触发时，我们将投递事件详情。",
	],
	// 说明段的五个节点（POST 与 x-www-form-urlencoded 在 <code> 里，不在其中）
	["We'll send a", "我们会发送一个"],
	[
		"request to the URL below with details of any subscribed events. You can also specify which data format you'd like to receive (JSON,",
		"请求到你下方提供的 URL，其中包含所订阅事件的详情。你还可以指定希望接收的数据格式（JSON、",
	],
	["etc", "等等"],
	[
		"). More information can be found in",
		"）。更多信息可在",
	],
	["our developer documentation", "我们的开发者文档"],
	// 禁用 SSL 验证的确认弹层
	["Are you sure?", "确定吗？"],
	["Close", "关闭"],
	["Warning", "警告"],
	[
		": Disabling SSL verification has serious implications.",
		"：禁用 SSL 验证会造成严重后果。",
	],
	[
		"SSL verification helps ensure that hook payloads are delivered to your URL endpoint securely, keeping your data away from prying eyes. Disabling this option is",
		"SSL 验证有助于确保钩子负载安全地投递到你的 URL 端点，让你的数据远离窥探。禁用此选项",
	],
	["not recommended", "并不推荐"],
	[
		"Disable, I understand my webhooks may not be secure",
		"禁用，我明白我的网络钩子可能不安全",
	],
];

/** 「让我选择单个事件」列表：每个事件是「名称 + 说明」两条键（按 HTML 顺序） */
const EVENT_NODES: readonly (readonly [string, string])[] =
	[
		["Related issues", "相关议题"],
		[
			"Related issues - such as relates to - added or removed.",
			"相关议题（例如“关联到”）被添加或移除。",
		],
		["Branch or tag creation", "分支或标签创建"],
		["Branch or tag created.", "分支或标签已创建。"],
		["Branch or tag deletion", "分支或标签删除"],
		["Branch or tag deleted.", "分支或标签已删除。"],
		["Branch protection configurations", "分支保护配置"],
		[
			"All branch protections disabled or enabled for a repository.",
			"仓库的所有分支保护被禁用或启用。",
		],
		["Branch protection rules", "分支保护规则"],
		[
			"Branch protection rule created, deleted or edited.",
			"分支保护规则被创建、删除或编辑。",
		],
		[
			"Bypass requests for push rulesets",
			"推送规则集的绕过请求",
		],
		[
			"Push ruleset bypass request was created, cancelled, completed, received a response, or a response was dismissed.",
			"推送规则集绕过请求被创建、取消、完成、收到响应，或响应被忽略。",
		],
		[
			"Bypass requests for secret scanning push protections",
			"机密扫描推送保护的绕过请求",
		],
		[
			"Secret scanning push protection bypass request was created, cancelled, completed, received a response, or a response was dismissed.",
			"机密扫描推送保护绕过请求被创建、取消、完成、收到响应，或响应被忽略。",
		],
		["Check runs", "检查运行"],
		[
			"Check run is created, requested, rerequested, or completed.",
			"检查运行被创建、请求、重新请求或完成。",
		],
		["Check suites", "检查套件"],
		[
			"Check suite is requested, rerequested, or completed.",
			"检查套件被请求、重新请求或完成。",
		],
		["Code scanning alerts", "代码扫描警报"],
		[
			"Code Scanning alert updated. This event is triggered when the assignees or state of the alert changes. The state can be created, fixed in branch, or closed.",
			"代码扫描警报已更新。当警报的负责人或状态发生变化时触发此事件。状态可以是已创建、分支中已修复或已关闭。",
		],
		[
			"Collaborator add, remove, or changed",
			"协作者添加、移除或更改",
		],
		[
			"Collaborator added to, removed from, or has changed permissions for a repository.",
			"协作者被添加到仓库、从仓库移除，或其在仓库中的权限发生更改。",
		],
		["Commit comments", "提交评论"],
		[
			"Commit or diff commented on.",
			"对提交或差异发表了评论。",
		],
		["Dependabot alerts", "Dependabot 警报"],
		[
			"Dependabot alert assignees_changed, auto_dismissed, auto_reopened, created, dismissed, reopened, fixed, or reintroduced.",
			"Dependabot 警报 assignees_changed、auto_dismissed、auto_reopened、created、dismissed、reopened、fixed 或 reintroduced。",
		],
		["Deployment statuses", "部署状态"],
		[
			"Deployment status updated from the API.",
			"通过 API 更新了部署状态。",
		],
		["Deployments", "部署"],
		[
			"Repository was deployed or a deployment was deleted.",
			"仓库被部署，或某个部署被删除。",
		],
		["Discussion comments", "讨论评论"],
		[
			"Discussion comment created, edited, or deleted.",
			"讨论评论被创建、编辑或删除。",
		],
		[
			"Dismissal requests for dependabot alerts",
			"Dependabot 警报的忽略请求",
		],
		[
			"Dependabot alert dismissal request was created, cancelled, or received a response (approved or rejected).",
			"Dependabot 警报忽略请求被创建、取消，或收到响应（已批准或已拒绝）。",
		],
		[
			"Dismissal requests for code scanning alerts",
			"代码扫描警报的忽略请求",
		],
		[
			"Code scanning alert dismissal request was created, or received a response (approved or rejected).",
			"代码扫描警报忽略请求被创建，或收到响应（已批准或已拒绝）。",
		],
		[
			"Dismissal requests for secret scanning alerts",
			"机密扫描警报的忽略请求",
		],
		[
			"Secret scanning alert dismissal request was created, cancelled, or received a response.",
			"机密扫描警报忽略请求被创建、取消，或收到响应。",
		],
		["Forks", "复刻"],
		["Repository forked.", "仓库被复刻。"],
		["Issue comments", "议题评论"],
		[
			"Issue comment created, edited, or deleted.",
			"议题评论被创建、编辑或删除。",
		],
		["Issue dependencies", "议题依赖"],
		[
			"Issue dependencies - such as blocked by or blocking - added or removed.",
			"议题依赖（例如“被阻止”或“正在阻止”）被添加或移除。",
		],
		["Issues", "议题"],
		[
			"Issue opened, edited, deleted, transferred, pinned, unpinned, closed, reopened, assigned, unassigned, labeled, unlabeled, milestoned, demilestoned, locked, unlocked, typed, untyped, field_added, or field_removed.",
			"议题被打开、编辑、删除、转移、固定、取消固定、关闭、重新打开、指派、取消指派、添加标签、移除标签、加入里程碑、移出里程碑、锁定、解锁、设置类型、取消类型、field_added 或 field_removed。",
		],
		["Labels", "标签"],
		[
			"Label created, edited, deleted, archived, or unarchived.",
			"标签被创建、编辑、删除、归档或取消归档。",
		],
		["Merge groups", "合并组"],
		[
			"Merge Group requested checks, or was destroyed.",
			"合并组请求了检查，或被销毁。",
		],
		["Meta", "元数据"],
		[
			"This particular hook is deleted.",
			"此特定钩子被删除。",
		],
		["Milestones", "里程碑"],
		[
			"Milestone created, closed, opened, edited, or deleted.",
			"里程碑被创建、关闭、打开、编辑或删除。",
		],
		["Packages", "包"],
		[
			"GitHub Packages published or updated in a repository.",
			"仓库中发布或更新了 GitHub Packages。",
		],
		["Page builds", "页面构建"],
		["Pages site built.", "Pages 站点已构建。"],
		["Pull request review comments", "拉取请求审查评论"],
		[
			"Pull request diff comment created, edited, or deleted.",
			"拉取请求差异评论被创建、编辑或删除。",
		],
		["Pull request review threads", "拉取请求审查会话"],
		[
			"A pull request review thread was resolved or unresolved.",
			"拉取请求审查会话被解决或取消解决。",
		],
		["Pull request reviews", "拉取请求审查"],
		[
			"Pull request review submitted, edited, or dismissed.",
			"拉取请求审查被提交、编辑或忽略。",
		],
		["Pull requests", "拉取请求"],
		[
			"Pull request assigned, auto merge disabled, auto merge enabled, closed, converted to draft, demilestoned, dequeued, edited, enqueued, labeled, locked, milestoned, opened, ready for review, reopened, review request removed, review requested, stacked, synchronized, unassigned, unlabeled, or unlocked.",
			"拉取请求被指派、禁用自动合并、启用自动合并、关闭、转为草稿、移出里程碑、移出队列、编辑、加入队列、添加标签、锁定、加入里程碑、打开、标记为可供审查、重新打开、移除审查请求、请求审查、堆叠、同步、取消指派、移除标签或解锁。",
		],
		["Registry packages", "注册表包"],
		[
			"Registry package published or updated in a repository.",
			"仓库中发布或更新了注册表包。",
		],
		["Releases", "发布"],
		[
			"Release created, edited, published, unpublished, or deleted.",
			"发布被创建、编辑、发布、取消发布或删除。",
		],
		["Repositories", "仓库"],
		[
			"Repository created, deleted, archived, unarchived, publicized, privatized, edited, renamed, or transferred.",
			"仓库被创建、删除、归档、取消归档、公开、私有化、编辑、重命名或转移。",
		],
		["Repository advisories", "仓库公告"],
		[
			"Repository advisory published or reported.",
			"仓库公告被发布或报告。",
		],
		["Repository imports", "仓库导入"],
		[
			"Repository import succeeded, failed, or cancelled.",
			"仓库导入成功、失败或取消。",
		],
		["Repository rulesets", "仓库规则集"],
		[
			"Repository ruleset created, deleted or edited.",
			"仓库规则集被创建、删除或编辑。",
		],
		["Repository vulnerability alerts", "仓库漏洞警报"],
		[
			"Dependabot alert (aka dependency vulnerability alert) created, resolved, or dismissed on a repository.",
			"仓库上创建、解决或忽略了 Dependabot 警报（即依赖漏洞警报）。",
		],
		["Secret scanning alert locations", "机密扫描警报位置"],
		[
			"Secrets scanning alert location created.",
			"机密扫描警报位置已创建。",
		],
		["Secret scanning alerts", "机密扫描警报"],
		[
			"Secret scanning alert created, resolved, reopened, validated, publicly leaked, assigned, or unassigned.",
			"机密扫描警报被创建、解决、重新打开、验证、公开泄露、指派或取消指派。",
		],
		["Secret scanning scans", "机密扫描运行"],
		[
			"Secrets scanning scan completed.",
			"机密扫描已完成。",
		],
		["Security and analyses", "安全与分析"],
		[
			"Code security features enabled or disabled for a repository.",
			"仓库的代码安全功能被启用或禁用。",
		],
		["Stars", "星标"],
		[
			"A star is created or deleted from a repository.",
			"仓库中创建或删除了星标。",
		],
		["Statuses", "状态"],
		[
			"Commit status updated from the API.",
			"通过 API 更新了提交状态。",
		],
		["Sub issues", "子议题"],
		[
			"Sub-issues added or removed, and parent issues added or removed.",
			"子议题被添加或移除，父议题被添加或移除。",
		],
		["Team adds", "团队添加"],
		[
			"Team added or modified on a repository.",
			"仓库上添加或修改了团队。",
		],
		["Visibility changes", "可见性更改"],
		[
			"Repository changes from private to public.",
			"仓库从私有变为公开。",
		],
		["Watches", "关注"],
		["User stars a repository.", "用户为仓库加星标。"],
		["Wiki", "维基"],
		["Wiki page updated.", "维基页面已更新。"],
		["Workflow jobs", "工作流作业"],
		[
			"Workflow job queued, waiting, in progress, or completed on a repository.",
			"仓库上的工作流作业已排队、等待、进行中或完成。",
		],
		["Workflow runs", "工作流运行"],
		[
			"Workflow run requested or completed on a repository.",
			"仓库上的工作流运行被请求或完成。",
		],
	];

describe("仓库设置页的网络钩子两支实机节点边界", () => {
	it("translates the form, caption and dialog nodes", () => {
		for (const [node, expected] of NODES) {
			for (const variant of [
				node,
				`\n        ${node}\n      `,
			]) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("translates every event name and its description", () => {
		for (const [node, expected] of EVENT_NODES) {
			expect(
				translateText(
					`\n          ${node}\n\n\n          `,
					view,
				),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("reuses the labels that other parts of this module already own", () => {
		// 事件列表里这三条与设置侧边栏 / 推送设置同串同义，不重复登记，直接复用
		expect(translateText("Deploy keys", view)).toBe(
			"部署密钥",
		);
		expect(translateText("Discussions", view)).toBe(
			"讨论区",
		);
		expect(translateText("Pushes", view)).toBe("推送");
	});

	it("reassembles the caption split by its two <code> and one <em>", () => {
		// 复刻 walker 的空白保留语义（见 repo-settings-code-review-limits.test.ts）；
		// `POST` / `x-www-form-urlencoded` 在排除容器里、`, ` 是纯符号节点，三者都保留原文
		const renderWithWhitespace = (
			nodes: readonly string[],
		) =>
			nodes
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
		expect(
			renderWithWhitespace([
				"We'll send a ",
				"POST",
				" request to the URL below with details of any subscribed events. You can also specify which data format you'd like to receive (JSON, ",
				"x-www-form-urlencoded",
				", ",
				"etc",
				"). More information can be found in ",
				"our developer documentation",
				".",
			]),
		).toBe(
			"我们会发送一个 POST 请求到你下方提供的 URL，其中包含所订阅事件的详情。你还可以指定希望接收的数据格式（JSON、 x-www-form-urlencoded, 等等）。更多信息可在 我们的开发者文档.",
		);
		// 三个选项标签：前两个被内联元素切开，第三条是整节点
		expect(
			renderWithWhitespace([
				"Just the ",
				"push",
				" event.",
			]),
		).toBe("仅 push 事件。");
		expect(
			renderWithWhitespace(["Send me ", "everything", "."]),
		).toBe("发送给我 所有内容.");
		// 禁用 SSL 验证的说明段被 <strong> 切开
		expect(
			renderWithWhitespace([
				"SSL verification helps ensure that hook payloads are delivered to your URL endpoint securely, keeping your data away from prying eyes. Disabling this option is ",
				"not recommended",
				".",
			]),
		).toBe(
			"SSL 验证有助于确保钩子负载安全地投递到你的 URL 端点，让你的数据远离窥探。禁用此选项 并不推荐.",
		);
	});

	it("keeps the account names in english", () => {
		for (const name of [
			"Oppenheymu",
			"Github-i18n",
			"M. Oppenheymu",
			"@Oppenheymu",
			"alt shift r",
		]) {
			expect(
				translateText(name, view),
				`专名 ${name}`,
			).toBeNull();
		}
	});
});
