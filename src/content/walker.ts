// TreeWalker 翻译核心：文本节点查静态词典与正则规则，元素查属性词条
// DOM 相关部分保持薄层；纯函数 translateText 导出供测试复用

// 归一化函数住在无 DOM 依赖的 shared/text.ts：门禁要用同一份实现，
// 而门禁的工程不含 DOM（不能 import 本文件这条链路）
import { normalizeKey } from "../shared/text.ts";
import type { DictView } from "../shared/types.ts";
import { recordAttr, recordText } from "./collector.ts";
import {
	EXCLUDE_SELECTOR,
	isTranslatableText,
} from "./filters.ts";

/** 需要精确命中词条才替换的元素属性（属性不应用正则规则，防误伤） */
const TRANSLATABLE_ATTRS = [
	"title",
	"aria-label",
	"placeholder",
	"alt",
	// 按钮类 <input> 的可见文案就在 value 上（Rails 表单：
	// `<input type="submit" value="Save Trending settings" data-disable-with="…">`），
	// 不放进来这类按钮结构上永远翻不了。仅限按钮类，见 isButtonInputValue。
	"value",
	// Rails 提交期间把 value 换成 data-disable-with 的内容，同一句文案再来一份
	"data-disable-with",
] as const;

/** 只对按钮类 <input> 翻 value；文本输入框的 value 是用户内容 */
const BUTTON_INPUT_TYPES = new Set([
	"submit",
	"button",
	"reset",
]);

/** 该元素是否是「value 即可见文案」的按钮类 <input> */
function isButtonInputValue(element: Element): boolean {
	if (element.tagName !== "INPUT") return false;
	const type = (
		element.getAttribute("type") ?? "text"
	).toLowerCase();
	return BUTTON_INPUT_TYPES.has(type);
}

/**
 * 查词：先按 DOM 文本直查当前语言词典，未命中再走上游改名映射
 * （DOM 文本 → 规范键 → 译文）。热路径上未命中才多一次 Map 查找。
 */
function lookup(
	view: DictView,
	key: string,
): string | undefined {
	const direct = view.entries.get(key);
	if (direct !== undefined) return direct;
	const canonical = view.aliases.get(key);
	if (canonical === undefined) return undefined;
	return view.entries.get(canonical);
}

/**
 * 对一段文本应用词典视图，返回译文；未命中返回 null。
 * 查询键先 trim 并把连续空白折叠为单空格（GitHub React 页面的文本节点
 * 常带首尾空白与换行缩进，精确匹配必须先归一），顺序：静态词典（含改名映射）
 * → 首条命中的正则规则（pattern 不允许 g 标志，test 无 lastIndex 累积
 * 问题，见 tooling/checks/dict.ts 门禁）。
 */
export function translateText(
	text: string,
	view: DictView,
): string | null {
	if (!isTranslatableText(text)) return null;
	const normalized = normalizeKey(text);
	const mapped = lookup(view, normalized);
	if (mapped !== undefined) return mapped;
	for (const rule of view.rules) {
		if (!rule.pattern.test(normalized)) continue;
		return normalized.replace(
			rule.pattern,
			rule.replacement,
		);
	}
	return null;
}

/**
 * 替换单个文本节点，保留原文首尾空白；返回是否发生了替换。
 *
 * 例外：**整节点被判空时不留空白**。规则模板允许是空串（见 check:dict 的
 * validateTemplate），语义是「这个节点在目标语言里整个消失」——首例是计费周期卡
 * 被上游拆出的 `per ` 节点（`per month` → `per ` + `month`，见 core/rules.jsonc 的
 * settings/per-word）。若此时仍按「保留首尾空白」把 `per ` 的尾随空格拼回去，
 * 就会留下孤零零一个空格（拼接后成「 每月」），故判空即连空白一起清空。
 */
function applyTextNode(
	node: Text,
	view: DictView,
): boolean {
	const value = node.nodeValue ?? "";
	const translated = translateText(value, view);
	if (translated === null) {
		// 未命中词典与规则：开发者模式下记录 trimmed 原文
		// （可翻译判定已滤掉空白 / 非拉丁字母 / 超长，排除容器由调用方整树跳过）
		if (isTranslatableText(value)) recordText(value);
		return false;
	}
	const erased = translated.trim() === "";
	const lead = erased
		? ""
		: value.slice(
				0,
				value.length - value.trimStart().length,
			);
	const trail = erased
		? ""
		: value.slice(value.trimEnd().length);
	const next = `${lead}${translated}${trail}`;
	// 写回同一个字符串也必须跳过：DOM 规范规定即使赋相同的值也会产生
	// characterData 变更记录，观察器会把它再入队，于是「命中 → 写入 →
	// 再命中 → 再写入」在微任务队列里无限自转，页面不报错但会卡死。
	// 这条守卫让「译文与原文同形」在引擎侧不可能自触发。
	if (next === value) return false;
	node.nodeValue = next;
	return true;
}

/** 精确命中词条才替换元素属性值，同样保留首尾空白 */
function applyAttrs(
	element: Element,
	view: DictView,
): void {
	for (const name of TRANSLATABLE_ATTRS) {
		if (
			(name === "value" || name === "data-disable-with") &&
			!isButtonInputValue(element)
		) {
			continue;
		}
		const value = element.getAttribute(name);
		if (value === null) continue;
		if (!isTranslatableText(value)) continue;
		const mapped = lookup(view, normalizeKey(value));
		if (mapped === undefined) {
			// 未命中词条的属性值：开发者模式下记录（属性不应用正则规则，只会因缺词条漏翻）。
			// value / data-disable-with 是按钮文案，归到 aria-label 一类（MissKind 是
			// 开发者日志的维度，不为按钮文案单开一类，避免 storage 结构跟着变）
			recordAttr(
				name === "value" || name === "data-disable-with"
					? "aria-label"
					: name,
				normalizeKey(value),
			);
			continue;
		}
		const lead = value.slice(
			0,
			value.length - value.trimStart().length,
		);
		const trail = value.slice(value.trimEnd().length);
		const next = `${lead}${mapped}${trail}`;
		// 与文本节点同理：写回同值也会触发 attribute 变更记录，跳过以免自我触发
		if (next === value) continue;
		element.setAttribute(name, next);
	}
}

/**
 * 翻译以 root 为根的子树，返回替换次数（供调试与测试断言）。
 * 排除容器内的子树整棵跳过（closest 同时覆盖祖先，越界根也不误入）。
 */
export function translateTree(
	root: Node,
	view: DictView,
): number {
	let count = 0;
	if (root.nodeType === Node.TEXT_NODE) {
		const parent = root.parentElement;
		if (!parent || parent.closest(EXCLUDE_SELECTOR))
			return 0;
		return applyTextNode(root as Text, view) ? 1 : 0;
	}
	if (
		root instanceof Element &&
		root.closest(EXCLUDE_SELECTOR)
	)
		return 0;
	const walker = document.createTreeWalker(
		root,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		{
			acceptNode(node: Node): number {
				if (node.nodeType === Node.TEXT_NODE) {
					const parent = node.parentElement;
					if (!parent || parent.closest(EXCLUDE_SELECTOR)) {
						return NodeFilter.FILTER_SKIP;
					}
					if (applyTextNode(node as Text, view)) count++;
					return NodeFilter.FILTER_SKIP;
				}
				const element = node as Element;
				if (element.closest(EXCLUDE_SELECTOR)) {
					return NodeFilter.FILTER_REJECT;
				}
				applyAttrs(element, view);
				return NodeFilter.FILTER_SKIP;
			},
		},
	);
	// 收集与替换都在 acceptNode 内完成，这里只需驱动遍历
	while (walker.nextNode() !== null);
	return count;
}
