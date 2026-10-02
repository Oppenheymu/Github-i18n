// 一段可粘贴到 Console 的采集脚本：定位「某个文本节点为什么没被翻译」。
// 用法：在未加载本扩展的英文页面里照常看到英文时，把本段整段粘进 Console 回车。
// 它不依赖扩展的任何内部状态，只报告 DOM 事实（节点原文 / 祖先链 / 排除命中 / 影子边界）。
(() => {
	const QUERY = "relative-time, [part='root']";
	const out = [];
	for (const el of document.querySelectorAll(QUERY)) {
		const walker = document.createTreeWalker(
			el,
			NodeFilter.SHOW_TEXT,
		);
		let text = null;
		for (
			let n = walker.nextNode();
			n;
			n = walker.nextNode()
		) {
			if (n.nodeValue?.trim()) {
				text = n;
				break;
			}
		}
		const chain = [];
		for (let node = el; node; node = node.parentNode) {
			chain.push(
				node.nodeType === 1
					? `${node.tagName.toLowerCase()}${
							typeof node.className === "string" &&
							node.className
								? `.${node.className.split(/\s+/)[0]}`
								: ""
						}`
					: "#doc",
			);
			if (node === document.body) break;
		}
		out.push({
			text: text
				? JSON.stringify(text.nodeValue)
				: "(no text node)",
			part: el.getAttribute("part"),
			inMainDocument: el.getRootNode() === document,
			excluded: !!el.closest(
				"code,pre,kbd,samp,textarea,script,style,noscript,template,.highlight,.blob-code,.diff-table,.js-file-line,.react-code-lines,.CodeMirror,.cm-editor,.markdown-body",
			),
			chain: chain.join(" < "),
		});
	}
	console.log(
		JSON.stringify(
			{
				url: location.pathname,
				host: location.host,
				count: out.length,
				items: out.slice(0, 20),
			},
			null,
			2,
		),
	);
	return "已复制上面的 JSON（右键 → Copy object）发我即可";
})();
