// 组织沙盒设置页（/organizations/<组织>/settings/sandboxes）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML（从 `Layout-main` 起，采集时扩展仍在运行）。
// 本页是**纯 SSR**（Rails 表单，没有 react-partial），路由挂在 `settings` 前缀下、
// 一点也不缺路径，缺的只有 6 条本页专属文案 + 一个 `Enabled`。
//
// 这份 HTML 的特别价值是它自带**跨页确认**：h2 的 `Sandboxes` 命中本模块既有词条
//（「沙盒」）之外，**第一个单选项的标签 `Disabled` 已经是「禁用」**——那正是上一批
//（组织代码空间设置页）刚登记的键，等于实机确认它在本模块的另一个页面上也生效；
// 而第二个单选项的 `Enabled` 仍是英文，正是本批要补的那一条。
//
// 本文件锁四件事：
//   ① 路由：命中 pages/org-settings + global，不命中 pages/repo-settings / pages/settings；
//   ② 7 条键（标题 / 说明句 / 条款句前两段 / `Enabled` / 两条单选项注解）全部命中；
//   ③ 节点切分事实：条款句被 `<a>` 切成三段，而**末段只有一个句点**——纯符号节点不含
//      拉丁字母、被守卫按设计跳过，故中文末尾原样留着半角句点（用例正面钉住）；
//   ④ 反例：radio 的 `value`（`disabled` / `all_members`）与表单值 / 标识符
//      （`put` / `off` / `github_sandbox_enabled`）必须保持英文——尤其 `disabled`
//      与既有的 `Disabled` 只差大小写，查表是大小写敏感的，收错就会改坏表单值。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织沙盒设置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/sandboxes";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/sandboxes";

const locale = dictForLocale("zh-CN");

const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 实机里仍是英文的文本节点（按页面自上而下的顺序） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	["Cloud sandbox access", "云端沙盒访问"],
	[
		"Manage cloud sandbox access for your organization's members.",
		"管理组织成员访问云端沙盒的权限。",
	],
	// 条款句：被 `<a>` 切成三段，这里是前两段（第三段只有一个句点，见下面的切分用例）
	[
		"If preview features are enabled, you agree to the",
		"如果启用了预览功能，即表示你同意",
	],
	["Pre-Release Terms", "预发布条款"],
	// 第二个单选项的标签（第一个是「禁用」，已由上一批的 `Disabled` 译出）
	["Enabled", "启用"],
	[
		"Cloud sandbox access is not available for organization members.",
		"组织成员无法使用云端沙盒。",
	],
	[
		"Members of this organization can use cloud sandboxes.",
		"此组织的成员可以使用云端沙盒。",
	],
];

/** 本批之前就已生效的对照物（含上一批的键在本页跨页生效） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Sandboxes", "沙盒"],
	["Disabled", "禁用"],
	["Save", "保存"],
];

/** 表单值 / 标识符 / 用户内容，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"disabled",
	"all_members",
	"put",
	"off",
	"github_sandbox_enabled",
	"Koishi-CE",
];

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白，最后拼接成页面上真实看到的那一行。
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

describe("组织沙盒设置页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the per-repository or per-account modules", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy prefix", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织沙盒设置页的实机节点", () => {
	it("translates every node that the real page still showed in English", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps form values and identifiers in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("keeps the lower-case radio value apart from the label key", () => {
		// `Disabled`（标签）与 `disabled`（radio 的 value）只差大小写：
		// 前者是词条、后者是表单值。查表大小写敏感，这条钉住两者不会互相污染
		expect(translateText("Disabled", view)).toBe("禁用");
		expect(translateText("disabled", view)).toBeNull();
	});
});

describe("组织沙盒设置页的节点切分事实", () => {
	it("renders the header block", () => {
		expect(
			renderNodes([
				"Cloud sandbox access",
				"Manage cloud sandbox access for your organization's members.",
			]),
		).toBe("云端沙盒访问管理组织成员访问云端沙盒的权限。");
	});

	it("leaves the lone period of the terms sentence alone", () => {
		// 实机：`… you agree to the <a>Pre-Release Terms</a>.`——三段文本节点，
		// 第三段只有一个句点；它不含拉丁字母，守卫按设计跳过（同「纯符号节点翻不了」
		// 那条既成事实），故中文末尾原样留着半角句点，断句落在前两段
		expect(
			renderNodes([
				"\n        If preview features are enabled, you agree to the ",
				"Pre-Release Terms",
				".\n      ",
			]),
		).toBe(
			"\n        如果启用了预览功能，即表示你同意 预发布条款.\n      ",
		);
		expect(translateText(".", view)).toBeNull();
	});

	it("renders the radio group from its English source", () => {
		// 上游两个单选项是 `Disabled` / `Enabled` + 各自的 `<p class="note">`；
		// 贴出的 HTML 里第一项已是「禁用」（上一批的键跨页生效），用例从英文源渲染
		expect(
			renderNodes([
				"Disabled",
				"Cloud sandbox access is not available for organization members.",
				"Enabled",
				"Members of this organization can use cloud sandboxes.",
			]),
		).toBe(
			"禁用组织成员无法使用云端沙盒。启用此组织的成员可以使用云端沙盒。",
		);
	});
});
