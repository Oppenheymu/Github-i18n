// 组织账单管理员邀请页（/organizations/<组织>/billing_managers/new）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页实机 HTML**（整段 outerHTML；采集时扩展仍在运行，
// 故已是中文的节点是扩展产物、仍是英文的才是待补清单——本页整页无中文，说明该路径此前
// 几乎没有词条命中）。页面路径由维护者直接给出，它**不在 `/settings/` 下**：
//
//   ① 正文：靠 `pages/settings-billing` 组织支里 `billing` 的**前缀**命中
//      （`billing_managers` 的前 7 个字符就是 `billing`）——见 core/modules.jsonc 的注释，
//      那里同时写明「将来收紧这条正则必须显式保住 billing_managers」；
//   ② 外壳：页面上挂着组织设置侧栏（实机 HTML 的 `Layout-main-centered-xl` 与
//      `/settings/billing/*` 各页同款，`Subhead` 里是 `Billing / Add a billing manager`
//      这种设置子页面包屑），故同日给 `pages/org-settings` 补了 `billing_managers` 这一支，
//      否则侧栏会整块保留英文。
//
// 本文件锁五件事：
//   ① 该路径命中 `pages/settings-billing` + `pages/org-settings` + `global`，账单模块在前，
//      且**不命中** `pages/settings`（后者路由是 `^/(?:settings|account/billing)`）；
//   ② 新收的 24 条文本键全部按实机节点原文命中（含只在斜杠节点里的 `/ Add a billing manager`）；
//   ③ 三处被 `<strong>` 拆开的句子能拼回通顺中文（说明句、两组权限清单标题）；
//   ④ 独立冠词节点 `A` 由规则 `settings/article-a` 译成量词「一位」，且**只**命中整节点 `A`；
//   ⑤ 产品名与泛化短词（`Copilot`、结果列表的 aria-label `results`）保持英文。
//
// 两条必须记住的边界事实：
//   1. `A <strong>billing manager</strong> is a user who…` 是**三个文本节点**，首节点是
//      单个大写字母 `A`。引擎的可翻译判定是 `/[a-z]/i`（大小写不敏感），所以它能进规则；
//      中文没有冠词，留着它就是「A 账单管理员 是…」的中英残句，故译成「一位」；
//   2. 两组清单标题的尾句是**两个不同的键**（`have the ability to:` / `be able to:`），
//      中间片段 `will` / `will not` 各自独立——四段缺一条就整句退回英文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const ORG_PATH =
	"/organizations/Koishi-CE/billing_managers/new";
/** 同一页的旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const ORG_LEGACY_PATH =
	"/orgs/Koishi-CE/billing_managers/new";
/** 个人账单路径：跨模块同键同值的对照视图 */
const PERSONAL_PATH = "/account/billing";

/** 组织路径命中的模块视图（pages/settings-billing + pages/org-settings + global） */
const view = buildView(
	ORG_PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 个人账单视图 */
const personalView = buildView(
	PERSONAL_PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 本轮新补的文本节点（逐条誊录实机 HTML，顺序即页面顺序） */
const NEW_NODES: readonly string[] = [
	// —— 标题（链接 + 带斜杠的页名，两个节点）——
	"Billing",
	"/ Add a billing manager",
	// —— 说明句（`<strong>` 把句子切成三段，首段是孤立的 `A`）——
	"billing manager",
	"is a user who manages the billing settings of your organization.",
	// —— 权限清单标题的两个中间片段与两条尾句 ——
	"will",
	"will not",
	"have the ability to:",
	"be able to:",
	// —— 「将能够」清单 ——
	"Change the billing plan",
	"Add, update, or remove payment methods",
	"View payment history",
	"Download, and receive receipts",
	"View a list of billing managers",
	"Invite additional billing managers",
	"Remove other existing billing managers",
	"Start, modify, or cancel sponsorships",
	// —— 「无法」清单 ——
	"Create or access repositories in your organization",
	"See private members of your organization",
	"Be seen in the list of organization members",
	"Use the organization’s payment method",
	"Enable or manage Copilot",
	"Purchase, edit, or cancel Marketplace subscriptions",
	// —— 邀请表单 ——
	"Search by username, full name or email address",
	"Send invitation",
];

/** 上一批（账单联系人区块）已收、本页照常命中的键 */
const SHARED_NODES: readonly [string, string][] = [
	["Billing managers", "账单管理员"],
];

/** 跨模块同键同值：值必须逐字一致（骨架会盯住赢家） */
const CROSS_MODULE_NODES: readonly [string, string][] = [
	["will", "将"],
	[
		"Search by username, full name or email address",
		"按用户名、全名或电子邮件地址搜索",
	],
];

/** 必须保持英文：产品名、用户内容与有意不收录的泛化短词 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 产品名（全仓口径：产品名一律不译）
	"Copilot",
	// 结果列表的 aria-label：泛化短词，且既有两处收录的译文互不相同
	//（pages/settings「结果」/ pages/repo-settings「个结果」），证明它按上下文取值
	"results",
	// 组织名（用户内容）
	"Koishi-CE",
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

describe("账单管理员邀请页的模块路由", () => {
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

	it("does not match the personal settings module", () => {
		const names = matchModules(
			ORG_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy orgs prefix as well", () => {
		const names = matchModules(
			ORG_LEGACY_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		expect(names).toContain("pages/org-settings");
	});

	it("keeps the billing module matched on the personal billing route", () => {
		const names = matchModules(
			PERSONAL_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		expect(names).toContain("pages/settings");
	});
});

describe("账单管理员邀请页的实机节点边界", () => {
	it("translates every newly registered node", () => {
		for (const node of NEW_NODES) {
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

	it("reuses the wording registered by the billing contacts page", () => {
		for (const [raw, expected] of SHARED_NODES) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the cross-module keys identical on both routes", () => {
		for (const [raw, expected] of CROSS_MODULE_NODES) {
			expect(
				translateText(raw, view),
				`组织侧：${raw}`,
			).toBe(expected);
			expect(
				translateText(raw, personalView),
				`个人侧：${raw}`,
			).toBe(expected);
		}
	});

	it("keeps product names and the results label as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("账单管理员邀请页的拆句与冠词节点", () => {
	it("renders the page header with its slash node", () => {
		// 实机渲染是「账单 / 添加账单管理员」：链接节点自身没有空白，斜杠节点自带
		// 前导换行缩进与尾随换行（HTML 折叠空白后就是页面上的斜杠分隔）
		expect(
			renderNodes([
				"Billing",
				"\n         / Add a billing manager\n",
			]),
		).toBe("账单\n         / 添加账单管理员\n");
	});

	it("turns the standalone article into a measure word", () => {
		// 首节点是单字母 `A`（带源码缩进）：中文用「一位」补量词，不留中英残句
		expect(translateText("A", view)).toBe("一位");
		expect(translateText("A ", view)).toBe("一位");
		expect(translateText("\n    A ", view)).toBe("一位");
		// 只命中**整节点恰为 `A`**：`An` / 小写 `a` / 更长的词都不命中
		expect(translateText("An", view)).toBeNull();
		expect(translateText("a", view)).toBeNull();
		expect(
			translateText("A billing manager", view),
		).toBeNull();
	});

	it("renders the billing-manager explanation as one sentence", () => {
		expect(
			renderNodes([
				"\n    A ",
				"billing manager",
				" is a user who manages the billing settings of your organization.\n  ",
			]),
		).toBe(
			"\n    一位 账单管理员 是管理你组织账单设置的用户。\n  ",
		);
	});

	it("renders both permission-list headings across their strong nodes", () => {
		expect(
			renderNodes([
				"\n        Billing managers ",
				"will",
				" have the ability to:\n      ",
			]),
		).toBe(
			"\n        账单管理员 将 能够执行以下操作：\n      ",
		);
		expect(
			renderNodes([
				"\n        Billing managers ",
				"will not",
				" be able to:\n      ",
			]),
		).toBe(
			"\n        账单管理员 无法 执行以下操作：\n      ",
		);
	});
});
