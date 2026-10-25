// 个人 / 组织主页的实机节点回归：仓库列表筛选菜单、结果摘要、私有贡献摘要，
// 以及左侧栏的内联「编辑资料」表单（2026-10-06 由维护者的实机 HTML + 截图确认，
// 见文件末尾的 describe —— 那批文案此前误登记在 pages/settings，本页取不到）。
//
// 证据强度：**截图 + 维护者在实机采集的文本节点 dump**（2026-09 本页会话）。
//   - 截图 `https://github.com/Oppenheymu?tab=repositories&type=source`：Type 下拉展开后
//     只见 "Can be sponsored" 与 "Templates" 两项仍是英文（其余七项已是中文），
//     故这两条是待补项，其余键只做**回归锁定**，不重复登记；
//   - 同页 Console 的节点 dump（逐字录入下方常量）：结果摘要行被 <strong> 切成五个节点，
//     `a.issues-reset-query` 的文本节点是 `"\n          Clear filter\n"`，
//     两者都按采集到的原文（含真实换行缩进）断言。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. 菜单项都是**单节点短词**，与仓库名 / 用户名同形风险高，故必须锁「整节点相等」，
//      而不是「含中文」——后者会放过把菜单项关联到错误译文的情况；
//   2. 菜单里 All / Public / Private / Archived / Forks 由 global 模块覆盖、Sources / Mirrors
//      由 pages/profile 覆盖，Templates / Can be sponsored 本轮才登记进 pages/profile；
//      哪一条被删，下面的用例立刻红；
//   3. 结果摘要行是**五个节点**（`5` / `results for` / `source` / `repositories sorted by` /
//      `last updated`，加粗的三段各被 <strong> 单独包住，摘要是文本节点逐字采集来的：
//      `"\n        results\n        for\n          "` 这类带换行缩进的原文，经 normalizeKey
//      折叠空白后才等于词典键），故只能靠「片段词条 + 三条规则」拼装，
//      拼接结果必须是通顺的中文整句——这正是拼装断言存在的理由；
//      **未筛选态的节点边界是推断**：dump 只覆盖 `type=source`，但 `last updated` 既然被
//      <strong> 单独包住，未筛选时它同样是独立末节点（相邻空白由 walker 保留），
//      故词典收的是片段 `repositories sorted by` 而不是整句——若实机出现整句形态，
//      这里会表现为那一段保留英文（未命中即保留原文），届时补一条整句键即可。
//   4. 用户内容（仓库名 / 用户名 / 描述）必须保持英文——它们是整节点不收录的（反例断言）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /Oppenheymu?tab=repositories 命中的模块视图（pages/profile + global） */
const view = buildView(
	"/Oppenheymu",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/**
 * Type 下拉的九个选项：实机文本 → 实机中文渲染（逐字录入，顺序即菜单顺序）。
 * 「实机文本」栏就是词典键，必须与 GitHub 渲染的整节点原文一致。
 */
const TYPE_MENU: readonly (readonly [string, string])[] = [
	["All", "全部"], // global
	["Public", "公开"], // global
	["Private", "私有"], // global
	["Sources", "来源"], // pages/profile
	["Forks", "复刻"], // global
	["Archived", "已归档"], // global
	["Can be sponsored", "可被赞助"], // pages/profile（本轮新增）
	["Mirrors", "镜像"], // pages/profile
	["Templates", "模板"], // pages/profile（本轮新增）
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白（见 walker.ts 的 applyTextNode），
 * 最后补上浏览器折叠空白的规则——这样得到的才是页面上真正看到的那一行。
 * （这里的节点是逐字抄来的带缩进原文，故必须折叠；其余页的同类助手通常直接拼。）
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
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}

describe("pages/profile 的仓库列表筛选菜单", () => {
	it("translates every Type menu option to its rendered Chinese label", () => {
		for (const [node, expected] of TYPE_MENU) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("pins the two labels whose upstream l10n is missing", () => {
		// 「Can be sponsored」与「Templates」是本轮新登记的两条：上游自己的中文界面没翻这两项，
		// 只能靠本扩展补。断言用合并后的页面视图（pages/profile + global），故这里锁的是
		// 「命中且译文正确」；它们归哪个模块由 tooling/checks/view.ts 的赢家覆盖快照锁。
		expect(translateText("Can be sponsored", view)).toBe(
			"可被赞助",
		);
		expect(translateText("Templates", view)).toBe("模板");
	});

	it("keeps repository names, owners and descriptions in english", () => {
		// 反例：用户内容与纯专名整节点不收录（未命中即保留英文，这是正确行为）。
		// 「Github-i18n」「Oppenheymu」「MyLiteraryWorks」「TypeScript」「MIT License」
		// 都是实机出现在本页的用户内容 / 许可证专名。
		for (const node of [
			"Github-i18n",
			"Oppenheymu",
			"MyLiteraryWorks",
			"hex-iron",
			"MyLab",
			"A browser extension that provides multilingual translation of the GitHub interface, primarily in Chinese.",
			"TypeScript",
			"MIT License",
			"The Unlicense",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});

/**
 * 维护者 2026-10-02 提供的**原版 HTML**（关掉扩展后从 `?tab=repositories&type=source`
 * 复制的 outerHTML，逐字录入）。这是本页最权威的节点边界证据：加粗的三段
 * （`5` / `source` / `last updated`）各自是一个 `<strong>`，而两句半截文案
 * （`results for` / `repositories sorted by`）是容器直属的文本节点。
 * **不要**把它改写成「看起来更整齐」的一行——换行与缩进就是节点原文的一部分。
 */
const SUMMARY_HTML = `<div class="user-repo-search-results-summary TableObject-item TableObject-item--primary v-align-top">
        <strong>5</strong>
        results
        for
          <strong>source</strong>
        repositories
        sorted by <strong>last updated</strong>
      </div>`;

/** 从实机 HTML 里抽出全部非空文本节点（`<strong>` 内外的文本各算一个节点） */
function summaryNodes(html: string): string[] {
	return [...html.matchAll(/>([^<]*)</g)]
		.map((match) => match[1] ?? "")
		.filter((text) => text.trim() !== "");
}

/**
 * 结果摘要行的实机文本节点（逐字抄自 2026-09 Console dump，含真实换行缩进）
 * 与各自应得的译文：未命中的节点会拿到 null，故 null 即红。
 * 加粗的三段（`5` / `source` / `last updated`）在 dump 里各自是一个文本节点，
 * 说明 `<strong>` 确实把这一行切成了五个节点——整句键在实机上永不命中。
 *
 * 2026-10-02 维护者贴出的**实机渲染**（截图 + innerHTML）是
 * 「5 个结果，source 个仓库，按 上次更新。」——「个仓库」是凭空多出来的量词
 * （`5` 数的是结果，不是仓库），「按」还脱在它连接的那一段之外。
 * 根因是每个节点单独翻译、译文按原文顺序落地，所以片段的边界必须按**中文语序**画：
 *   1. 量词只跟着它修饰的数字：数字 `5` 是前一个节点（纯符号、不进词典），
 *      故「个」属于数字之后紧邻的那条译文（`results for` → 「个结果，」），
 *      而 `repositories sorted by` 不得带量词（→ 「仓库，」）；
 *   2. 连接词必须落在它所连接的那一段之后：`sorted by` 在中文里是「按…排序」，
 *      末段之后就是容器末尾，故整段归 `last updated`（→ 「按上次更新排序」）。
 * 下面两条断言就是这条不变量（数字、量词、连接词各就各位）的回归网：
 * 逐片段断言锁每一段的形状，整句拼装断言锁拼接结果。
 *
 * **2026-10-02 实机复核通过**：维护者重载扩展后贴回的 Console dump
 * （`[...d.childNodes]` 逐条打印）与下方断言完全一致——
 * `"个结果，"` / `"仓库，"` / `"按上次更新排序"` 三段各自落在原文节点里。
 * 同一次复核里维护者又拍板把筛选值 `source` 也译出（→「来源」），
 * 故整行现在渲染为「5 个结果， 来源 仓库， 按上次更新排序」。
 */
const SUMMARY_NODES: readonly (readonly [
	string,
	string | null,
])[] = [
	[
		"\n        results\n        for\n          ",
		"个结果，",
	],
	["\n        repositories\n        sorted by ", "仓库，"],
	["last updated", "按上次更新排序"],
	// Type 筛选值：实机是单数小写、被 <strong> 单独包住的一条节点，与菜单项
	// `Sources` 同义但另成一键；维护者 2026-10-02 拍板译出（代价见下方用例）
	["source", "来源"],
	["\n          Clear filter\n", "清除筛选"],
	// 纯数字节点翻不了，也不该收（收了就是永不命中的死键）；
	// 它的量词由紧邻的下一条片段承载（见上面的说明）
	["5", null],
];

describe("pages/profile 的仓库列表结果摘要", () => {
	it("translates every fragment the dump shows, including its real whitespace", () => {
		for (const [node, expected] of SUMMARY_NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("keeps the count next to the results it counts", () => {
		// 计数与半句同处一个节点时（`<strong>` 边界改版的形态）由规则一起译出
		expect(translateText("5 results for", view)).toBe(
			"5 个结果，",
		);
		expect(translateText("1,234 results for", view)).toBe(
			"1,234 个结果，",
		);
		// 计数被 <strong> 拆成独立节点时，剩下这半句自己带量词——
		// 它在数字节点**之后**，拼接顺序天然就是「5 个结果，」
		expect(translateText("results for", view)).toBe(
			"个结果，",
		);
	});

	it("never puts a quantifier on a noun whose count is not on the page", () => {
		// 实机错乱的根源：`repositories` 凭空带上「个」——页面上并没有「几个仓库」这个数。
		// 谁把量词加回这条片段，这条用例立刻红。
		for (const node of [
			"repositories sorted by",
			"repository sorted by",
		]) {
			const translated = translateText(node, view) ?? "";
			expect(translated, node).toBe("仓库，");
			expect(translated.includes("个"), node).toBe(false);
		}
	});

	it("assembles the live node sequence into a grammatical sentence", () => {
		// 节点直接从**原版 HTML** 抽出来，避免 HTML 与节点清单两处常量各写一份而漂移；
		// 断言的是实机渲染出来的那一行（walker 保留节点首尾空白 + 浏览器折叠空白）。
		const nodes = summaryNodes(SUMMARY_HTML);
		expect(renderNodes(nodes)).toBe(
			"5 个结果， 来源 仓库， 按上次更新排序",
		);
		// 未筛选时只是少了类型名那个节点，其余片段完全一样——这正是
		// 「不把整句 `repositories sorted by last updated` 收成一条键」的理由
		// （末段被 <strong> 单独包住，整句键会永不命中，见 core/canonical.jsonc 注释）。
		// 注：未筛选态的节点边界是**推断**，原版 HTML 只覆盖了 `type=source`。
		const unfiltered = nodes.filter(
			(node) => node !== "source",
		);
		expect(renderNodes(unfiltered)).toBe(
			"5 个结果， 仓库， 按上次更新排序",
		);
	});

	it("knowingly translates a user repository that is literally named source", () => {
		// 有意接受的代价：词典按**整节点精确匹配**，拿不到「这是筛选值还是仓库名」的上下文，
		// 所以个人主页上恰好叫 `source`（全小写；大小写敏感）的仓库 / Gist 名也会变成「来源」。
		// 维护者 2026-10-02 明确选择译出；这条用例把代价写在案，
		// 日后有人报「我的仓库名被翻了」时，先看这里再决定是否回退（回退 = 删掉该词条）。
		expect(translateText("source", view)).toBe("来源");
		// 反例：大小写不同的仓库名不受影响（`Source` 是另一条键，pages/profile 里没有）
		expect(translateText("Source", view)).toBeNull();
	});

	it("fails loudly when the authoritative HTML's node boundaries change", () => {
		// 这五个节点就是片段词条的全部依据：谁改了 HTML 常量、或 GitHub 改版后边界变了，
		// 都必须回来重新核对片段该怎么切，而不是让断言悄悄跟着漂。
		expect(summaryNodes(SUMMARY_HTML)).toEqual([
			"5",
			"\n        results\n        for\n          ",
			"source",
			"\n        repositories\n        sorted by ",
			"last updated",
		]);
	});

	it("keeps the capitalised Type-menu option apart from the summary fragments", () => {
		// 菜单项是 "Last updated"（大写 L，下拉里渲染为「最近更新」），摘要里的片段是
		// "last updated"（小写，渲染为「按上次更新排序」）——两者是两条不同的键，
		// 大小写混用会被这条用例挡住。
		expect(translateText("Last updated", view)).toBe(
			"最近更新",
		);
		expect(translateText("last updated", view)).toBe(
			"按上次更新排序",
		);
	});
});

/**
 * 维护者 2026-10-02 提供的实机 HTML 片段（`/Oppenheymu`，未加载扩展的原始英文页）。
 *
 * 三处漏翻的**节点边界**（这是本组用例存在的理由）：
 *   1. `<a href="…?tab=repositories&sort=stargazers&type=source">Top repositories</a>`
 *      —— 链接文本是**完整一个节点**，故整串即键（不是片段）；
 *   2. `<span class="f4 lh-condensed m-0 color-fg-muted">1 contribution in private
 *      repositories</span>` —— 整句由 profile/contributions-private 规则接手；
 *      **半句不能收静态词条**，否则计数被拆成独立节点时，它会先于规则命中剩下的
 *      「…contribution in private repositories」整段文本，把渲染结果压成「次贡献，来自私有仓库」；
 *   3. `<span class="State--open State …">open</span>` —— 状态胶囊里的状态标签是
 *      **小写**，global 里的大写 `Open` / `Closed` / `Merged` 命中不了。
 */
describe("pages/profile 的个人主页侧栏与状态胶囊", () => {
	it("translates the sidebar Top repositories link", () => {
		// 键与 pages/dashboard 同名同译；个人主页只命中 pages/profile，故这一页必须自己登记
		expect(translateText("Top repositories", view)).toBe(
			"热门仓库",
		);
	});

	it("translates the lowercase state pills in bare and whitespace-wrapped form", () => {
		// 计数胶囊：<span class="State--open State …">\n  2\n</span> 内只剩状态词本身
		for (const [node, expected] of [
			["open", "打开"],
			["closed", "已关闭"],
			["merged", "已合并"],
		] as const) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});
});

describe("pages/profile 的私有贡献摘要", () => {
	it("translates the single-node form through the rule", () => {
		// 实机 HTML 是 `<span class="f4 …">1 contribution in private repositories</span>`：
		// 整句由 profile/contributions-private 规则接手（单复数折叠）。带缩进换行的原文
		// 先被 normalizeKey 折叠，故同样命中——注意 translateText 返回的是**纯译文**，
		// 首尾空白由 walker 的 applyTextNode 负责拼接（这里不重复断言那段空白）。
		expect(
			translateText(
				"1 contribution in private repositories",
				view,
			),
		).toBe("1 次贡献，来自私有仓库");
		expect(
			translateText(
				"26 contributions in private repositories",
				view,
			),
		).toBe("26 次贡献，来自私有仓库");
		expect(
			translateText(
				"\n            1 contribution in private repositories\n          ",
				view,
			),
		).toBe("1 次贡献，来自私有仓库");
	});

	it("renders the count node and refuses a half-sentence entry that would shadow the rule", () => {
		// 计数若被自己的 span 拆成独立节点，计数节点由 global/contributions-count 接手；
		// 剩下的半句节点**有意保持英文**——把它收成静态词条，它就会先于规则命中
		// 整段文本（引擎查表顺序是静态词典 → 规则），实机渲染成「次贡献，来自私有仓库」。
		// 这条用例就是那道结构约束的回归保护：谁把半句加回词典，这里立刻红。
		expect(translateText("1 contribution", view)).toBe(
			"1 次贡献",
		);
		expect(
			translateText(
				"contribution in private repositories",
				view,
			),
		).toBeNull();
	});

	it("keeps the username in the linked sidebar heading", () => {
		// 反例：侧栏标题里不一定只有固定文案（组织主页有「<组织名> repositories」），
		// 用户名 / 组织名是用户内容，整节点不收录。
		expect(translateText("Oppenheymu", view)).toBeNull();
	});
});

/**
 * 行尾的拉取请求计数（2026-10-18 维护者两次贴出的实机 DOM，第二次补了页面地址
 * `https://github.com/Oppenheymu`）。
 *
 * 实机片段逐字如下——`span` 里只有 `2 pull requests` 一个文本节点，两侧是源码的
 * 换行缩进（`normalizeKey` 折叠空白后才等于规则的输入）：
 *
 *     <span class="col-3 flex-shrink-0 f6 color-fg-muted width-auto text-right">
 *               2 pull requests
 *             </span>
 *
 * 数字是动态的 ⇒ 只能走规则 `global/pull-requests-count`
 * （`^([\d,]+) pull requests?$`，单复数折叠、带千分位）。本页命中 pages/profile + global，
 * 规则由 global 提供——**前两版把同一 pattern 挂在 pages/commits / pages/repo 上都没生效**，
 * 就是因为页面其实是这个（个人主页）：那段 DOM 只给了行结构、没给页面地址，
 * 按「仓库页的行」去猜就把整条修复挂错了模块。本组用例就是那两次误判的回归保护。
 */
describe("pages/profile 行尾的拉取请求计数", () => {
	it("translates the reported node, indentation included", () => {
		expect(
			translateText(
				"\n          2 pull requests\n        ",
				view,
			),
		).toBe("2 个拉取请求");
		expect(translateText("1 pull request", view)).toBe(
			"1 个拉取请求",
		);
	});

	it("leaves the bare phrase and longer sentences alone", () => {
		// 裸短语若被收成词条，数字节点会单独留下、整行渲染成「个拉取请求」；
		// 规则两端锚定，带尾巴的句子不归它管（不产出中英残句）
		expect(translateText("pull requests", view)).toBeNull();
		expect(
			translateText("2 pull requests were merged", view),
		).toBeNull();
	});

	it("has a japanese template", () => {
		const japanese = buildView(
			"/Oppenheymu",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("2 pull requests", japanese)).toBe(
			"2 件のプルリクエスト",
		);
	});
});

/**
 * 个人主页左侧栏的**内联「编辑资料」表单**（仅本人访问自己的主页时渲染）。
 *
 * 事故背景（2026-10-06 维护者报「补了没生效」）：这一批文案此前只登记在
 * pages/settings（/settings/profile），而个人主页 `/Oppenheymu` 命中 pages/profile，
 * 一个键都取不到——实机渲染出来只有 global 的 `Company` / `Save` / `Cancel` /
 * `Loading` 四条是中文，其余整片保留英文。现已两边各登记一份（路由互斥）。
 *
 * 节点边界与 /settings/profile 完全同构：`You can <strong>@mention</strong> …` 被
 * `<strong>` 切成三段；字段名同时以 label 文本与 placeholder / aria-label 出现；
 * 时区是 `<option>` 的可见文本（`value` 是标识符，引擎只翻按钮类 `<input>` 的 value）。
 */
const PROFILE_FORM_NODES: readonly string[] = [
	"Name",
	"Bio",
	"Add a bio",
	"You can",
	"other users and organizations to link to them.",
	"Pronouns",
	"Don't specify",
	"Custom",
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
	// 下面四条住在 global：事故当天它们是页面上**仅有**的中文，
	// 一并锁进本视图，防止有人误以为「global 兜底就够了」而删掉上面那批。
	"Company",
	"Save",
	"Cancel",
	"Loading",
];

/** 个人主页表单里必须保持英文的实机节点：用户内容、代词档位与 option 标识符 */
const PROFILE_FORM_MUST_STAY_ENGLISH: readonly string[] = [
	"M. Oppenheymu",
	"Oppenheymu@pm.me",
	"oppenheymu@gmail.com",
	"https://x.com/Oppenheymu",
	"@mention",
	"they/them",
	"she/her",
	"he/him",
	// `<option value="Beijing">` 这类标识符是表单提交值，引擎只翻按钮类 input 的 value
	"Beijing",
	"Hong Kong",
	"UTC",
];

describe("pages/profile 的个人主页侧栏编辑资料表单", () => {
	it("translates every label, placeholder, aria-label and option text", () => {
		for (const node of PROFILE_FORM_NODES) {
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

	it("covers the whole time zone list on this page too", () => {
		// 152 = 实机 HTML 里 `<option>` 的总数。数字写死：谁把个人主页这份时区词条删掉，
		// 数量断言立刻红（时区是本页最容易被漏掉的一大块）。
		const tzKeys = [...view.entries.keys()].filter((k) =>
			k.startsWith("(GMT"),
		);
		expect(tzKeys.length).toBe(152);
		for (const key of tzKeys) {
			const translated = translateText(key, view);
			expect(translated, `未命中：${key}`).not.toBeNull();
			const offset = key.slice(0, key.indexOf(") ") + 2);
			expect(
				(translated ?? "").startsWith(offset),
				`GMT 前缀被改动：${translated ?? ""}`,
			).toBe(true);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
		// 代表性条目：本机时区（香港）与相邻的北京各一条
		expect(
			translateText("(GMT+08:00) Hong Kong", view),
		).toBe("(GMT+08:00) 香港");
		expect(translateText("(GMT+08:00) Beijing", view)).toBe(
			"(GMT+08:00) 北京",
		);
	});

	it("keeps user content, pronouns and option identifiers as-is", () => {
		for (const raw of PROFILE_FORM_MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the @mention hint across its three nodes", () => {
		// 实机：`You can <strong>@mention</strong> other users and organizations to link to them.`
		expect(
			renderNodes([
				"You can ",
				"@mention",
				" other users and organizations to link to them.",
			]),
		).toBe("你可以 @mention 其他用户和组织来链接他们。");
	});
});

describe("pages/profile 的贡献日历月份标签", () => {
	it("keeps the two-column October label on one line", () => {
		// 用户提供的 /Oppenheymu 实机 DOM 显示最后一个 October 标签 colspan=2；
		// 去掉空格仍允许浏览器在数字与汉字间折行，故用零宽 WORD JOINER 禁止断行。
		expect(translateText("Oct", view)).toBe("10\u2060月");
		// 贡献动态中的全称月份仍保留常规排版。
		expect(translateText("October", view)).toBe("10 月");
	});
});

describe("pages/profile 的四维活动图轴标签", () => {
	it("translates the SVG axis labels", () => {
		// 2026-10-24 维护者实机：个人主页四维活动图（activity overview）的轴标签是
		// SVG <text> 节点（class activity-overview-label），引擎的 TreeWalker 照常
		// 遍历到（filters 的排除清单不含 SVG）。另两轴 Pull requests / Issues 由
		// global 同名键覆盖，不重复登记；上面那批「N pull requests」数字形态早已
		// 收录，轴标签本体反而漏了。
		expect(translateText("Code review", view)).toBe(
			"代码审查",
		);
		expect(translateText("Commits", view)).toBe("提交");
	});
});

/**
 * 组织主页（/Koishi-CE，与个人主页共用 pages/profile；维护者 2026-10-25 的
 * popup 漏翻导出，schema github-zh-misses/3）。
 *
 * 导航 tabs 与 sr-only 碎片大半在别的模块已有同键（Teams/Insights→repo-settings、
 * Organization navigation→org-settings、Invite→settings-billing、Manage→
 * settings-security、items→actions、Something went wrong.→repo-settings），
 * /<org> 路由吃不到 → 本模块登记同译；SAML 促销条、邀请弹层、置顶编辑弹层与
 * 讨论区空状态为全新键。
 *
 * 两条拆节点拼接：SAML 说明句「Authenticate members with」+链接「SAML single
 * sign-on」；企业任务入口「Get started with tasks」+「that most successful
 * organizations complete.」（aria-label 是 your 版整句，另一串键）。
 */
describe("组织主页的实机节点边界", () => {
	const orgView = buildView(
		"/Koishi-CE",
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);

	it("translates the nav tabs, dialogs and flash texts", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Organization navigation", "组织导航"],
			["Teams", "团队"],
			["Insights", "洞察"],
			["View as:", "查看方式："],
			[
				"You are viewing the README and pinned repositories as a public user.",
				"你正在以公共用户身份查看 README 与置顶仓库。",
			],
			["Invite", "邀请"],
			["Invite Member", "邀请成员"],
			["Invite a billing manager", "邀请账单管理员"],
			["Invite someone", "邀请他人"],
			[
				"Search by username, full name or email address",
				"按用户名、全名或电子邮箱地址搜索",
			],
			[
				"Try it in a 30-day trial of GitHub Enterprise.",
				"在 GitHub Enterprise 30 天试用版中体验。",
			],
			["Start free for 30 days", "免费试用 30 天"],
			["Dismiss", "关闭"],
			["dismiss this message", "关闭此消息"],
			["Retry.", "重试。"],
			["Something went wrong.", "出了点问题。"],
			["Customize pins", "自定义置顶"],
			["Edit pinned repositories", "编辑置顶仓库"],
			["Save pins", "保存置顶"],
			["Drag to reorder", "拖动以排序"],
			[
				"Edit this organization's profile readme file",
				"编辑此组织的个人资料 README 文件",
			],
			["Change your organization’s avatar", "更改组织头像"],
			["Turn on discussions", "开启讨论区"],
			[
				"Set up discussions to engage with your community!",
				"设置讨论区，与你的社区互动！",
			],
			["Manage", "管理"],
			["items", "项"],
		];
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, orgView),
				`未命中：${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("assembles the two split sentences node by node", () => {
		// SAML 说明句与任务入口说明句都是「碎片 + 链接/尾句」的两节点形态
		expect(
			translateText("Authenticate members with", orgView),
		).toBe("对成员进行身份验证：");
		expect(
			translateText("SAML single sign-on", orgView),
		).toBe("SAML 单点登录");
		expect(
			translateText(
				"Authenticate your members with SAML single sign-on",
				orgView,
			),
		).toBe("使用 SAML 单点登录对成员进行身份验证");
		expect(
			translateText("Get started with tasks", orgView),
		).toBe("上手这些任务");
		expect(
			translateText(
				"that most successful organizations complete.",
				orgView,
			),
		).toBe("，最成功的组织都会完成。");
	});

	it("translates the dynamic pinned-handle and follow labels through rules", () => {
		// 上下移按钮 aria-label 带仓库名；关注按钮 title/aria-label 带组织名
		expect(translateText("Move koishi up", orgView)).toBe(
			"上移 koishi",
		);
		expect(
			translateText("Move services down", orgView),
		).toBe("下移 services");
		expect(translateText("Follow Koishi-CE", orgView)).toBe(
			"关注 Koishi-CE",
		);
		expect(
			translateText("Unfollow Koishi-CE", orgView),
		).toBe("取消关注 Koishi-CE");
	});

	it("keeps user content and brand names in english", () => {
		// 仓库名 / topic 标签 / 语言 / 许可证 / 邮箱是用户内容或专名；
		// 「Type」同形异义（页头读「键入」、正文读「类型」）维持不收录的既有决策
		for (const raw of [
			"Koishi-CE",
			"koishi",
			"TypeScript",
			"MIT",
			"Koishi-CE@pm.me",
			"Type",
		]) {
			expect(
				translateText(raw, orgView),
				`不应被翻译：${raw}`,
			).toBeNull();
		}
	});

	it("has japanese templates for the new fragments", () => {
		const japanese = buildView(
			"/Koishi-CE",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Invite Member", japanese)).toBe(
			"メンバーを招待",
		);
		expect(
			translateText("Authenticate members with", japanese),
		).toBe("メンバーの認証方法：");
		expect(translateText("Move koishi up", japanese)).toBe(
			"koishi を上へ移動",
		);
		expect(
			translateText("Follow Koishi-CE", japanese),
		).toBe("Koishi-CE をフォロー");
	});
});
