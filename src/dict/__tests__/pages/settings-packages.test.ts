// 软件包个人设置页（/settings/packages）实机文本与属性回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，`path` 全为 /settings/packages），没有途径 B
// （Console 逐节点采集）的证据，故按「导出条目本身就是一个文本节点」登记。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. 搜索框的 `Search deleted packages` 同时是 aria-label 与 placeholder（同串，一条键覆盖）；
//   2. 已删除软件包区块的空状态含动态用户名（`No recoverable packages were found for Oppenheymu.`），
//      走 `settings/no-recoverable-packages` 规则、用户名按原样带回；
//   3. 本页的「包」沿用既有译法**软件包**（侧栏 `Packages` 已是「软件包」），
//      格式名 Container / npm / rubygems / NuGet 保留原文。
//
// 刻意**不收录**（下方反例断言）：`Copilot`、`GitHub`（title）等纯专名，
// 以及用户名、头像 alt 等用户内容。未命中即保留英文，这才是正确做法。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /settings/packages 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/packages",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（原文逐字录入） */
const PACKAGES_NODES: readonly string[] = [
	"Packages permissions",
	"Inherit access from source repository",
	"Default Package Setting",
	"This setting will be applied to new Container, npm, rubygems and NuGet packages.",
	"Deleted Packages",
	"These are packages that have been previously deleted belonging to you. You can restore a package deleted within the last 30 days.",
	// 动态用户名的空状态（规则覆盖）
	"No recoverable packages were found for Oppenheymu.",
];

/** 实机可翻译属性（与同文案的文本节点同键，或本页独有的无障碍文案） */
const PACKAGES_ATTRS: readonly string[] = [
	"Search deleted packages",
];

/** 必须保持英文的实机节点：纯专名与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Copilot",
	"GitHub",
	"Oppenheymu",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("软件包个人设置页的实机节点边界", () => {
	it("translates every text node and attribute GitHub actually renders", () => {
		for (const node of [
			...PACKAGES_NODES,
			...PACKAGES_ATTRS,
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

	it("keeps brand names and user content as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the permissions block", () => {
		expect(
			translateText("Packages permissions", view),
		).toBe("软件包权限");
		expect(
			translateText(
				"Inherit access from source repository",
				view,
			),
		).toBe("从源仓库继承访问权限");
	});

	it("renders the default package setting block", () => {
		expect(
			translateText("Default Package Setting", view),
		).toBe("默认软件包设置");
		// 格式名保留原文，只译句子骨架
		expect(
			translateText(
				"This setting will be applied to new Container, npm, rubygems and NuGet packages.",
				view,
			),
		).toBe(
			"此设置将应用于新建的 Container、npm、rubygems 和 NuGet 软件包。",
		);
	});

	it("renders the deleted-packages block and its dynamic empty state", () => {
		expect(translateText("Deleted Packages", view)).toBe(
			"已删除的软件包",
		);
		expect(
			translateText(
				"These are packages that have been previously deleted belonging to you. You can restore a package deleted within the last 30 days.",
				view,
			),
		).toBe(
			"这些是你此前删除的、属于你的软件包。你可以恢复在过去 30 天内删除的软件包。",
		);
		// 搜索框（aria-label 与 placeholder 同串）
		expect(
			translateText("Search deleted packages", view),
		).toBe("搜索已删除的软件包");
		// 空状态：用户名是动态值，按原样带回
		expect(
			translateText(
				"No recoverable packages were found for Oppenheymu.",
				view,
			),
		).toBe("未找到 Oppenheymu 的可恢复软件包。");
		expect(
			translateText(
				"No recoverable packages were found for octocat.",
				view,
			),
		).toBe("未找到 octocat 的可恢复软件包。");
	});
});
