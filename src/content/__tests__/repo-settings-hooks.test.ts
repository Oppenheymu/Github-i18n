// 仓库设置页的「网络钩子」两支（/owner/repo/settings/hooks 列表页与 …/hooks/new 新建页）
// 实机文本回归。
//
// 证据：维护者 2026-09-27 贴的**两张截图**（没有漏翻清单、没有 HTML）。
// 截图只能证明「哪些字显示出来了」，证明不了节点边界，故两句长说明**全部走规则**
// （见 core/rules.jsonc 的 repo-settings/webhooks-*），本文件的断言把两种不确定性都锁住：
//   1. 撇号 `we'll` / `you'd` 是直是弯——pattern 用字符类同时覆盖，两种都要命中；
//   2. 新建页那句里的 `x-www-form-urlencoded` 是否被 <code> 包住——若包住，
//      「链接前的那一段」会再被切成两段，故不拆分与拆分两种形态各断言一次。
//
// 不收录：仓库名、用户名、产品名、快捷键提示（未命中即保留英文）。
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

/** 截图里明确独立成元素的串（按钮 / 链接文本 / 表单标签 / 单选标签） */
const NODES: readonly (readonly [string, string])[] = [
	["Add webhook", "添加网络钩子"],
	["Webhooks Guide", "网络钩子指南"],
	// 必填标记 `*` 可能独立成节点，两种形态都要能命中
	["Payload URL", "负载 URL"],
	["Payload URL *", "负载 URL *"],
	["Content type", "内容类型"],
	["Content type *", "内容类型 *"],
	["Secret", "机密"],
	["SSL verification", "SSL 验证"],
	[
		"By default, we verify SSL certificates when delivering payloads.",
		"默认情况下，我们在投递负载时会验证 SSL 证书。",
	],
	["Enable SSL verification", "启用 SSL 验证"],
	["Disable (not recommended)", "禁用（不推荐）"],
	[
		"Which events would you like to trigger this webhook?",
		"你希望哪些事件触发此网络钩子？",
	],
	["Just the push event.", "仅推送事件。"],
	["Send me everything.", "发送所有事件。"],
	[
		"Let me select individual events.",
		"让我选择单个事件。",
	],
	[
		"We will deliver event details when this hook is triggered.",
		"此钩子触发时，我们将投递事件详情。",
	],
	// 链接文本：前段已以「更多信息可在我们的」结尾，故这里只译「开发者文档」
	["our developer documentation", "开发者文档"],
];

describe("仓库设置页的网络钩子两支实机节点边界", () => {
	it("translates the strings that are visibly standalone in the screenshots", () => {
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

	it("translates the list page intro whichever apostrophe upstream uses", () => {
		const expected =
			"网络钩子让外部服务能在特定事件发生时收到通知。当指定的事件发生时，我们会向你提供的每个 URL 发送 POST 请求。进一步了解我们的";
		const body =
			"Webhooks allow external services to be notified when certain events happen. When the specified events happen, ";
		const tail =
			" send a POST request to each of the URLs you provide. Learn more in our";
		// 直撇号
		expect(translateText(`${body}we'll${tail}`, view)).toBe(
			expected,
		);
		// 弯撇号
		expect(translateText(`${body}we’ll${tail}`, view)).toBe(
			expected,
		);
	});

	it("translates the new page intro in both code-split shapes", () => {
		// 形态一：`x-www-form-urlencoded` 不在 <code> 里，整段到链接前是一个节点
		expect(
			translateText(
				"We'll send a POST request to the URL below with details of any subscribed events. You can also specify which data format you'd like to receive (JSON, x-www-form-urlencoded, etc). More information can be found in",
				view,
			),
		).toBe(
			"我们会向你下方提供的 URL 发送包含所订阅事件详情的 POST 请求。你还可以指定希望接收的数据格式（JSON、x-www-form-urlencoded、等等）。更多信息可在我们的",
		);
		// 形态二：它在 <code> 里，链接前的那段被切成两半（中间那段引擎不翻）
		expect(
			translateText(
				"We'll send a POST request to the URL below with details of any subscribed events. You can also specify which data format you'd like to receive (JSON,",
				view,
			),
		).toBe(
			"我们会向你下方提供的 URL 发送包含所订阅事件详情的 POST 请求。你还可以指定希望接收的数据格式（JSON、",
		);
		expect(
			translateText(
				", etc). More information can be found in",
				view,
			),
		).toBe("、等等）。更多信息可在我们的");
		// 弯撇号 + 形态一
		expect(
			translateText(
				"We’ll send a POST request to the URL below with details of any subscribed events. You can also specify which data format you’d like to receive (JSON, x-www-form-urlencoded, etc). More information can be found in",
				view,
			),
		).toBe(
			"我们会向你下方提供的 URL 发送包含所订阅事件详情的 POST 请求。你还可以指定希望接收的数据格式（JSON、x-www-form-urlencoded、等等）。更多信息可在我们的",
		);
	});

	it("reassembles the two intros with their link text", () => {
		// 复刻 walker 的空白保留语义（见 repo-settings-code-review-limits.test.ts）
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
				"Webhooks allow external services to be notified when certain events happen. When the specified events happen, we'll send a POST request to each of the URLs you provide. Learn more in our ",
				"Webhooks Guide",
				".",
			]),
		).toBe(
			"网络钩子让外部服务能在特定事件发生时收到通知。当指定的事件发生时，我们会向你提供的每个 URL 发送 POST 请求。进一步了解我们的 网络钩子指南.",
		);
		expect(
			renderWithWhitespace([
				"We'll send a POST request to the URL below with details of any subscribed events. You can also specify which data format you'd like to receive (JSON, x-www-form-urlencoded, etc). More information can be found in ",
				"our developer documentation",
				".",
			]),
		).toBe(
			"我们会向你下方提供的 URL 发送包含所订阅事件详情的 POST 请求。你还可以指定希望接收的数据格式（JSON、x-www-form-urlencoded、等等）。更多信息可在我们的 开发者文档.",
		);
	});

	it("keeps the sidebar Webhooks and the account names in english side alone", () => {
		// 侧栏那条 Webhooks 是既有的静态词条，与本页新键互不影响
		expect(translateText("Webhooks", view)).toBe(
			"网络钩子",
		);
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
