// 组织付款信息页（/organizations/<组织>/settings/billing/payment_information）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页实机 HTML**（整段 outerHTML；采集时扩展仍在运行，
// 故已是中文的节点是扩展产物、仍是英文的才是待补清单）。
//
// 与许可页不同，这一页**不缺路由**：它挂在 settings/billing 前缀下，
// `^/(?:(?:settings|account)/billing|…)` 早已命中，本轮之前也已译出表单标签与说明句
// （`Billing information` / `First name` / `Address (Street, P.O. box)` …，见
// src/dict/__tests__/pages/settings/billing.test.ts 的 PAYMENT_NODES）。本轮补的是组织侧
// HTML 新暴露的**其余区块**：顶部两条提示、组织账单信息关联卡、「上次付款」、
// 附加账单信息对话框、发票区块与 Azure 按量计费区块。本文件锁四件事：
//   ① 该路径命中 pages/settings-billing + pages/org-settings，且账单模块在前（逐键先到先得）；
//   ② 新收的 31 条键全部按实机节点原文命中（含默认 hidden 的 flash 与对话框——
//      「隐藏节点照常翻译」是既定边界）；
//   ③ 三处**跨节点句**的拼接结果：组织提示句（五段 + 被清空的冠词）、对话框说明句
//      （`invoices` 是 `<strong>`）、发票说明句（`<br>` 后另起一段）；
//   ④ 用户内容与下拉选项（国家 / 地区、州 / 省）必须保持英文。
//
// 三条必须记住的边界事实：
//   1. `… billing information by <a>signing</a> the <a>GitHub Customer Agreement</a>.`
//      在实机里是**五个文本节点**，其中 ` the ` 是独立节点。中文没有冠词，这一节点由
//      core/rules.jsonc 的 settings/article-the（空模板）**整节点清空**——引擎连同它的
//      首尾空白一起清掉，故实机渲染是「…方法是 签署GitHub 客户协议.」：`签署` 与链接
//      文字之间少一个空格，句末是源码里的 ASCII 句点（纯符号节点翻不了）。两条都在
//      下面的断言里锁住，属于拆分节点的固有形态，不是缺词条；
//   2. 原文里的撇号是**弯撇号** `\u2019`（`business’`），与 tooltip 那句同一约定；
//   3. 国家 / 地区（约 200 条）与州 / 省下拉的**选项名**一如既往不收录：它们是随表单
//      提交的值，改了显示文案会改坏功能。注意 `选择你的国家/地区` / `选择州` / `选择省`
//      是**占位项**（不是国家名），早已分别由 pages/settings-billing 与 pages/org-settings 收录。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const ORG_PATH =
	"/organizations/Koishi-CE/settings/billing/payment_information";
const PERSONAL_PATH =
	"/account/billing/payment_information";

/** 组织路径命中的模块视图（pages/settings-billing + pages/org-settings + global） */
const view = buildView(
	ORG_PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 个人路径视图：共享节点在两条路由上必须译得**逐字一样** */
const personalView = buildView(
	PERSONAL_PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 本轮新补的文本节点（逐条誊录实机 HTML，顺序即页面顺序） */
const NEW_NODES: readonly string[] = [
	// 顶部提示（默认 hidden，仍在 DOM 里）
	"Please update your billing information in order to add a payment method.",
	// 组织账单信息关联卡
	"An organization owner or billing manager must link their personal billing information with this organization account. You can switch to a business account to use your business’ billing information by",
	"signing",
	"GitHub Customer Agreement",
	"Allow my billing information to be linked with this organization",
	"Confirm your details shown below. To make changes,",
	"edit your billing information",
	"Personal account",
	// 上次付款
	"Last payment",
	// 附加账单信息对话框
	"Extra billing information",
	"This information will appear on all your receipts.",
	"To update the information that appears on",
	"invoices",
	"(if enabled), visit the",
	"billing information section",
	"For your security, do not include any confidential or financial information (like credit card numbers).",
	"Full business name or address of record",
	"Save contact information",
	// 发票区块
	"Invoice",
	"Receive an invoice for your GitHub purchases",
	"The data from Billing Information, such as your address and VAT/GST ID will appear on your invoices.",
	"Update your information displayed on your invoices in the",
	"Automatically receive an invoice alongside the payment receipt",
	"* Enables invoices for all NEW payments.",
	"Save invoice preference",
	// Azure 按量计费区块
	"Metered billing via Azure",
	"Add Azure Subscription",
	"To manage metered billing for this account through Microsoft Azure an Azure Subscription ID must be added to your account.",
];

/** 按钮 / 关闭图标的 loading 与无障碍文案：属性值只走词条（属性不应用规则） */
const ATTRIBUTE_NODES: readonly [string, string][] = [
	["Dismiss this message", "关闭此消息"],
	["Saving contact information…", "正在保存联系信息…"],
	["Saving invoice preference", "正在保存发票偏好设置"],
];

/** 本轮之前就已有译文、在组织路径上必须照常命中的节点（实机 HTML 里已是中文） */
const SHARED_NODES: readonly string[] = [
	"Billing information",
	"First name",
	"Last name",
	"Address",
	"(Street, P.O. box)",
	"Address line 2",
	"(Apartment, suite, unit)",
	"City",
	"Country/Region",
	"Choose your country/region",
	"State/Province",
	"Postal/Zip code",
	"(9-digit zip code for US)",
	"Required for certain countries",
	"VAT/GST ID",
	"Coupon",
	"Redeem a coupon",
	"You don't have an active coupon.",
	"Additional information",
	"Add information",
	"No additional information added to your receipts.",
	"You have not made any payments.",
];

/** 由组织设置外壳（pages/org-settings）提供的两条下拉占位项（不是州 / 省名） */
const SHELL_NODES: readonly [string, string][] = [
	["Select state", "选择州"],
	["Select province", "选择省"],
];

/** 必须保持英文：用户内容与下拉选项名 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 用户内容（姓名、地址、组织名）
	"Yi Li",
	"Oppenheymu",
	"@Oppenheymu",
	"30 Merchant Road",
	"#03-12 Riverside Point",
	"Singapore,  058282",
	"Singapore",
	"Koishi-CE",
	// 国家 / 地区与州 / 省的选项名：表单值，翻了会改坏提交内容（有意漏翻）
	"China",
	"United States of America",
	"Korea, South",
	"Alabama",
	"Washington DC",
	"Ontario",
	"British Columbia",
	// 发票开关的 `data-setting-label`：不在引擎的六个可翻译属性里，有意不收录（只做分析埋点用）
	"Invoice with receipt",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白（**整节点被判空时不留空白**，与
 * walker.applyTextNode 的 erased 语义一致），最后拼接成页面上真实看到的那一行。
 */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			if (translated.trim() === "") return translated;
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("组织付款信息页的模块路由", () => {
	it("loads the billing module ahead of the org-settings shell", () => {
		const names = matchModules(
			ORG_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		expect(names).toContain("pages/org-settings");
		expect(
			names.indexOf("pages/settings-billing"),
		).toBeLessThan(names.indexOf("pages/org-settings"));
	});

	it("keeps the personal payment information route working", () => {
		// 个人侧由 pages/settings 提供页面标题与设置侧栏，账单模块提供正文
		const names = matchModules(
			PERSONAL_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		expect(names).toContain("pages/settings");
	});

	it("renders the page title through the org-settings shell", () => {
		// 本页路由**不命中** pages/settings，标题「付款信息」由 pages/org-settings 的侧栏键提供
		expect(translateText("Payment information", view)).toBe(
			"付款信息",
		);
		expect(
			matchModules(
				ORG_PATH,
				dictForLocale("zh-CN").modules,
			).map((module) => module.name),
		).not.toContain("pages/settings");
	});
});

describe("组织付款信息页的实机节点边界", () => {
	it("translates every newly registered text node", () => {
		for (const node of NEW_NODES) {
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

	it("translates the button and close-icon attributes", () => {
		for (const [raw, expected] of ATTRIBUTE_NODES) {
			expect(
				translateText(raw, view),
				`属性未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("reuses the wording already registered for the personal page", () => {
		for (const node of SHARED_NODES) {
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

	it("keeps the shared nodes identical on both routes", () => {
		// 同一份词条服务两条路由（差异只在兜底层 pages/settings vs pages/org-settings），
		// 不得因兜底层不同而换词
		for (const node of [...SHARED_NODES, ...NEW_NODES]) {
			expect(
				translateText(node, view),
				`两条路由译文不一致：${JSON.stringify(node)}`,
			).toBe(translateText(node, personalView));
		}
	});

	it("translates the dropdown placeholders through the org-settings shell", () => {
		// `选择州` / `选择省` 是下拉的占位项（不是州 / 省名），由 pages/org-settings 提供
		for (const [raw, expected] of SHELL_NODES) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps user content and the dropdown option names as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织付款信息页的跨节点句子", () => {
	it("clears the standalone article node between the two links", () => {
		// ` the ` 是独立节点：规则模板是空串，引擎连同它的首尾空白一起清掉
		expect(translateText("the", view)).toBe("");
		expect(translateText(" the ", view)).toBe("");
		// 清空**不该**波及相邻节点：`there` / `Theme` 这类整节点不命中
		expect(translateText("there", view)).toBeNull();
		expect(
			translateText(
				"the billing information section",
				view,
			),
		).toBe(null);
	});

	it("renders the organization banner as one readable sentence", () => {
		// 实机五段拆分；`by` → 「方法是」把话接到链接上，冠词节点被清空，
		// 故「签署」与链接文字之间少一个空格（拆分节点的固有形态）
		expect(
			renderNodes([
				"An organization owner or billing manager must link their personal billing information with this organization account. You can switch to a business account to use your business’ billing information by ",
				"signing",
				" the ",
				"GitHub Customer Agreement",
				".",
			]),
		).toBe(
			"组织所有者或账单管理员必须将其个人账单信息与此组织账户关联。你可以改用企业账户来使用你企业的账单信息，方法是 签署GitHub 客户协议.",
		);
	});

	it("renders the dialog blurb around its strong node", () => {
		// `invoices` 是 `<strong>`，前后两段各是独立节点
		expect(
			renderNodes([
				"To update the information that appears on ",
				"invoices",
				" (if enabled), visit the ",
				"billing information section",
				".",
			]),
		).toBe(
			"如需更新显示在 发票 （如已启用），请访问 账单信息部分.",
		);
	});

	it("renders the invoice blurb across its line break", () => {
		// 实机里 `<br>` 把两段分开，前一段的尾随空白由 walker 原样保留
		expect(
			renderNodes([
				"The data from Billing Information, such as your address and VAT/GST ID will appear on your invoices.\n          ",
				"Update your information displayed on your invoices in the ",
				"billing information section",
				".",
			]),
		).toBe(
			"账单信息中的数据（例如你的地址与增值税/GST 识别号）将显示在你的发票上。\n          如需更新发票上显示的信息，请前往 账单信息部分.",
		);
	});

	it("renders the billing-information confirmation blurb", () => {
		expect(
			renderNodes([
				"Confirm your details shown below. To make changes,\n          ",
				"edit your billing information",
			]),
		).toBe(
			"请确认下方显示的详细信息。如需修改，\n          编辑你的账单信息",
		);
	});

	it("renders the metered-billing and invoice call-to-actions", () => {
		expect(
			translateText("Metered billing via Azure", view),
		).toBe("通过 Azure 的按量计费");
		expect(
			translateText("Add Azure Subscription", view),
		).toBe("添加 Azure 订阅");
		expect(
			translateText("Save invoice preference", view),
		).toBe("保存发票偏好设置");
		// 星号是这句节点原文的一部分，故译文里保留星号 + 一个空格
		expect(
			translateText(
				"* Enables invoices for all NEW payments.",
				view,
			),
		).toBe("* 为所有新付款启用发票。");
	});
});
