// 会话页（/settings/sessions）实机文本与属性回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，`path` 全为 /settings/sessions），另有一张**未加载本扩展**的
// 原始英文整页截图用于核对条目数量与语义。本页没有途径 B（Console 逐节点采集）的证据，
// 故下面每条键都按「导出条目本身就是一个文本节点」登记——导出里出现整句，说明它在实机里
// 确实是一个节点（被 <a> / <strong> 拆开的句子只会以碎片形式出现在导出里）。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. 移动端说明段被链接切成三段（`…or you can` + `<a>revoke</a>` + 其余），
//      链接两侧的空格落在相邻节点上，译文按节点各收一条；
//   2. 移动端会话行的元信息是「标签节点 + 日期节点」两个节点：标签本体在这里收录，
//      日期由 global 的长日期规则（global/long-date-*）译出，故键只写标签加连字符；
//   3. `Seen in US, KR, CN` 的国家码是动态值，走本模块的规则 settings/session-seen-in
//      （模板「曾出现于 $1」），静态键只能覆盖见过的组合，故不收静态键；
//   4. 属性只走精确命中、**不适用正则规则**：定值属性 `Microsoft Edge on Windows` 收一条，
//      带动态值的 `View details of session from … last accessed …` 结构上翻不了、收键是死键，
//      故不收（下方反例断言把它钉住）。
//
// 刻意**不收录**（下方反例断言）：
//   - 动态地理数据：城市 `San Francisco`（集合无界）、IP `38.107.237.82`（不含拉丁字母，
//     本来就不进可翻译判定）；
//   - 用户内容：设备名 `Ace 6T, PLR110`（实机节点带 emoji 前缀，emoji 不影响匹配）；
//   - 纯专名 / 缩写：`GitHub`、`GitHub Mobile`（不译是既有约定）。
// 未命中即保留英文，这才是正确做法。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /settings/sessions 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/sessions",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（原文逐字录入，顺序按页面出现先后） */
const SESSION_NODES: readonly string[] = [
	// —— Web sessions 区块 ——
	"Web sessions",
	"This is a list of devices that have logged into your account. Revoke any sessions that you do not recognize.",
	// 会话卡：状态点后的状态词、当前会话标注、曾出现地区（走规则）
	"active",
	"Your current session",
	"Seen in US, KR, CN",
	// —— GitHub Mobile sessions 区块 ——
	"GitHub Mobile sessions",
	"This is a list of devices that have logged into your account via the GitHub Mobile app. Revoke any session that you do not recognize or you can",
	"revoke",
	"your GitHub Mobile app authorization to sign out of all your devices.",
	// —— 移动端会话行 ——
	"Revoke",
	"Registered -",
	"Last accessed -",
	"Last used for authentication -",
	"Never used",
];

/** 实机里被翻译的属性值（精确命中语义，不走规则） */
const SESSION_ATTRS: readonly string[] = [
	"Microsoft Edge on Windows",
];

/**
 * 必须保持英文的实机节点：动态地理数据、用户内容、纯专名，
 * 以及带动态值、结构上无法翻译的属性。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"San Francisco",
	"38.107.237.82",
	"Ace 6T, PLR110",
	"GitHub",
	"GitHub Mobile",
	"View details of session from San Francisco last accessed September 27, 2026",
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

describe("会话页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of [
			...SESSION_NODES,
			...SESSION_ATTRS,
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

	it("keeps dynamic data, device names and brand names as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the web session card", () => {
		expect(translateText("Web sessions", view)).toBe(
			"Web 会话",
		);
		expect(
			translateText(
				"This is a list of devices that have logged into your account. Revoke any sessions that you do not recognize.",
				view,
			),
		).toBe(
			"这是一系列已登录你账号的设备。请撤销任何你无法识别的会话。",
		);
		// 状态点与「当前会话」标注：城市与 IP 保持英文（反例已单独断言），
		// 只见证 HTML 结构里它们与状态词同处一张卡
		expect(translateText("active", view)).toBe("活跃");
		expect(
			translateText("Your current session", view),
		).toBe("你的当前会话");
		// 详情按钮文案 "Details" 由 global 既有词条覆盖，截图里已显示「详情」；
		// 带动态城市与日期的 aria-label 则结构上翻不了（见反例断言）
		expect(translateText("Details", view)).toBe("详情");
	});

	it("renders the seen-in line through the dynamic rule", () => {
		// 实机节点是「Seen in + 国家码列表」，国家码是动态值，模板按原样带回
		expect(translateText("Seen in US, KR, CN", view)).toBe(
			"曾出现于 US, KR, CN",
		);
		expect(translateText("Seen in US", view)).toBe(
			"曾出现于 US",
		);
		// 规则以 ^…$ 锚定，别的节点不会被部分替换
		expect(
			translateText("Pages seen in the wild", view),
		).toBeNull();
	});

	it("renders the mobile section across its split nodes", () => {
		// 实机：`…or you can <a>revoke</a> your GitHub Mobile app authorization to sign out of all your devices.`
		// ——链接把整句切成三段，链接两侧的空格落在相邻节点上，拼接后必须读通
		const rendered = renderNodes([
			"This is a list of devices that have logged into your account via the GitHub Mobile app. Revoke any session that you do not recognize or you can",
			" ",
			"revoke",
			" your GitHub Mobile app authorization to sign out of all your devices.",
		]);
		expect(rendered).toBe(
			"这是一系列通过 GitHub Mobile 应用登录过你账号的设备。撤销任何你无法识别的会话，或者你可以 撤销 你的 GitHub Mobile 应用授权，以退出所有设备上的登录。",
		);
		expect(
			translateText("GitHub Mobile sessions", view),
		).toBe("GitHub Mobile 会话");
	});

	it("renders the mobile session metadata rows", () => {
		// 标签与日期是两个节点：标签在这里收录，日期由 global 的长日期规则译出
		expect(
			renderNodes(["Registered -", " ", "April 4, 2026"]),
		).toBe("注册时间 - 2026 年 4 月 4 日");
		expect(
			renderNodes([
				"Last accessed -",
				" ",
				"September 19, 2026",
			]),
		).toBe("上次访问时间 - 2026 年 9 月 19 日");
		expect(
			translateText("Last used for authentication -", view),
		).toBe("上次用于身份验证 -");
		// 从未用于身份验证时的占位文案（斜体）
		expect(
			renderNodes([
				"Last used for authentication -",
				" ",
				"Never used",
			]),
		).toBe("上次用于身份验证 - 从未使用");
		// 撤销按钮（移动端会话卡右侧；与链接文本 revoke 是两个大小写不同的键）
		expect(translateText("Revoke", view)).toBe("撤销");
		expect(translateText("revoke", view)).toBe("撤销");
	});

	it("translates the fixed device attribute but not the dynamic one", () => {
		// 属性走的是同一套精确命中（walker 的 TRANSLATABLE_ATTRS + lookup），
		// 故这里用 translateText 断言即可
		expect(
			translateText("Microsoft Edge on Windows", view),
		).toBe("Windows 上的 Microsoft Edge");
		// 带动态城市与日期的无障碍文案：属性不适用规则，收键必是死键
		expect(
			translateText(
				"View details of session from San Francisco last accessed September 27, 2026",
				view,
			),
		).toBeNull();
	});
});
