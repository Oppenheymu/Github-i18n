// 组织级网络钩子列表页（/organizations/<组织>/settings/hooks）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML（`#hooks_bucket`）。它是**服务端渲染的 ERB
// 页面**（`data-pjax` + `<div class="boxed-group hooks-listing">`，不是 React 重写页），
// 与仓库级 `/owner/repo/settings/hooks` 是同一套模板——而那一套词条整包躺在
// pages/repo-settings 里，那条路由**排除 organizations|orgs**，故组织路径上一条都不命中。
// 页头 h1 已是中文的 `网络钩子`（本模块侧栏的既有键 `Webhooks`）正是对照物。
//
// 三条边界事实：
//   1. 页首说明句在实机是**单个文本节点**：源码里它被换行与缩进拆成四行
//      （`Webhooks allow … happen.` / `When the specified events happen, …` /
//      `Learn more in our`），但中间没有任何元素，故浏览器里只有一个 text node，
//      normalizeKey 把换行与连续空白折叠成单空格——与仓库级那条规则当初的**推测**一致，
//      本次由 HTML 证实（用例直接用带换行缩进的原文断言）；
//   2. 这句只被 `<a>Webhooks Guide</a>` 切开一次，链接后面那个 `.` 是**独立的纯符号
//      节点**（引擎按设计跳过）⇒ 中文末尾留一个半角句点，链接文字另成一条键；
//   3. 撇号在 HTML 里是**直撇号** `we'll`（不再是未知量）；本模块的规则与仓库级**同
//      pattern**，故两种撇号都接得住，用例把两种形态都钉住。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织级网络钩子列表页 */
const PAGE_PATH = "/organizations/Koishi-CE/settings/hooks";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/hooks";
/** 仓库级的同款页面：本批三条同串词条在那边，用于断言两边逐字同译 */
const REPO_PATH = "/Oppenheymu/Github-i18n/settings/hooks";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));
const view = buildView(PAGE_PATH, locale, aliases);
const repoView = buildView(REPO_PATH, locale, aliases);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本批补的静态键（与仓库级同串，逐字同译） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	["Add webhook", "添加网络钩子"],
	["Webhooks Guide", "网络钩子指南"],
];

/** 说明句：原文在源码里带换行与缩进，normalizeKey 折叠后才是键的形态 */
const INTRO_NODE =
	"\n    Webhooks allow external services to be notified when certain events happen.\n    When the specified events happen, we'll send a POST request to each of the URLs you provide.\n    Learn more in our ";
const INTRO_EXPECTED =
	"网络钩子让外部服务能在特定事件发生时收到通知。当指定的事件发生时，我们会向你提供的每个 URL 发送 POST 请求。进一步了解我们的";

/** 扩展在本页已生效的对照物 */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [["Webhooks", "网络钩子"]];

/** 按 walker 语义翻译节点，保留原文首尾空白后拼接 */
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

describe("组织级网络钩子列表页的模块路由", () => {
	it("loads org-settings and the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match repository or account settings", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy organization prefix", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织级网络钩子列表页的实机节点", () => {
	it("translates the shared strings exactly like the repository module", () => {
		for (const [raw, expected] of NEW_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			// 仓库级模块的同串在组织路径上不命中，故各收一份并钉成同译
			expect(
				translateText(raw, repoView),
				`与仓库级模块不同译：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the already translated heading working", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(
				translateText(raw, view),
				`对照物失效：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the organization and the DOM ids in English", () => {
		for (const raw of ["Koishi-CE", "hooks_bucket"]) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织级网络钩子列表页的说明句", () => {
	it("folds the source newlines and indentation into the rule", () => {
		// 实机 nodeValue 自带四行源码的缩进与换行——normalizeKey 折叠后命中规则
		expect(translateText(INTRO_NODE, view)).toBe(
			INTRO_EXPECTED,
		);
		// 与仓库级同 pattern 同模板
		expect(translateText(INTRO_NODE, repoView)).toBe(
			INTRO_EXPECTED,
		);
	});

	it("takes both apostrophe forms", () => {
		const curly = INTRO_NODE.replace("we'll", "we\u2019ll");
		expect(translateText(curly, view)).toBe(INTRO_EXPECTED);
	});

	it("leaves a differently split sentence in English", () => {
		// 规则锚定整句：上游若把 `Learn more in our` 那段另起节点（或整句改写），
		// 前半句不会被单独翻出来当中英残句
		expect(
			translateText(
				"Webhooks allow external services to be notified when certain events happen.",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"Webhooks allow external services to be notified when certain events happen. When the specified events happen, we'll send a POST request to each of the URLs you provide.",
				view,
			),
		).toBeNull();
	});

	it("renders the paragraph with its link and the lone period", () => {
		// `.` 是链接之外的独立纯符号节点，引擎跳过 ⇒ 中文以「我们的 网络钩子指南.」收尾。
		// 另外注意开头的 `\n    `：walker 保留节点首尾空白（只翻中间的文字），
		// 这段缩进在 HTML 里会被折叠成一个空格、不影响观感，但它确实留在 nodeValue 里，
		// 故按 walker 语义复刻的拼接结果带着它；第二条断言把「去掉首尾空白后读作一整句」
		// 也钉住，免得下次有人把这段缩进当成漏翻。
		expect(
			renderNodes([INTRO_NODE, "Webhooks Guide", "."]),
		).toBe(`\n    ${INTRO_EXPECTED} 网络钩子指南.`);
		expect(
			renderNodes([
				INTRO_NODE,
				"Webhooks Guide",
				".",
			]).trim(),
		).toBe(`${INTRO_EXPECTED} 网络钩子指南.`);
	});
});
