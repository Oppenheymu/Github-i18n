// 公开资料页（/settings/profile）的 ORCID 区块实机文本与属性回归。
//
// 边界强度：**实机截图 + 实机 HTML 实证**（2026-09-27 维护者连接 ORCID 后提供）。这一区块的
// **上半部分**（H2 `ORCID iD`、`Connect your ORCID iD` 与那句 ORCID.org 说明）早已有词条，
// 连接成功后**多出**：已连接提示、显示开关、断开说明与断开按钮——本文件锁住它们。
//
// 关键边界事实：
//   1. **已连接提示的真实边界**（HTML 确证：两个值都被 `<strong>` 包住）：
//      `You have a connected ORCID iD` + <strong>标识符</strong> + `for the account` +
//      <strong>@账户</strong> + `.`
//      ——整句被切成四段以上、句号也独立成节点，故收的是两段碎片键。
//      上一轮按截图推断的「整句单节点 + 双命名组规则」因此永不命中，已随本次修正删除
//      （与 security-log 事件行同一种翻车方式：**截图看不出被元素包住的值**）；
//   2. `ORCID iD` 这个键的译文**绝不能与键同形**——2026-09 的卡死事故就是
//      `"ORCID iD": "ORCID iD"` 触发的「命中 → 写入 → 再命中」自转（见 docs/guides/development.md）；
//      本文件用一条断言把它钉成「必须含中文」；
//   3. 标识符本身（`0009-0003-4314-5082`）与 `@用户名` 是动态值 / 用户内容，保留英文。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /settings/profile 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/profile",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** ORCID 区块的实机文本节点（连接成功后渲染的那部分 + 连接前的入口） */
const ORCID_NODES: readonly string[] = [
	// 连接前 / 连接后共有的标签与入口
	"ORCID iD",
	"Connect your ORCID iD",
	// 已连接提示的两段碎片（两个值都在 <strong> 里，各自成节点）
	"You have a connected ORCID iD",
	"for the account",
	// 显示开关、断开说明与断开按钮
	"Display your ORCID iD on your GitHub profile",
	"Disconnecting your ORCID iD may affect areas of your profile where your ORCID iD is displayed.",
	"Disconnect your ORCID iD",
];

/** 必须保持英文的实机节点：动态标识符、用户内容与已删除的整句形态 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"0009-0003-4314-5082",
	"@Oppenheymu",
	"Oppenheymu",
	// 整句形态在实机并不存在（值被 <strong> 包住），对应的规则已删除：
	// 它现在必须返回 null，防止那条死规则被谁重新加回来
	"You have a connected ORCID iD 0009-0003-4314-5082 for the account @Oppenheymu.",
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

/**
 * 公开资料表单（/settings/profile 的上半部分）的实机文本节点与可翻译属性。
 * 证据：2026-10 维护者提供的实机 HTML（`form.js-profile-editable-form`）。
 *
 * 边界事实：
 *   1. `You can <strong>@mention</strong> other users and organizations to link to them.`
 *      —— `<strong>` 把整句切成三段，`@mention` 单独成节点且保持英文；
 *   2. 字段名同时以 **label 文本** 与 **placeholder / aria-label 属性** 两种形态出现，
 *      两条路径共用同一批键（属性只走精确命中，见 content/walker.ts 的 TRANSLATABLE_ATTRS）；
 *   3. 个人资料的网址字段上游已从 `URL` 改名为 `Website`，两条键并存。
 */
const FORM_NODES: readonly string[] = [
	"Name",
	"Bio",
	"Add a bio",
	"Pronouns",
	"Don't specify",
	"Custom",
	"Company",
	"Location",
	"Display current local time",
	"Time zone",
	"Email",
	"Website",
	"Display your ORCID iD",
	"Social accounts",
	"Social account",
	"Link to social profile 1",
	"Link to social profile 2",
	"Link to social profile 3",
	"Link to social profile 4",
	"You can",
	"other users and organizations to link to them.",
];

/**
 * 页面上必须保持英文的实机节点：用户内容、代词档位与 `<option>` 的标识符。
 * 最后三条尤其重要——`value="Beijing"` 这类标识符是**表单提交值**，
 * 引擎只翻按钮类 `<input>` 的 value（isButtonInputValue），
 * 一旦有人把裸地名收成键，时区选择就会把提交值改坏。
 */
const FORM_MUST_STAY_ENGLISH: readonly string[] = [
	"M. Oppenheymu",
	"Oppenheymu@pm.me",
	"oppenheymu@gmail.com",
	"https://x.com/Oppenheymu",
	"@mention",
	"they/them",
	"she/her",
	"he/him",
	"Beijing",
	"Hong Kong",
	"UTC",
];

/** 时区下拉的全部 `<option>` 可见文本（实机 HTML 逐字；GMT 偏移前缀原样保留） */
const TIME_ZONE_NODES: readonly string[] = [
	"(GMT-12:00) International Date Line West",
	"(GMT-11:00) American Samoa",
	"(GMT-11:00) Midway Island",
	"(GMT-10:00) Hawaii",
	"(GMT-09:00) Alaska",
	"(GMT-08:00) Pacific Time (US & Canada)",
	"(GMT-08:00) Tijuana",
	"(GMT-07:00) Arizona",
	"(GMT-07:00) Mazatlan",
	"(GMT-07:00) Mountain Time (US & Canada)",
	"(GMT-06:00) Central America",
	"(GMT-06:00) Central Time (US & Canada)",
	"(GMT-06:00) Chihuahua",
	"(GMT-06:00) Guadalajara",
	"(GMT-06:00) Mexico City",
	"(GMT-06:00) Monterrey",
	"(GMT-06:00) Saskatchewan",
	"(GMT-05:00) Bogota",
	"(GMT-05:00) Eastern Time (US & Canada)",
	"(GMT-05:00) Indiana (East)",
	"(GMT-05:00) Lima",
	"(GMT-05:00) Quito",
	"(GMT-04:00) Atlantic Time (Canada)",
	"(GMT-04:00) Caracas",
	"(GMT-04:00) Georgetown",
	"(GMT-04:00) La Paz",
	"(GMT-04:00) Puerto Rico",
	"(GMT-04:00) Santiago",
	"(GMT-03:30) Newfoundland",
	"(GMT-03:00) Asuncion",
	"(GMT-03:00) Brasilia",
	"(GMT-03:00) Buenos Aires",
	"(GMT-03:00) Montevideo",
	"(GMT-02:00) Greenland",
	"(GMT-02:00) Mid-Atlantic",
	"(GMT-01:00) Azores",
	"(GMT-01:00) Cape Verde Is.",
	"(GMT+00:00) Edinburgh",
	"(GMT+00:00) Lisbon",
	"(GMT+00:00) London",
	"(GMT+00:00) Monrovia",
	"(GMT+00:00) UTC",
	"(GMT+01:00) Amsterdam",
	"(GMT+01:00) Belgrade",
	"(GMT+01:00) Berlin",
	"(GMT+01:00) Bern",
	"(GMT+01:00) Bratislava",
	"(GMT+01:00) Brussels",
	"(GMT+01:00) Budapest",
	"(GMT+01:00) Casablanca",
	"(GMT+01:00) Copenhagen",
	"(GMT+01:00) Dublin",
	"(GMT+01:00) Ljubljana",
	"(GMT+01:00) Madrid",
	"(GMT+01:00) Paris",
	"(GMT+01:00) Prague",
	"(GMT+01:00) Rome",
	"(GMT+01:00) Sarajevo",
	"(GMT+01:00) Skopje",
	"(GMT+01:00) Stockholm",
	"(GMT+01:00) Vienna",
	"(GMT+01:00) Warsaw",
	"(GMT+01:00) West Central Africa",
	"(GMT+01:00) Zagreb",
	"(GMT+01:00) Zurich",
	"(GMT+02:00) Athens",
	"(GMT+02:00) Bucharest",
	"(GMT+02:00) Cairo",
	"(GMT+02:00) Harare",
	"(GMT+02:00) Helsinki",
	"(GMT+02:00) Jerusalem",
	"(GMT+02:00) Kaliningrad",
	"(GMT+02:00) Kyiv",
	"(GMT+02:00) Pretoria",
	"(GMT+02:00) Riga",
	"(GMT+02:00) Sofia",
	"(GMT+02:00) Tallinn",
	"(GMT+02:00) Vilnius",
	"(GMT+03:00) Baghdad",
	"(GMT+03:00) Istanbul",
	"(GMT+03:00) Kuwait",
	"(GMT+03:00) Minsk",
	"(GMT+03:00) Moscow",
	"(GMT+03:00) Nairobi",
	"(GMT+03:00) Riyadh",
	"(GMT+03:00) St. Petersburg",
	"(GMT+03:00) Volgograd",
	"(GMT+03:30) Tehran",
	"(GMT+04:00) Abu Dhabi",
	"(GMT+04:00) Baku",
	"(GMT+04:00) Muscat",
	"(GMT+04:00) Samara",
	"(GMT+04:00) Tbilisi",
	"(GMT+04:00) Yerevan",
	"(GMT+04:30) Kabul",
	"(GMT+05:00) Almaty",
	"(GMT+05:00) Astana",
	"(GMT+05:00) Ekaterinburg",
	"(GMT+05:00) Islamabad",
	"(GMT+05:00) Karachi",
	"(GMT+05:00) Tashkent",
	"(GMT+05:30) Chennai",
	"(GMT+05:30) Kolkata",
	"(GMT+05:30) Mumbai",
	"(GMT+05:30) New Delhi",
	"(GMT+05:30) Sri Jayawardenepura",
	"(GMT+05:45) Kathmandu",
	"(GMT+06:00) Dhaka",
	"(GMT+06:00) Urumqi",
	"(GMT+06:30) Rangoon",
	"(GMT+07:00) Bangkok",
	"(GMT+07:00) Hanoi",
	"(GMT+07:00) Jakarta",
	"(GMT+07:00) Krasnoyarsk",
	"(GMT+07:00) Novosibirsk",
	"(GMT+08:00) Beijing",
	"(GMT+08:00) Chongqing",
	"(GMT+08:00) Hong Kong",
	"(GMT+08:00) Irkutsk",
	"(GMT+08:00) Kuala Lumpur",
	"(GMT+08:00) Perth",
	"(GMT+08:00) Singapore",
	"(GMT+08:00) Taipei",
	"(GMT+08:00) Ulaanbaatar",
	"(GMT+09:00) Osaka",
	"(GMT+09:00) Sapporo",
	"(GMT+09:00) Seoul",
	"(GMT+09:00) Tokyo",
	"(GMT+09:00) Yakutsk",
	"(GMT+09:30) Adelaide",
	"(GMT+09:30) Darwin",
	"(GMT+10:00) Brisbane",
	"(GMT+10:00) Canberra",
	"(GMT+10:00) Guam",
	"(GMT+10:00) Hobart",
	"(GMT+10:00) Melbourne",
	"(GMT+10:00) Port Moresby",
	"(GMT+10:00) Sydney",
	"(GMT+10:00) Vladivostok",
	"(GMT+11:00) Magadan",
	"(GMT+11:00) New Caledonia",
	"(GMT+11:00) Solomon Is.",
	"(GMT+11:00) Srednekolymsk",
	"(GMT+12:00) Auckland",
	"(GMT+12:00) Fiji",
	"(GMT+12:00) Kamchatka",
	"(GMT+12:00) Marshall Is.",
	"(GMT+12:00) Wellington",
	"(GMT+12:45) Chatham Is.",
	"(GMT+13:00) Nuku'alofa",
	"(GMT+13:00) Samoa",
	"(GMT+13:00) Tokelau Is.",
];

describe("公开资料页 ORCID 区块的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of ORCID_NODES) {
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

	it("keeps the identifier and the account as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("never maps the ORCID label onto itself (the 2026-09 freeze)", () => {
		// 值必须含中文字系、且不得等于键——同形会让观察器在微任务队列里无限自转
		expect(translateText("ORCID iD", view)).toBe(
			"ORCID 标识符",
		);
		expect(translateText("ORCID iD", view)).not.toBe(
			"ORCID iD",
		);
	});

	it("renders the connected notice with the boundaries the HTML proves", () => {
		// 实机：`<p class="note my-2">You have a connected ORCID iD <strong>…</strong>
		// for the account <strong>@…</strong>.</p>`
		expect(
			renderNodes([
				"\n  You have a connected ORCID iD\n  ",
				"0009-0003-4314-5082",
				"\n  for the account\n  ",
				"@Oppenheymu",
				".",
			]),
		).toBe(
			"\n  你已连接的 ORCID iD 为\n  0009-0003-4314-5082\n  ，对应账户为\n  @Oppenheymu.",
		);
		// 两段碎片键各自也成立
		expect(
			translateText("You have a connected ORCID iD", view),
		).toBe("你已连接的 ORCID iD 为");
		expect(translateText("for the account", view)).toBe(
			"，对应账户为",
		);
	});

	it("renders the toggle, the notice and the disconnect button", () => {
		expect(
			translateText(
				"Display your ORCID iD on your GitHub profile",
				view,
			),
		).toBe("在你的 GitHub 个人资料中显示你的 ORCID iD");
		expect(
			translateText(
				"Disconnecting your ORCID iD may affect areas of your profile where your ORCID iD is displayed.",
				view,
			),
		).toBe(
			"断开你的 ORCID iD 可能会影响你个人资料中显示 ORCID iD 的区域。",
		);
		expect(
			translateText("Disconnect your ORCID iD", view),
		).toBe("断开你的 ORCID iD");
		// 连接前的入口（既有词条）
		expect(
			translateText("Connect your ORCID iD", view),
		).toBe("连接你的 ORCID iD");
	});
});

describe("公开资料表单（/settings/profile）的实机节点边界", () => {
	it("translates the labels, placeholders and option texts", () => {
		for (const node of FORM_NODES) {
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

	it("keeps user content, pronouns and option identifiers as-is", () => {
		for (const raw of FORM_MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the @mention hint with the boundaries the HTML proves", () => {
		// 实机：`You can <strong>@mention</strong> other users and organizations to link to them.`
		// 前导空格由 walker 保留，译文不自带首尾空格，故拼出来正好是一句
		expect(
			renderNodes([
				"\n        You can ",
				"@mention",
				" other users and organizations to link to them.\n      ",
			]),
		).toBe(
			"\n        你可以 @mention 其他用户和组织来链接他们。\n      ",
		);
	});

	it("translates every time zone option and keeps the GMT offset", () => {
		// 152 条是实机 HTML 里的 option 总数：数量断言能挡住「误删一半条目」这类回归
		expect(TIME_ZONE_NODES.length).toBe(152);
		for (const node of TIME_ZONE_NODES) {
			const translated = translateText(node, view);
			expect(translated, `未命中：${node}`).not.toBeNull();
			const offset = node.slice(0, node.indexOf(") ") + 2);
			expect(
				(translated ?? "").startsWith(offset),
				`GMT 前缀被改动：${translated ?? ""}`,
			).toBe(true);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
		// 代表性条目：偏移前缀保留、地名为中文
		expect(
			translateText("(GMT+08:00) Hong Kong", view),
		).toBe("(GMT+08:00) 香港");
		expect(
			translateText(
				"(GMT-08:00) Pacific Time (US & Canada)",
				view,
			),
		).toBe("(GMT-08:00) 太平洋时间（美国和加拿大）");
	});
});
