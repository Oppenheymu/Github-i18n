// walker / engine 的测试共用的最小 DOM 桩。
//
// 为什么必须只有一份：walker.ts 用 `root instanceof Element` 判定根节点类型，而
// `instanceof` 比的是**类身份**。两个测试文件各内联一份 StubElement 并挂到
// globalThis.Element 上时，后装的那份会让先装的那份的节点不再 `instanceof Element`，
// 既有的节点边界测试会成片变红（2026-10-03 实际踩到：engine 的桩顶掉 walker 的桩）。
// bun test 的 globalThis 跨文件共享，所以类必须来自同一个模块。
//
// 同理，这里的安装一律是**合并**而不是整体替换：一个文件需要的命名空间不能把
// 另一个文件刚装好的打掉。
//
// 本文件不是测试文件（文件名不匹配 *.test.ts），bun test 不会执行它。

export class StubText {
	readonly nodeType = 3;
	/** 每次给 nodeValue 赋值都记一笔，用来断言同值写入确实被跳过 */
	readonly writes: string[] = [];
	parentElement: StubElement | null = null;
	isConnected = true;
	#value: string;
	constructor(value: string) {
		this.#value = value;
	}
	get nodeValue(): string {
		return this.#value;
	}
	set nodeValue(next: string) {
		this.#value = next;
		this.writes.push(next);
	}
}

export class StubElement {
	readonly nodeType = 1;
	readonly childNodes: (StubElement | StubText)[] = [];
	readonly tagName: string;
	readonly classes: Set<string> = new Set();
	readonly attrs = new Map<string, string>();
	parentElement: StubElement | null = null;
	isConnected = true;
	constructor(tag: string) {
		this.tagName = tag.toUpperCase();
	}
	append(node: StubElement | StubText): void {
		Object.defineProperty(node, "parentElement", {
			value: this,
			configurable: true,
		});
		this.childNodes.push(node);
	}
	addText(value: string): StubText {
		const text = new StubText(value);
		this.append(text);
		return text;
	}
	getAttribute(name: string): string | null {
		return this.attrs.get(name) ?? null;
	}
	setAttribute(name: string, value: string): void {
		this.attrs.set(name, value);
	}
	/** 只处理 EXCLUDE_SELECTOR / FORM_CONTROL_SELECTOR 用到的两种形态 */
	closest(selector: string): StubElement | null {
		const parts = selector
			.split(",")
			.map((part) => part.trim());
		const matches = (element: StubElement): boolean =>
			parts.some((part) =>
				part.startsWith(".")
					? element.classes.has(part.slice(1))
					: element.tagName === part.toUpperCase(),
			);
		let current: StubElement | null = this;
		while (current !== null) {
			if (matches(current)) return current;
			current = current.parentElement;
		}
		return null;
	}
}

/** 与浏览器语义一致的部分：被拒绝的节点不入队，元素的子节点继续下探 */
export class StubTreeWalker {
	readonly #queue: (StubElement | StubText)[] = [];
	readonly #filter: { acceptNode(node: unknown): number };
	constructor(
		root: StubElement | StubText,
		_what: unknown,
		filter: { acceptNode(node: unknown): number },
	) {
		this.#filter = filter;
		this.#queue.push(root);
	}
	nextNode(): unknown {
		while (this.#queue.length > 0) {
			const node = this.#queue.shift();
			if (node === undefined) return null;
			if (this.#filter.acceptNode(node) === 2) continue;
			if (node instanceof StubElement) {
				this.#queue.push(...node.childNodes);
			}
			return node;
		}
		return null;
	}
}

/** 合并式安装：只补自己需要的键，保留 globalThis 上已有的 document 等桩 */
export function installDomStubs(): void {
	const globals = globalThis as unknown as Record<
		string,
		unknown
	>;
	globals["Node"] = { TEXT_NODE: 3 };
	globals["Element"] = StubElement;
	globals["NodeFilter"] = {
		SHOW_ELEMENT: 1,
		SHOW_TEXT: 4,
		FILTER_ACCEPT: 1,
		FILTER_REJECT: 2,
		FILTER_SKIP: 3,
	};
	const document = (globals["document"] ?? {}) as Record<
		string,
		unknown
	>;
	document["createTreeWalker"] = (
		root: StubElement | StubText,
		what: unknown,
		filter: { acceptNode(node: unknown): number },
	) => new StubTreeWalker(root, what, filter);
	globals["document"] = document;
}
