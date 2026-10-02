// 电子邮件设置页（/settings/emails）实机文本与属性回归。
//
// 边界强度：**实机 HTML 实证**（2026-09-26 该页会话）。本页有两份互相印证的证据：
//   1. popup 开发者模式导出的漏翻清单（schema github-zh-misses/1，path 全为 /settings/emails）；
//   2. 维护者按固定起手式采集的「全部文本节点（含真实空白）+ 六个可翻译属性 + 整理后 HTML」。
// 下面所有键都逐字抄自证据 2 的节点原文（`TEXT "…"` 的引号内容），再与证据 1 的漏翻清单核对：
// 证据 2 里**未被扩展译成中文**的模板文案就是待补项，已译的（侧栏、设置范围、页脚）
// 由既有词条覆盖，不重复登记。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. 「保持邮箱私密」说明段被 `<strong>`（noreply 地址）与 `<a>`（Git 帮助链接）切成三段，
//      三段各自是一个文本节点，整句键在实机永不命中；中间段跨两行、首尾都带缩进，
//      折叠空白后才等于词典键；
//   2. 顶部验证提醒与三段说明都是**带源码缩进的单个节点**（`\n      …\n`）；
//   3. 断开关联弹窗把邮箱渲染成**纯文本节点**（不是链接），所以只收链接前的
//      `This will disconnect`，后面接邮箱、再接 ` from your social identity provider. …`；
//   4. 属性只走精确命中：本页新增的是输入框的 `placeholder`（`Email address`）。
//
// 刻意**不收录**（下方反例断言）：
//   - 用户内容：邮箱地址、`M. Oppenheymu`、`(Oppenheymu)`、头像 alt `@Oppenheymu`、
//     `266071743+Oppenheymu@users.noreply.github.com`；
//   - 纯专名 / 纯缩写：`GitHub`、`Google`、`Git`、`Copilot`（品牌名不译）。
// 未命中即保留英文，这才是正确做法；收录它们要么误伤用户内容，要么译文与键同形（自触发循环）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /settings/emails 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/emails",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（原文逐字录入，含真实空白；顺序按页面出现先后） */
const EMAIL_NODES: readonly string[] = [
	// —— 页面标题、验证提醒、页头说明 ——
	"Email settings",
	"\n      You have a single verified email associated with your GitHub account. Add an additional verified email address in case you lose access to your primary email.\n",
	"\n      Emails you can use to sign in to your account.\n        Verified emails can be used as the author or committer addresses for web-based Git operations, e.g. edits and merges.\n  ",
	// —— 邮箱行：徽标、说明、行末菜单 ——
	"Primary",
	"Verified",
	"Connected to Google",
	"\n              This email address is the default for GitHub notifications, such as replies to issues, pull requests, and similar activity.\n            ",
	"Manage email",
	"\n          Manage email preferences\n",
	"\n          Disconnect from Google\n",
	// —— 断开关联弹窗 ——
	// 注意：邮箱之后的尾段（` from your social identity provider. …`）**不是**可翻译节点——
	// 「可翻译判定」要求含拉丁字母，而中文译文一旦写入，该节点的实际内容由拼接决定；
	// 这里只收链接前的动作片段，弹窗整句的拼接结果见下方 renderNodes 断言。
	"This will disconnect",
	"Disconnect",
	// —— 新增邮箱表单 ——
	"\n          Add email address\n          ",
	"Add",
	// —— 主邮箱区块 ——
	"Primary email address",
	"\n            Select an email to be used for account-related notifications and can be used for password reset.\n          ",
	"\n        Select email to become primary\n",
	// —— 备用邮箱区块 ——
	"Backup email address",
	"\n            Your backup GitHub email address will be used as an additional destination for security-relevant account notifications and can also be used for password resets.\n          ",
	"Allow all verified emails",
	"Only allow primary email",
	"\n        Select email to become backup\n",
	// —— 邮箱保密开关（三段被 strong / a 切开）——
	"\n            Keep my email addresses private\n          ",
	"\n          We’ll remove your public profile email and use ",
	" when performing web-based Git operations (e.g. edits and merges) and\n          sending email on your behalf. If you want command line Git operations to use your private email you must\n          ",
	"set your email in Git",
	"Previously authored commits associated with a public email will remain public.",
	// —— 设置侧栏 ——
	// 只有 Packages 补了译文；同区右侧的 Copilot 走反例断言（纯专名不译）
	"\n          Packages\n",
];

/** 实机里被翻译的属性值（精确命中语义，不走规则） */
const EMAIL_ATTRS: readonly string[] = ["Email address"];

/**
 * 必须保持英文的实机节点：用户内容与纯专名 / 纯缩写。
 * 它们都含拉丁字母、会通过「可翻译判定」，但收录即错。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"oppenheymu@gmail.com",
	"266071743+Oppenheymu@users.noreply.github.com",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
	"GitHub",
	"Google",
	"Git",
	// 设置侧栏的纯专名（实机里以独立节点渲染，含源码缩进）
	"\n          Copilot\n",
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

describe("电子邮件设置页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of [...EMAIL_NODES, ...EMAIL_ATTRS]) {
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

	it("keeps user content, brand names and abbreviations as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("matches the real single-node boundaries of the page header", () => {
		// 实机：`<p class="Banner-title" …>\n      You have a single verified …\n</p>`
		expect(
			translateText(
				"\n      You have a single verified email associated with your GitHub account. Add an additional verified email address in case you lose access to your primary email.\n",
				view,
			),
		).toBe(
			"你的 GitHub 账户只关联了一个已验证的电子邮箱。请再添加一个已验证的电子邮箱地址，以防你无法访问主邮箱。",
		);
		// 实机：`<p class="color-fg-muted">` 的说明段跨两行、缩进不一致
		expect(
			translateText(
				"\n      Emails you can use to sign in to your account.\n        Verified emails can be used as the author or committer addresses for web-based Git operations, e.g. edits and merges.\n  ",
				view,
			),
		).toBe(
			"可用于登录你账户的电子邮箱。已验证的电子邮箱可作为基于网页的 Git 操作（例如编辑和合并）的作者或提交者地址。",
		);
	});

	it("renders the email row with its badges", () => {
		// 实机：`<span>oppenheymu@gmail.com<span id="labels">…徽标…</span><div class="note">…</div></span>`
		// ——邮箱保持原样，徽标与说明各自成节点
		const row = renderNodes([
			"\n          oppenheymu@gmail.com\n\n          ",
			"Primary",
			" ",
			"Verified",
			" ",
			"Connected to Google",
			"\n              This email address is the default for GitHub notifications, such as replies to issues, pull requests, and similar activity.\n            ",
		]);
		expect(row).toContain("oppenheymu@gmail.com");
		expect(row).toContain("主邮箱");
		expect(row).toContain("已验证");
		expect(row).toContain("已关联 Google");
		expect(row).toContain(
			"此电子邮箱地址是 GitHub 通知（例如议题回复、拉取请求及类似活动）的默认接收地址。",
		);
	});

	it("renders the disconnect dialog with the email kept in place", () => {
		// 实机：`<p>This will disconnect oppenheymu@gmail.com from your social identity provider. …</p>`
		// ——邮箱是纯文本节点（与 /settings/admin 的 @用户名不同，它不是链接），故只收链接前片段
		const rendered = renderNodes([
			"This will disconnect",
			" ",
			"oppenheymu@gmail.com",
			" from your social identity provider. You will no longer be able to use it as a password alternative.",
		]);
		// 译文末尾自带一个空格（与原节点的尾空格一致），故邮箱前是两个空格
		expect(rendered).toBe(
			"这会将  oppenheymu@gmail.com from your social identity provider. You will no longer be able to use it as a password alternative.",
		);
		// 弹窗确认按钮与标题（标题是 Overlay-title，与菜单项同键同译）
		expect(translateText("Disconnect", view)).toBe(
			"断开关联",
		);
		expect(
			translateText("Disconnect from Google", view),
		).toBe("断开与 Google 的关联");
	});

	it("renders the add-email form", () => {
		// 实机：`<label>Add email address<span class="required-star">*</span></label>` + placeholder
		// ——「*」是独立的纯符号节点：可翻译判定要求含拉丁字母，它翻不了也不收
		expect(
			translateText(
				"\n          Add email address\n          ",
				view,
			),
		).toBe("添加电子邮箱地址");
		expect(translateText("*", view)).toBeNull();
		expect(translateText("Email address", view)).toBe(
			"电子邮箱地址",
		);
		expect(translateText("Add", view)).toBe("添加");
	});

	it("renders the primary and backup sections", () => {
		expect(
			translateText("Primary email address", view),
		).toBe("主电子邮箱地址");
		expect(
			translateText(
				"\n            Select an email to be used for account-related notifications and can be used for password reset.\n          ",
				view,
			),
		).toBe(
			"选择用于账户相关通知的电子邮箱，也可用于重置密码。",
		);
		expect(
			translateText(
				"\n        Select email to become primary\n",
				view,
			),
		).toBe("选择要设为主邮箱的电子邮箱");
		expect(
			translateText("Backup email address", view),
		).toBe("备用电子邮箱地址");
		expect(
			translateText(
				"\n            Your backup GitHub email address will be used as an additional destination for security-relevant account notifications and can also be used for password resets.\n          ",
				view,
			),
		).toBe(
			"你的备用 GitHub 电子邮箱地址将作为安全相关账户通知的额外接收地址，也可用于重置密码。",
		);
		expect(
			translateText("Allow all verified emails", view),
		).toBe("允许所有已验证的电子邮箱");
		expect(
			translateText("Only allow primary email", view),
		).toBe("只允许主邮箱");
		expect(
			translateText(
				"\n        Select email to become backup\n",
				view,
			),
		).toBe("选择要设为备用邮箱的电子邮箱");
	});

	it("renders the private-email blurb across its three split nodes", () => {
		// 实机：`We’ll remove … use <strong>noreply</strong> when performing … you must <a>set your email in Git</a>.`
		// ——三段拼接后必须读通：noreply 地址保持英文，链接文本由中文替换，句点由纯符号节点保留
		const rendered = renderNodes([
			"\n          We’ll remove your public profile email and use ",
			"266071743+Oppenheymu@users.noreply.github.com",
			" when performing web-based Git operations (e.g. edits and merges) and\n          sending email on your behalf. If you want command line Git operations to use your private email you must\n          ",
			"set your email in Git",
			".\n          ",
			"Previously authored commits associated with a public email will remain public.",
		]);
		expect(rendered).toBe(
			"\n          我们将移除你公开资料中的电子邮箱，并使用 266071743+Oppenheymu@users.noreply.github.com 在执行基于网页的 Git 操作（例如编辑和合并）以及代表你发送邮件时使用。如果你希望命令行 Git 操作使用你的私人邮箱，必须\n          在 Git 中设置你的邮箱.\n          此前使用公开电子邮箱提交的提交记录仍将保持公开。",
		);
		expect(
			translateText(
				"\n            Keep my email addresses private\n          ",
				view,
			),
		).toBe("保持我的电子邮箱地址私密");
	});

	it("translates the sidebar label that used to stay English", () => {
		// 设置侧栏的 Packages：漏翻导出里出现 52 次（该页每次渲染都会带上侧栏）。
		// 同区右侧的 Copilot **故意不译**（纯专名不译是既有约定，与账单页 / 许可页 /
		// 通知页的反例断言一致），下面顺带把它钉住。
		expect(
			translateText("\n          Packages\n", view),
		).toBe("软件包");
		expect(
			translateText("\n          Copilot\n", view),
		).toBeNull();
	});
});
