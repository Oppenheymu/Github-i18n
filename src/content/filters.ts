// 翻译排除判定：保护代码与用户内容绝不被替换（硬性约束 6：排除清单优先）

/**
 * 容器级排除选择器：元素自身或其祖先命中即跳过整个子树。
 * 新页面误伤代码块时，先往这里加选择器，再考虑词典侧回避；
 * 严禁为覆盖 UI 词条而放宽本清单。
 */
export const EXCLUDE_SELECTOR = [
	// 原生代码与输入容器
	"code",
	"pre",
	"kbd",
	"samp",
	"textarea",
	// 脚本与模板（不可见，但会被遍历到）
	"script",
	"style",
	"noscript",
	"template",
	// GitHub 的代码高亮 / diff / 编辑器容器
	".highlight",
	".blob-code",
	".diff-table",
	".js-file-line",
	".react-code-lines",
	".CodeMirror",
	".cm-editor",
	// 用户创作内容（README、issue 正文、评论等均挂 markdown-body）
	".markdown-body",
].join(",");

/**
 * 表单控件选择器：这些标签进 EXCLUDE_SELECTOR 的理由是**它们的内容是用户输入**
 * （`<textarea>` 的文本、`<input>` 的 value），而它们的 `placeholder` /
 * `aria-label` / `title` 恰恰是上游 UI 文案——排除整棵子树会把两者一起埋掉。
 *
 * 实机案例（2026-10-02）：首页 Copilot 对话输入框是
 * `<textarea id="copilot-chat-textarea" aria-label="Ask anything or type @ to add context with Copilot"
 * placeholder="Ask anything or type @ to add context">`，两条文案都在属性上，
 * 排除清单生效时它们结构上永远翻不了。故 walker 对**命中本选择器的排除元素**
 * 仍翻译其属性（内容照旧整棵跳过）。不得把本选择器当成放宽排除的口子：
 * 只允许列「属性是 UI 文案、内容是用户输入」的表单控件。
 */
export const FORM_CONTROL_SELECTOR = [
	"textarea",
	"input",
	"select",
].join(",");

/**
 * 是否含**非拉丁字母**（语言无关的「已翻译 / 非英文」判定）。
 *
 * 刻意用 Unicode 脚本属性而不是硬编码汉字区间：日语译文可能全是假名
 * （「もっと見る」）、韩语用谚文、还有西里尔 / 希腊 / 阿拉伯等，汉字判定对它们
 * 全部失效，会让译文被当成英文原文再翻一遍。这里只要求「存在一个不属于拉丁
 * 字系的字母」——标点、数字、符号（`©`、`…`、`——`）不算字母，带变音符的拉丁
 * 字母（`café`）仍属拉丁字系，故英文 UI 文本不会被误判为已翻译。
 *
 * 拉丁语系目标语言无法靠本判定区分（与源语言同字系），其防循环依赖
 * 「译文不得等于任何键」的结构门禁，见 tooling/checks/dict.ts。
 */
const NON_LATIN_LETTER =
	/(?:(?!\p{Script=Latin})\p{Letter})/u;

/** 是否含拉丁字母（与 hasNonLatinLetter 对称，用于判定「半中半英」的混合节点） */
const LATIN_LETTER = /\p{Script=Latin}/u;

export function hasNonLatinLetter(text: string): boolean {
	return NON_LATIN_LETTER.test(text);
}

/**
 * 是否**已含非拉丁字母、且不含任何拉丁字母**——即整段都已是目标语言（或其它非英文）。
 *
 * 与 hasNonLatinLetter 的区别在一个真实案例上：GitHub 中文界面的
 * 「Optimized for: 均衡」是**半中半英**节点——前缀是上游漏翻的英文，档位名由 GitHub
 * 自己译成了中文。判定为「已译文、整段跳过」时，规则**结构上永远看不到**这类节点，
 * 于是前缀永远翻不掉（2026-10-02 维护者截图的正是这一处）。
 * 本判定把「含拉丁字母」的混合节点放行给规则，纯中文 / 纯假名的节点仍被拦住。
 */
function isEntirelyNonLatin(text: string): boolean {
	return (
		hasNonLatinLetter(text) && !LATIN_LETTER.test(text)
	);
}

/** 单段文本长度上限：超过视为代码或用户内容，直接放弃 */
const MAX_TEXT_LENGTH = 500;

/**
 * 文本节点 / 属性值翻译前的可翻译判定：
 * 空白、超长、全段非拉丁（已是译文或非英文用户内容）一律跳过。
 * 先测最便宜的「含拉丁字母」再测字系，热路径上更省。
 *
 * 注意「含拉丁字母」同时也是**半中半英节点**的放行条件：`Optimized for: 均衡`
 * 这类上游只译了一半的文案必须留给规则处理前缀（见 isEntirelyNonLatin 的说明）。
 * 放行的代价是这类节点每轮都会被再查一次表——查不中即返回 null，不写回 DOM，
 * 不构成翻译循环（循环的两道结构防线仍由「译文不得等于键」与「同值不写入」把守）。
 */
export function isTranslatableText(text: string): boolean {
	const trimmed = text.trim();
	if (trimmed.length === 0) return false;
	if (trimmed.length > MAX_TEXT_LENGTH) return false;
	if (!/[a-z]/i.test(trimmed)) return false;
	if (isEntirelyNonLatin(trimmed)) return false;
	return true;
}
