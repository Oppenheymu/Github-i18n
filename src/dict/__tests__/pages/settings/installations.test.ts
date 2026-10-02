// 已安装应用 / 已授权应用一族
// （/settings/installations、/settings/applications、/settings/apps/authorizations）
// 实机文本与属性回归。三页同属 pages/settings 模块，合并成一份回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，三份 path 各一份）。
//
// 三页最关键的边界事实（都在下方断言里锁住）：
//   1. **应用名是用户内容**：`Cloudflare` / `gitee.com` / `npm account link` / `Codecov` …
//      都不收录；含应用名的整句走规则（`Report <名>` / `Revoke <名>` /
//      `Reporting <名> will contact Support…` / `<名> will no longer be able to access …`）；
//   2. 词典**先于规则**命中，所以 `Report abuse`（词条）不会被 `^Report (.+)$` 截走，
//      `Revoke all`（词条）也不会被 `^Revoke (.+)$` 截走；
//   3. 两个撤销确认弹窗都是三段拼接：
//      `This will revoke access for` + `all third-party` / `all` + `OAuth applications. …` /
//      `GitHub Apps. This action cannot be undone.`——句号落在最后一段，故那段译文自带「的访问权限。」；
//   4. 应用行下方的「… · Owned by」是**静态串**（所有者名在下一个节点），
//      只收实证过的三种档位（从未使用 / 最近一周 / 最近 2 周）；
//   5. 默认排序项是三个独立节点：`Alphabetical` / `Recently used` / `Least recently used`。
//
// 刻意**不收录**（下方反例断言）：应用名、应用所有者（`github` / `openai` …）、
// `Copilot` / `GitHub`（title）等纯专名与用户名、头像 alt 等用户内容。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 按路径取该页的合并视图（pages/settings + global） */
function viewFor(pathname: string) {
	return buildView(
		pathname,
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);
}

const installationsView = viewFor(
	"/settings/installations",
);
const applicationsView = viewFor("/settings/applications");
const authorizationsView = viewFor(
	"/settings/apps/authorizations",
);

/** /settings/installations 的实机文本节点 */
const INSTALLATIONS_NODES: readonly string[] = [
	"Installed GitHub Apps",
	"My GitHub Apps",
	"Visit Marketplace",
	"No installed GitHub Apps",
	"You have no GitHub Apps installed on this account.",
];

/** /settings/applications 的实机文本节点与属性 */
const APPLICATIONS_NODES: readonly string[] = [
	"More options",
	"Show more options",
	"Report abuse",
	"Report Abuse",
	"Revoking will deny future access to your account",
	"Any SSH keys created on your behalf by applications will also be deleted.",
	"Are you sure you want to revoke access for all applications?",
	"Never used · Owned by",
	"Last used within the last week · Owned by",
	"Last used within the last 2 weeks · Owned by",
	"This will revoke access for",
	"all third-party",
	"OAuth applications. This action cannot be undone.",
	"Type your username to confirm.",
	// 计数与含应用名的整句（规则覆盖）
	"15 applications",
	"Report ChatGPT Verification",
	"Revoke Cloudflare",
	"Reporting gitee.com will contact Support about abuse on the application.",
	"Git Credential Manager will no longer be able to access your GitHub account. You cannot undo this action.",
];

/** /settings/apps/authorizations 的实机文本节点与属性 */
const AUTHORIZATIONS_NODES: readonly string[] = [
	"Authorized OAuth Apps",
	"Application settings",
	"Alphabetical",
	"Recently used",
	"Least recently used",
	"GitHub Help",
	"Read more about connecting with third-party applications at",
	"You have granted",
	"access to your account.",
	"Revoke all",
	"I understand, revoke access",
	"I understand, revoke access for everything",
	"Are you sure you want to revoke authorization?",
	"Are you sure you want to revoke access for all GitHub Apps?",
	"Type your username to confirm",
	"all",
	"GitHub Apps. This action cannot be undone.",
	"Last used within the last week · Owned by",
	// 计数与含应用名的整句（规则覆盖）
	"4 applications",
	"Report codebuddy-overseas",
	"Revoke Copilot Chat App",
	"Reporting npm account link will contact Support about abuse on the application.",
	"Codecov will no longer be able to access the GitHub API. You cannot undo this action.",
];

/** 必须保持英文的实机节点：应用名、所有者与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// /settings/applications 的应用名与所有者
	"ChatGPT Verification",
	"Cline Bot Inc",
	"Cloudflare",
	"CodeBuddy-Official-Account",
	"Context7",
	"FOSSA",
	"Git Credential Manager",
	"GitHub Android",
	"GitHub CLI",
	"H4M5TER",
	"Koishi Forum",
	"MineBBS",
	"Modrinth",
	"Repobeats",
	"SuperYYT",
	"UpstashBot",
	"Visual Studio Code",
	"Visual-Studio-Code",
	"axiomhq",
	"cline",
	"cloudflare",
	"fossas",
	"git-ecosystem",
	"gitee.com",
	"modrinth",
	"openai",
	"oschina",
	// /settings/apps/authorizations 的应用名与所有者
	"Codecov",
	"Copilot Chat App",
	"Copilot SWE Agent",
	"github",
	"codecov",
	"npm",
	"npm account link",
	// 用户内容与纯专名
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
	"Copilot",
	"GitHub",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 把一段实机节点序列按 walker 的语义过一遍并拼接成页面上的那一行 */
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

describe("已安装的 GitHub Apps 页（/settings/installations）的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of INSTALLATIONS_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					installationsView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the installed-apps page", () => {
		expect(
			translateText(
				"Installed GitHub Apps",
				installationsView,
			),
		).toBe("已安装的 GitHub 应用");
		expect(
			translateText("My GitHub Apps", installationsView),
		).toBe("我的 GitHub 应用");
		expect(
			translateText("Visit Marketplace", installationsView),
		).toBe("访问 Marketplace");
		expect(
			translateText(
				"No installed GitHub Apps",
				installationsView,
			),
		).toBe("没有已安装的 GitHub 应用");
		expect(
			translateText(
				"You have no GitHub Apps installed on this account.",
				installationsView,
			),
		).toBe("此账户上没有安装任何 GitHub 应用。");
	});
});

describe("已授权的 OAuth 应用页（/settings/applications）的实机节点边界", () => {
	it("translates every text node and attribute GitHub actually renders", () => {
		for (const node of APPLICATIONS_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					applicationsView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps application names and owners as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, applicationsView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the app row and the bulk-revoke dialog", () => {
		expect(
			translateText("More options", applicationsView),
		).toBe("更多选项");
		expect(
			translateText("Show more options", applicationsView),
		).toBe("显示更多选项");
		// 「举报滥用」两种大小写各是一条键（同译）
		expect(
			translateText("Report abuse", applicationsView),
		).toBe("举报滥用");
		expect(
			translateText("Report Abuse", applicationsView),
		).toBe("举报滥用");
		expect(
			translateText(
				"Revoking will deny future access to your account",
				applicationsView,
			),
		).toBe("撤销后将拒绝其今后访问你的账户");
		// 应用行的「从未使用 · 所有者：」+ 所有者名（用户内容，保持英文）
		expect(
			renderNodes(
				["Never used · Owned by", " ", "Cloudflare"],
				applicationsView,
			),
		).toBe("从未使用 · 所有者： Cloudflare");
		expect(
			translateText(
				"Last used within the last 2 weeks · Owned by",
				applicationsView,
			),
		).toBe("最近 2 周内使用过 · 所有者：");
		// 三段拼接的批量撤销弹窗
		expect(
			renderNodes(
				[
					"This will revoke access for",
					" ",
					"all third-party",
					" ",
					"OAuth applications. This action cannot be undone.",
				],
				applicationsView,
			),
		).toBe(
			"这将撤销 所有第三方 OAuth 应用的访问权限。此操作无法撤销。",
		);
		expect(
			translateText(
				"Any SSH keys created on your behalf by applications will also be deleted.",
				applicationsView,
			),
		).toBe("由应用代表你创建的任何 SSH 密钥也会被删除。");
		expect(
			translateText(
				"Are you sure you want to revoke access for all applications?",
				applicationsView,
			),
		).toBe("你确定要撤销所有应用的访问权限吗？");
		expect(
			translateText(
				"Type your username to confirm.",
				applicationsView,
			),
		).toBe("输入你的用户名以确认。");
	});

	it("renders the per-application menu items and notices through the rules", () => {
		// 应用名是用户内容：翻译前缀 / 句子骨架，名字按原样带回
		expect(
			translateText(
				"Report ChatGPT Verification",
				applicationsView,
			),
		).toBe("举报 ChatGPT Verification");
		expect(
			translateText("Revoke Cloudflare", applicationsView),
		).toBe("撤销 Cloudflare");
		expect(
			translateText(
				"Reporting gitee.com will contact Support about abuse on the application.",
				applicationsView,
			),
		).toBe(
			"举报 gitee.com 将就应用上的滥用行为联系支持团队。",
		);
		expect(
			translateText(
				"Git Credential Manager will no longer be able to access your GitHub account. You cannot undo this action.",
				applicationsView,
			),
		).toBe(
			"Git Credential Manager 将无法再访问你的 GitHub 账户。此操作无法撤销。",
		);
		// 计数行
		expect(
			translateText("15 applications", applicationsView),
		).toBe("15 个应用");
		expect(
			translateText("1 application", applicationsView),
		).toBe("1 个应用");
	});
});

describe("已授权的 GitHub Apps 页（/settings/apps/authorizations）的实机节点边界", () => {
	it("translates every text node and attribute GitHub actually renders", () => {
		for (const node of AUTHORIZATIONS_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					authorizationsView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the authorizations header and sort options", () => {
		expect(
			translateText(
				"Authorized OAuth Apps",
				authorizationsView,
			),
		).toBe("已授权的 OAuth 应用");
		expect(
			translateText(
				"Application settings",
				authorizationsView,
			),
		).toBe("应用设置");
		expect(
			translateText("Alphabetical", authorizationsView),
		).toBe("按字母顺序");
		expect(
			translateText("Recently used", authorizationsView),
		).toBe("最近使用");
		expect(
			translateText(
				"Least recently used",
				authorizationsView,
			),
		).toBe("最近最少使用");
		// 「You have granted <n 个应用> access to your account.」
		expect(
			renderNodes(
				[
					"You have granted",
					" ",
					"4 applications",
					" ",
					"access to your account.",
				],
				authorizationsView,
			),
		).toBe("你已授予 4 个应用 访问你账户的权限。");
		expect(
			renderNodes(
				[
					"Read more about connecting with third-party applications at",
					" ",
					"GitHub Help",
					".",
				],
				authorizationsView,
			),
		).toBe(
			"详细了解如何连接第三方应用，请访问 GitHub 帮助.",
		);
	});

	it("renders the bulk-revoke dialogs and the per-app rules", () => {
		expect(
			translateText("Revoke all", authorizationsView),
		).toBe("全部撤销");
		expect(
			translateText(
				"I understand, revoke access",
				authorizationsView,
			),
		).toBe("我明白，撤销访问权限");
		expect(
			translateText(
				"I understand, revoke access for everything",
				authorizationsView,
			),
		).toBe("我明白，撤销所有访问权限");
		// 单应用与批量的两个确认标题
		expect(
			translateText(
				"Are you sure you want to revoke authorization?",
				authorizationsView,
			),
		).toBe("你确定要撤销授权吗？");
		expect(
			translateText(
				"Are you sure you want to revoke access for all GitHub Apps?",
				authorizationsView,
			),
		).toBe("你确定要撤销所有 GitHub Apps 的访问权限吗？");
		// GitHub Apps 的批量撤销弹窗（`all` 是独立节点）
		expect(
			renderNodes(
				[
					"This will revoke access for",
					" ",
					"all",
					" ",
					"GitHub Apps. This action cannot be undone.",
				],
				authorizationsView,
			),
		).toBe(
			"这将撤销 所有 GitHub Apps 的访问权限。此操作无法撤销。",
		);
		// 单应用确认句（走 the GitHub API 那条规则）
		expect(
			translateText(
				"Codecov will no longer be able to access the GitHub API. You cannot undo this action.",
				authorizationsView,
			),
		).toBe(
			"Codecov 将无法再访问 GitHub API。此操作无法撤销。",
		);
		expect(
			translateText(
				"Reporting npm account link will contact Support about abuse on the application.",
				authorizationsView,
			),
		).toBe(
			"举报 npm account link 将就应用上的滥用行为联系支持团队。",
		);
		expect(
			translateText(
				"Type your username to confirm",
				authorizationsView,
			),
		).toBe("输入你的用户名以确认");
		expect(
			translateText(
				"Last used within the last week · Owned by",
				authorizationsView,
			),
		).toBe("最近一周内使用过 · 所有者：");
	});
});
