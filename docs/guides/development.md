# 开发指南

本文面向本仓库的维护者与词典贡献者，说明翻译管线的架构、多语言词典的形态与维护规则、以及手工加载调试的完整流程。

## 架构总览

### 目录结构

```
Github-i18n/
├── public/                  # 静态资产，构建时原样拷入 dist/
│   ├── manifest.json        # MV3：content_scripts + action.popup + storage 权限（name 走 __MSG_*__）
│   ├── popup.html           # 开关弹窗（样式内联，文案用 data-i18n 占位）
│   ├── _locales/            # 扩展自身 UI 文案（en / zh_CN / ja）——与「翻译目标语言」无关
│   └── icons/               # 16/32/48/128 JPG（静态资产，改图标直接替换这四个文件）
├── src/
│   ├── content/             # 翻译引擎（浏览器侧）
│   │   ├── index.ts         # 入口：身份标记 + 语言解析 + 观察器启动 + storage 联动
│   │   ├── engine.ts        # mutation 收集 → 微任务合并 → flush 调度
│   │   ├── walker.ts        # TreeWalker 翻译核心（文本 + 属性 + 别名回退）
│   │   ├── filters.ts       # 排除选择器、非拉丁字母 / 空白 / 长度判定
│   │   ├── pages.ts         # 路由匹配 + 词典视图合并（按「路径 + 语言」单槽缓存）
│   │   └── collector.ts     # 开发者模式漏翻收集
│   ├── dict/                # 自建词典
│   │   ├── core/            # 语言无关的数据（运行时）
│   │   │   ├── modules.jsonc   # 模块名 + 路由，顺序即优先级（global 兜底在最后）
│   │   │   ├── rules.jsonc     # 共享规则的 id + pattern，顺序即语义
│   │   │   ├── aliases.jsonc   # 上游改名映射：当前 DOM 文本 → 规范键
│   │   │   └── canonical.jsonc # 键的权威清单（**仅门禁使用，不进 content 包**）
│   │   ├── locales/         # 只有译文（稀疏覆盖）
│   │   │   ├── zh-CN/       # global.jsonc + pages/<页名>.jsonc + rules.jsonc
│   │   │   └── ja/          # 同上，目前只有样例
│   │   ├── locales.ts       # 语言元数据：id / 显示名 / 文字系统声明
│   │   ├── registry.ts      # 数据注册表：core + 各语言 → JSONC 原始数据
│   │   ├── load.ts          # JSONC → 词典类型（严格编译 + 字段白名单 + 交叉引用）
│   │   ├── index.ts         # 运行时汇总：按语言构建词典，单模块失败只跳过 + 打日志
│   │   └── types/           # 类型 / schema 资产（不含运行时代码）
│   │       ├── dict.schema.json # 编辑器侧 JSON Schema（oneOf 覆盖六种数据形状）
│   │       └── jsonc.d.ts       # `.jsonc` ambient 声明（tsc 不认该扩展名）
│   ├── popup/popup.ts       # popup：UI 文案回填 + 开关 / 语言读写 + 漏翻面板
│   ├── shared/              # types.ts（词典类型）、storage.ts（开关与语言存取）、identity.ts
│   └── test-support/dom.ts  # 测试用的真实 DOM 环境（happy-dom，唯一一份，devDependency）
├── tooling/
│   ├── pipeline/build.ts    # Bun.build IIFE ×2 + 重命名 + 拷贝 public/ → dist/
│   ├── pipeline/pack.ts     # dist/ 压 zip（零依赖 store 模式）
│   ├── checks/dict.ts       # 词典门禁（严格编译 + 交叉引用 + 覆盖率）
│   ├── checks/manifest.ts   # manifest 门禁（MV3 字段 / _locales 一致性 / 资产与产物）
│   └── checks/view.ts       # 视图骨架门禁（模块顺序 / 命中序列 / 同键异译赢家 / 规则 id）
├── *.test.ts                # 与源码同目录，bun:test
└── .github/workflows/ci.yml # bun install → bun run check
```

### 翻译管线

content script 以 `run_at: document_start` 注入：

1. **入口**（`src/content/index.ts`）：先在 isolated world 的全局写一个身份标记（`src/shared/identity.ts`），再读 `chrome.storage.local`（`enabled` / `devMode` / `locale`）；开启时把 `MutationObserver` 挂到 `document.documentElement`（`childList` + `subtree` + `characterData` + `attributes`，并用 `attributeFilter: ["value", "data-disable-with"]` 把属性噪音压到最小），天然覆盖 GitHub 的 Turbo SPA 导航，无需单独路由钩子；
2. **目标语言**：`locale` 有值即用它；没设过则取 `chrome.i18n.getUILanguage()` 并按 `src/dict/locales.ts` 的声明解析（`ja-JP` → ja、`zh-Hans-CN` → zh-CN、未支持即回退 zh-CN）。popup 改语言会触发整页刷新重建视图；
3. **调度**（`engine.ts`）：mutation 只收集 `record.target` 入队，微任务合并后统一 flush，避免高频抖动；flush 时跳过已脱离文档的节点；
4. **路由与视图**（`pages.ts`）：flush 前按 `location.pathname` + 目标语言取词典视图（单槽缓存，二者任一变化才重建）。视图 = `core/modules.jsonc` 顺序下所有命中路由的模块合并结果：词条「先到先得」（具体页压过泛化页、页面压过 global 兜底），规则「首条命中生效」；
5. **翻译**（`walker.ts`）：TreeWalker 遍历元素与文本节点——
   - 文本节点：trim 后先查静态词条 Map（O(1)），未命中再查 `core/aliases.jsonc` 的改名映射并按规范键重查一次，仍未命中才按序试正则规则，替换保留原首尾空白；
   - 元素：`title` / `aria-label` / `placeholder` / `alt` / 按钮类 `value` / `data-disable-with` 共 6 项属性（`walker.ts` 的 `TRANSLATABLE_ATTRS`）值精确命中词条（含别名）才替换（属性不应用正则规则）；
   - 已翻译判定是**语言无关**的「含非拉丁字母」（`filters.ts`），自身修改触发的观察器循环会在下一轮立刻收敛；
6. **开关**：popup 写 `chrome.storage.local` → content script 的 `storage.onChanged` 监听触发整页 `location.reload()`（开启重建翻译 / 关闭还原英文，简单可靠）。

### 关键设计决策

- **IIFE 经典脚本**：MV3 的 content_scripts 不支持 module，`tooling/pipeline/build.ts` 用 Bun.build `format: "iife"` 产出；Bun.build 没有 outfile，产物名靠 naming 模板输出后重命名成 manifest 引用的 `content.js` / `popup.js`；
- **排除清单优先**：`src/content/filters.ts` 的 `EXCLUDE_SELECTOR` 命中元素自身或祖先即整树跳过（`code` / `pre` / `textarea` / `.markdown-body` / 代码高亮与 diff 容器等）。误伤修复永远先加排除选择器，**不得为覆盖 UI 词条而放宽排除**；
- **词条合并「先到先得」**：`core/modules.jsonc` 的顺序是优先级，`buildView` 先放具体页词条、后放 global 兜底，因此议题页词条能压过仓库泛化词条、页面词条能压过全站词条。已知有意的跨模块同键异译（如 `Actions` 在仓库页是「操作」、在设置页是「Actions 工作流」；`Pages` 在设置页是「页面」、在 global 是「页码」）正是靠这个顺序生效，**勿当重复键清理**；
- **词典是 JSONC 数据，不是 TS 模块**：编辑器按 `types/dict.schema.json` 直接给红线与补全；脚本 / AI 能安全批量追加词条，不必重写 TS 对象字面量；重复键由 Biome 的 `noDuplicateObjectKeys` 原生覆盖。代价：正则从字面量降级成字符串，反斜杠必须双写，正则语法检查从编译期挪到门禁；
- **词典数据两条消费路径**：`index.ts`（运行时）与 `tooling/checks/dict.ts`（门禁）都从 `registry.ts` 取原始数据、都走 `load.ts` 编译，只有失败策略不同——运行时单模块失败只跳过 + `console.error`，避免整站翻译失效；门禁严格报错并一次列全。**门禁不得 import `index.ts`**，否则坏数据被静默跳过后门禁反而变绿；
- **图标**：`public/icons/` 下的 16/32/48/128 JPG 是**直接提交在仓库里的静态资产**，改图标就替换这四个文件（四个尺寸都要换），没有生成脚本、也没有 `bun run icons`。历史原因：图标曾由 `assets/icon.svg` 经 `tooling/gen-icons.ts` 用系统浏览器无头 CDP 栅格化，新版无头浏览器的 `--screenshot` 不支持透明背景、必须走 `Emulation.setDefaultBackgroundColorOverride`；后来这条链路整体删除，SVG 源文件也不在仓库里了。

## 多语言词典形态

### 两条变更频率完全不同的数据

| | 键（英文原文）与路由 | 译文 |
| --- | --- | --- |
| 因何而变 | 上游改版（GitHub 渐进迁移 React，文案与节点结构都会变） | 译者修订 |
| 谁改 | 维护者，一次性横跨所有语言 | 各语言贡献者，互相独立 |
| 失效方式 | 静默：键失配只导致不翻，不报错 | 通常可见 |

因此数据按「语言无关」与「按语言」物理隔离：

- `core/**`：路由、规则 pattern、改名映射、规范键清单——**每个语言共享一份**；
- `locales/<语言>/**`：只有译文。不同语言的贡献者永远不会改到同一个文件，日语文件出错也不会影响中文构建（按目录分流审阅、可用 CODEOWNERS）。

### 稀疏覆盖

**缺键 = 尚未翻译，不是错误**：引擎未命中即保留英文，所以各语言的键集合不必相同，也不存在「键集合漂移」问题。同理，某语言没翻译的规则不必出现在它的 `rules.jsonc` 里（缺 id 即整条规则不生效，绝不用空串替换）。

覆盖率由 `bun run check:dict` 报告（分母是 `core/canonical.jsonc`）：

```
词典门禁通过：17 模块 / 2086 规范键 / 446 条共享规则 / 2136 条译文
覆盖率：zh-CN 2086/2086（100.0%，全部已译） | ja 50/2086（2.4%，16 个模块待译）
```

上面这段是 2026-09 的实测输出，**数字随词典增长，一律以本机跑出来的为准**（这一节只解释口径，不维护数字）。口径说明：

- 「规范键」是 `core/canonical.jsonc` 里 **模块 × 键** 的**槽位数**——同一段英文原文若在两个模块各登记一次就算两处；**去重后的唯一键更少**（当前 2086 个槽位 / 2019 个唯一键），「N / 2086」这类覆盖率数字用的都是槽位数；
- 「条译文」是各语言实际给出的词条数之和（zh-CN 满覆盖 + ja 样例），不等于规范键数；
- 「条共享规则」是 `core/rules.jsonc` 里 `id` + `pattern` 的条数（语言无关，只有一份），各语言只是给它配模板。

### 规则为什么按 id 拆

`pattern` 与语言无关、只有替换模板与语言有关，而**规则顺序是语义**（首条命中生效）。若把规则整体按语言拆成 N 份，就得保证 N 份顺序永远一致。故：

- `core/rules.jsonc` 定 `id` + `pattern` 与顺序（模块分组顺序必须与 `core/modules.jsonc` 一致，门禁强制）；
- `locales/<语言>/rules.jsonc` 只放 `id → 模板`，顺序无关。

于是「上游改一次文案」的代价是 O(1)：改 `pattern` 不必动任何语言的模板。**代价**：改 `id` 必须同步所有语言的模板（门禁会报「未知规则 id」）。

模板用 `$1` 或 `$<name>` 引用捕获组，门禁对着 `pattern` 校验引用完整性（组数够不够、命名组有没有声明）。**≥2 组必须命名、单组保持 `$1`** 的约定见「加一条动态规则」。

### 规范键是稳定的身份

`core/canonical.jsonc` 里的键就是**译文的身份**：登记时它等于 GitHub 当时渲染的英文原文；之后即使上游改了措辞，也优先保持这个身份不变，让已有译文继续有效。**改名意味着所有语言的词条都要跟着改**，只在语义真的变了时才做。

### aliases：上游改词时的 O(1) 通道

上游把 `Sign in with GitHub` 改成 `Sign in to GitHub` 这类**纯改词**，只需在 `core/aliases.jsonc` 加一行：

```jsonc
// 上游改成 "Sign in to GitHub"，语义未变，沿用旧译文
"Sign in to GitHub": "Sign in with GitHub",
```

键是**当前 DOM 文本**，值是**已存译文的规范键**。引擎先按 DOM 文本直查当前语言词典，未命中才查别名，所以这条映射加完，所有语言的译文都不用动（O(1)）。JSONC 注释就是这条断言的理由，请写上判断依据（何时改的、为什么认定语义未变）。

**现状（2026-09 实读文件）**：`core/aliases.jsonc` 里一条别名都没有，内容就是 `"aliases": {}`——这条通道自建立起从未被使用过，至今真实遇到的「上游改文案」都是靠「新增键 + 旧整句键变死键 + 各语言重译」处理的（改名同时伴随拆节点，别名救不了）。它的价值在未来：上游做**纯改词**时，加一行就能让所有语言的既有译文继续生效。

两个边界：

- **拆节点不能靠别名**。上游把 `Collaborators 3` 拆成 `<span>Collaborators</span><span>3</span>` 时，整句译文无法复用，必须新增 `Collaborators` 碎片词条（配合计数规则），旧整句键从 canonical 删掉；
- **语义变更不能靠别名**。`Watch` → `Subscribe` 若错加别名，会静默沿用错误译文——这正是别名必须人工评审的原因。

别名源文本也参与「译文不得等于任何键」的门禁：它是引擎的另一种输入，译文等于它同样会被二次翻译。

### 门禁能拦住什么

`tooling/checks/dict.ts`（`bun run check:dict`）：

- 结构：字段白名单、`route` 以 `^/` 锚定、正则可编译、规则无 `flags`、`global` 必须最后、规则分组顺序与模块顺序一致；
- 交叉引用：词条的键必须在 `core/canonical.jsonc` 里（**拼错即报**，旧结构下拼错只会静默不翻）、规范清单与模块清单同名同序、规则模板的 id 必须存在、模板引用的捕获组必须存在、别名目标必须是规范键；
- **键形态**（`validateCanonicalKeys`）：键必须等于引擎 `normalizeKey` 后的形态（trim + 连续空白折叠为单空格）。判定直接调用引擎自己那个无 DOM 依赖的 `normalizeKey`（`src/shared/text.ts`，引擎与门禁共用），保证「门禁认的形态」就是「引擎查的形态」——带换行符 / 制表符 / 连续空格的键**在实机上永不命中**，却照样算进覆盖率分母。这条是 2026-09 事故的补丁：`insights` 的过滤说明句就是带着真实换行混进「100% 已译」的，覆盖率因此虚高；
- **同模块 pattern 唯一**（`validateRulePatternUniqueness`）：运行时的规则按模块排列、**同模块内首条命中即返回**，所以同模块里两条 pattern 相同的规则，后者是永不生效的死规则，白占 `core/rules.jsonc` 与各语言模板，还让「规则总数」失真（2026-09 实例：5 月的全称与缩写同形，`settings/usage-range-same-month-may` 与 `settings/usage-range-short-same-month-may` 逐字符相同）。**跨模块重复是合法的**（路由互斥的模块可以各自收同形规则，如 `settings/month-year-*` 与 `insights/month-year-*`），故只查同模块内；
- 译文形态：必须含该语言的文字系统（声明在 `src/dict/locales.ts`），**不得等于任何键**（含别名源文本）——这是与语言无关的防循环结构门禁，也是拉丁语系目标唯一的依靠；
- 防循环：规则的替换产物不得再命中任何规则（实测现有数据命中数为 0）；
- 覆盖率报告。

`tooling/checks/view.ts`（`bun run check:view`）：

- 校验对象是**合并视图的语义骨架**，golden 快照在 `tooling/fixtures/view-skeleton.<语言>.json`；
- 锁住四件事：模块顺序（`core/modules.jsonc` 的顺序即优先级）与 `global` 兜底必须在最后、每条探针路径命中的模块名序列、**赢家覆盖**（同一键被 ≥2 个命中模块提供时最终胜出来源——这是「有意同键异译」的回归保护）、每条路径生效的规则 **id** 序列；
- 另记 `notTranslated`：该路径 `core` 声明了、本语言还没给模板的规则 id。「往 `core/rules.jsonc` 加一条规则、忘了给模板」在视图里完全不可见（缺模板 = 规则不生效），只有它能把这种回归暴露出来；
- **记 id 不记 pattern 源串**：只改 pattern（例如给已有规则加命名组）不会动快照，与「上游改文案」解耦；
- **反查 id 的键必须是「模块名 + pattern」而不是单 pattern**：跨模块的同形 pattern 是合法的（见上面 `validateRulePatternUniqueness`），而 `ruleIdMap` 早期只按 pattern 建键，后声明的那条会静默覆盖前一条——2026-09 实测：给 `pages/profile` 加一条与 `pages/search` 逐字符相同的 `^([\d,]+) results?$` 后，`/search`、`/topics` 的规则序列被记成 `profile/repo-results-count`，同时账单页那 12 条 `settings/month-year-*` 被记成 `insights/month-year-*`（`insights` 的模板先被读到），`check:view` 报「规则序列变了」而运行时行为毫无变化。这类假报警只能靠复合键消除，回归用例见 `tooling/checks/__tests__/view.test.ts` 的「keeps same-pattern rules of different modules apart」；
- 快照按语言逐份：同键异译是分语言的事实（某语言少译了被压过的那个键，跨模块同键就不成立）；
- 失败时只报首处差异 + 差异条数（一条路径的规则序列可达上百项，整表打印会淹掉真正的信息）；
- 改动确实有意时用 `bun run check:view --update` 重生成快照，并在提交信息里说明原因；
- 探针清单（`PROBE_PATHS`）是快照的坐标：**同一模块下的另一页也要单独列一条**（如 `/account/billing` 与 `/account/billing/ai_usage`），否则只在该页生效的规则进了 core 也没人发现；
- **上游改路径时「新路径为主 + 旧路径兼容」，并为兼容分支留一条锚点探针**：个人账单 2026-09 从 `/settings/billing/**` 迁到 `/account/billing/**`（旧路径实测 404，仅 `/settings/billing/licensing` 尚存），两个模块的路由因此写成 `^/(?:settings|account)/billing`（`pages/settings-billing`）与 `^/(?:settings|account/billing)`（`pages/settings`，账单页沿用同一套设置侧栏，侧栏词条在它里面）。`PROBE_PATHS` 里除新路径的四条页面探针外，还留一条旧路径探针 `/settings/billing`：它对不上任何现存页面，作用是锁住兼容分支**没被谁顺手删掉**；
- **`--update` 写出的文件必须同时满足 `biome check`**：`serializeSkeleton` 按 Biome 的规则自己排版（tab 缩进、超过 `lineWidth` 就竖排、内联对象带空格、tab 按 `indentWidth` 折算列数）。历史上它用 `JSON.stringify(…, null, 2)`，产物必然被 `biome check` 报格式错误，于是「重生成快照」这条流程只能靠手工补一次 `biome format --write`；改这里的排版逻辑时，验收标准是 `bun run check:view --update` 之后 `biome check tooling/fixtures/` 零改动。**数组非末位元素的行宽还要含尾随逗号**：`{ "key": …, "module": … }` 内联正好 60 列时，带逗号的那一行是 61 列、Biome 会竖排（2026-09-27 在 `collisions` 上首次踩到——此前没有任何探针产生过非空 collisions，缺陷一直没暴露；已修 + 回归用例 `counts the trailing comma when measuring a collision line`）；
- 与词典门禁一样走 `registry.ts` + `load.ts` 的严格路径，**不 import 软失败的 `src/dict/index.ts`**。

`tooling/checks/manifest.ts`（`bun run check:manifest`）：

- MV3 字段完整性：`manifest_version` 必须为 3、`default_locale` 必填、`permissions` 必须含 `storage`、`action.default_popup` 必须存在且指向的文件真的在 `public/` 里；`manifest.version` 必须等于 `package.json` 的 `version`；
- public 资产与产物引用：`icons` 每个尺寸引用的文件、`action.default_popup`、`content_scripts.js`（必须在内置的 `BUILD_OUTPUTS` 映射里、源码入口存在、且 `dist/` 里真的有该产物——所以这条断言要在 `bun run build` 之后跑）、`content_scripts.matches` 必须含 `https://github.com/*` 与 `https://gist.github.com/*`、`run_at` 必须是 `document_start`（改文件名漏同步即红灯，见硬性约束 4）；
- `_locales` 键集合一致：`__MSG_*__` 引用的键必须在默认语言里存在，各语言的消息键集合必须完全相同（缺键会让某语言的界面出现空文案）；
- **`_locales` 占位符一致性**（`validateLocalePlaceholders`）：同一条消息在所有语言里的 `$NAME$` 引用集合必须一致（否则某语言静默丢掉数值，例如 `devCount` 写成「已收集 条」），且每个被引用的 `$NAME$` 都必须在该条目的 `placeholders` 里声明（未声明的引用在 Chrome 里取不到值）。若所有语言都没用过 `placeholders`，则只做前一条，不凭空要求补声明；
- **`popup.html` 版本号**：`class="version"` 元素的文本（存在时）必须等于 `package.json` 的 `version`。它是 `chrome.runtime.getManifest().version` 覆写前的兜底文案，改了 `package.json` 忘了改它就会出现「关于里版本对不上」。
- **`popup.ts` 的选择器必须存在于 `popup.html`**（`validatePopupSelectors`，记 L-08）：扫 `popup.ts` 里 `querySelector` / `querySelectorAll` 的字符串字面量，逐个断言 `#id` / `.class` / `[attr]` 能在 `popup.html` 里找到。popup.ts 顶层的 `assertFound` 在缺元素时直接抛错 → popup **整页空白**；而 HTML 与 TS 分属两类文件，此前只对了 `data-i18n` 键与版本号文本，**元素 id / class 无人对账**——改个 id 或删个容器，测试与门禁全绿，只有实机点开 popup 才发现。组合型（`div > span`）或拼接出来的选择器静态看不见，门禁**报错而不是放过**，所以 popup.ts 里不要那么写。

### 构建产物集合断言（`tooling/pipeline/build.ts`）

`bun run build` 结束后会把 `dist/*.js` 的实际集合与入口清单逐一比对（`expectedArtifacts` / `diffArtifacts`，纯函数，用例在 `tooling/pipeline/build.test.ts`）：**每个入口必须有恰好一个产物，且产物名必须是 manifest 引用的那个**。Bun.build 没有 `outfile`、产物名靠 `naming` 模板 + 一张 `OUTPUT_RENAMES` 改名表，所以「新增入口却忘了定名」时产物会以入口原名（如 `index.js`）落进 `dist/` 并被 `bun run pack` 无差别打进商店包——这条断言把那种静默错误变成红灯。

同一份用例还**真跑一遍 `buildOnce`**（写进临时目录）：除了产物集合与 `public/` 资产，还断言两份产物都是 **IIFE 包装**而不是平铺的 ES 模块——MV3 的 `content_scripts` 不支持 `type: module`（硬性约束 5），而把 `format` 从 `iife` 改成 `esm` 时，产物里**不会**出现 `import` / `export` 关键字（这两个入口没有导出，实测），只查关键字等于没查；判据必须是包装形态（iife 产物以 `(` 开头、以 `})();` 收尾，esm 产物平铺在顶层）。审计 L-08 说的正是「改坏 build.ts 而 CI 全绿」，所以这条断言必须真跑构建，不能只测纯函数。

## 词典维护指南

### 归档规则（硬性约束）

见 `AGENTS.md` 硬性约束 2；此处补细节：

- **键**必须是 GitHub 实际渲染的英文原文精确串（整节点精确匹配语义），大小写一致、不含目标语言文字系统。一律加双引号——裸键虽然 JSONC 合法，但统一加引号便于 Biome 查重与脚本改写；
- **值**必须含目标语言的文字系统（如简体中文的汉字、日语的汉字 / 平假名 / 片假名），门禁按 `src/dict/locales.ts` 的声明校验；
- `route` 与 `pattern` 都是**字符串形态的正则源**，因此 `/` 无需转义：`"route": "^/owner/repo/issues"`。`route` 必须以 `^/` 锚定 pathname；
- 顶层字段是白名单：`modules` / `rules` / `aliases` / `entries` / `replacements`（哪个文件用哪个见 `types/dict.schema.json`）。多写一个字段（例如把 `entries` 拼成 `entires`）会被 `load.ts` 拒绝——否则整块词典会静默变成空对象；
- **JSONC 里正则的反斜杠必须双写**：TS 字面量 `/^(\d+) minutes? ago$/` 在 JSONC 里写作 `"^(\\d+) minutes? ago$"`。写漏一层 Bun 会直接报 `Syntax Error`（响亮失败，不会静默变成别的正则）。

### 路由保留清单（`pages/repo` 与 `pages/profile`）

这两个模块的路由是**通配形式**，而 GitHub 有一批**保留顶层路径**不是用户名、也不是仓库：

- `pages/profile` 是单段路径（`/octocat`）：裸写 `^/[^/]+$` 会把整包个人主页词条（`Edit profile` / `Block or report` / `Contribution activity`…）注入 `/search`、`/features`、`/pricing`、`/notifications` 等保留路径——注进去的就是该模块当时的全部词条（实测 149 条）；
- `pages/repo` 是两段路径（`/owner/repo`）：裸写 `^/[^/]+/[^/]+` 会命中 `/settings/profile`、`/settings/appearance` 等**用户账号设置页**，把仓库专属词条（`Code` / `Clone` / `Blame` / `Raw`…）注入进去（实测 86 条，且在实机上真的会生效）。

这两条里的条数口径都是「该模块在 zh-CN 数据层当前的词条数」，会随词典增长——复核办法：`bun run check:view` 的输出里，`/settings/profile` 这类路径突然多出几十上百条词条，就是越界了。

所以两者的路由都带**同一份保留名单**的负向前瞻：

```
^/(?!(?:settings|account|billing|sessions|login|logout|signup|join|search|explore|topics|
trending|collections|marketplace|apps|sponsors|codespaces|notifications|dashboard|issues|
pulls|discussions|stars|watching|new|organizations|orgs|users|enterprises|features|pricing|
site|security|team|events|about|contact)(?:/|$))[^/]+
```

（上面为便于阅读折了行，`.jsonc` 里是单行；`profile` 末尾是 `[^/]+$`，`repo` 末尾是 `[^/]+/[^/]+`。）

维护约定：

- **新增 GitHub 保留顶层路径时必须同步改两处**（`core/modules.jsonc` 的 `pages/profile` 与 `pages/repo`），只改一处就会留下一个方向的越界；
- 名单里每一项后面都跟着 `(?:/|$)`：既排除路径本身（`/settings`），也排除它的子路径（`/settings/profile`），但不会误伤形如 `/settings-archive` 的合法用户名；
- 路由属于模块定义，改了必然动 `check:view` 的命中序列快照——用 `bun run check:view --update` 重生成并说明原因；
- 判断某路径是否被越界覆盖的快速办法：`bun run check:view` 的输出会逐条打印「路径 → 命中的模块 + 词条数」，词条数突然变大往往就是注入了不该命的模块。

## 逐页补翻译的标准作业流程

**这一节是给「新会话 / 没有上下文的人或 AI」的检查清单**：每次补一个页面的漏翻，都按下面的顺序走，不要重新摸索采集方式，也不要凭截图直接登记键。全流程的强制约束（归档纪律、防循环、门禁）见 `AGENTS.md` 与本文件其他小节。

### 一、前置事实（先读这三条，能省掉整轮试错）

1. **实机文本只能由维护者在浏览器里采集**。本机（2026-09 实测）没有可用的自动采集路径：`web_fetch` 抓 `github.com` 会被解析安全策略挡下（报「解析到非公网地址」）、复制一份 Edge 配置副本拿不到登录态（运行中的 Edge 独占 `Cookies` 库，GitHub 用的是设备绑定会话）、运行中的 Edge 既不监听 CDP 端口也不是「CDP JSON 端点」。**不要在会话里再试这三条**，直接请维护者用下面两种方式之一采集。
2. **采集必须在「未加载本扩展」的原始英文页面上做**。装了扩展再复制 HTML，拿到的是中英混杂的渲染结果——那会把「已是中文的节点」和「仍是英文的待补节点」混在一起，极易登记错键。要么先用无扩展的窗口打开该页，要么以「仍是英文的模板文案」为待补项、把中文节点当既有词条（本次 `/settings/emails` 会话就是这么做的，可行但更费眼）。
3. **PowerShell 偶发 `SetNamedSecurityInfoW … grantWrite` 初始化失败时，连续重试无用**：那是沙箱初始化问题，不是命令问题。直接向用户说明，改用文件读写工具（read / write / edit / glob / grep）继续推进；用户放权（danger-full-access）后 shell 会自行恢复，届时再跑门禁。

### 二、标准路径

先说两条**具体操作上的坑**（本次会话都踩到过）：

- **登记键与译文时，改完一个文件就立刻跑一次 `bun run check:dict`**。用 edit 工具改 `core/canonical.jsonc` 时，若替换片段里漏掉数组 / 对象的收尾括号，JSONC 会直接变成语法错误（整个词典编译不过）；早跑一次门禁能把问题钉在刚改的那一处，而不是留到后面几十条键一起排查。
- **决定收录某个泛化短词（品牌名、导航短标签）之前，先 `grep` 全仓既有译文与测试**：同一个词可能已被别的模块收录，或已被某份节点边界测试写成**反例断言**（例：`Copilot` 在账单页 / 许可页 / 通知页三份测试里都被断言「必须保持英文」）。先查再收，能省掉一轮「门禁全绿但既有测试红了」的返工。

| 步骤 | 动作 | 产出 / 校验 |
| --- | --- | --- |
| 1 | 定模块与路由 | 该页命中哪个 `core/modules.jsonc` 模块（多半是 `pages/settings` 这类**同模块多页**，键直接追加进去，不新建模块） |
| 2 | 采集实机节点 | 途径 A / B（见下），拿到**逐字**文本节点与可翻译属性 |
| 3 | 登记键 | `core/canonical.jsonc` 对应模块的 `keys` 末尾追加，**顺序与页面出现顺序一致**，并写清节点边界的注释；改完立刻跑 `bun run check:dict` |
| 4 | 补译文 | `locales/zh-CN/<模块>.jsonc` 同步追加键值对（ja 缺译是正常状态，不强制） |
| 5 | 写节点边界回归 | `src/dict/__tests__/pages/[<模块族>/]<页名>.test.ts`：节点原文清单 + 拆分处 `renderNodes` 拼接断言 + **反例**（用户内容 / 纯专名必须保持英文） |
| 6 | `bun run format` 再 `bun run check` | 格式由 Biome 唯一权威，先格式化再跑全量，否则会为纯格式问题白跑一轮 |
| 7 | 快照变了就 `bun run check:view --update` | 只在**有意改动**时更新（新增跨模块同键异译、模块顺序变化），并在提交信息里说明原因 |
| 8 | `bun run build` → 提交 | 提交前 `bun run check` 必须全绿；提交信息写清「哪一页、为什么、快照为何变」 |

### 三、采集途径

**途径 A（首选）：popup 的开发者模式。** 开启后正常浏览目标页，等落盘（每 5 秒 / 页面隐藏时），回 popup 点「复制」得到 `github-zh-misses/1` JSON，直接粘进会话。优点是自带 `path` 与 `count`（出现次数多的先补）。**注意它只含「未命中」的文本与属性**，所以「哪些节点被拆开了」要靠途径 B 补。

**途径 B（节点边界）：Console 采集片段。** 在目标页按 F12 → Console → 先执行一次 `allow pasting`（Edge / Chrome 的粘贴保护）→ 粘贴下面整段。它一次性打出该页**全部文本节点**（含真实空白与父元素，便于识别 `sr-only` / 组件结构）、**六个可翻译属性**、以及**扩展自身的排除判定**（`script` / `style` / `noscript` / `textarea` 等，见了直接忽略）。

```js
// 采集片段（整段粘进目标页 Console；不依赖扩展、不发任何网络请求）
var dump = [];
dump.push("URL " + location.href);
// ① 全部文本节点（含真实空白；父元素 class 用于识别 sr-only / 组件结构）
(function () {
	var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	var n;
	while ((n = w.nextNode())) {
		if (!n.nodeValue || !n.nodeValue.trim()) continue;
		var el = n.parentElement;
		if (!el) continue;
		dump.push("TEXT " + JSON.stringify(n.nodeValue) + " ||| <" + el.tagName.toLowerCase() +
			' class="' + (typeof el.className === "string" ? el.className : "") + '">');
	}
})();
// ② 六个可翻译属性（属性只走精确命中，不走规则）
(function () {
	var attrs = ["title", "aria-label", "placeholder", "alt", "value", "data-disable-with"];
	for (var i = 0; i < attrs.length; i++) {
		var els = document.querySelectorAll("[" + attrs[i] + "]");
		for (var j = 0; j < els.length; j++) {
			var v = els[j].getAttribute(attrs[i]);
			if (!v || !v.trim()) continue;
			dump.push("ATTR " + attrs[i] + " " + JSON.stringify(v));
		}
	}
})();
// ③ 扩展自身的排除容器：这里的文本引擎不会翻译，不要在词典里为它们收键
(function () {
	var sel = "code,pre,kbd,samp,textarea,script,style,noscript,template,.highlight,.blob-code,.diff-table,.js-file-line,.react-code-lines,.CodeMirror,.cm-editor,.markdown-body";
	var els = document.querySelectorAll(sel);
	for (var i = 0; i < els.length; i++) {
		if (els[i].textContent && els[i].textContent.trim()) {
			dump.push("EXCLUDED <" + els[i].tagName.toLowerCase() + "> " + JSON.stringify(els[i].textContent.trim().slice(0, 120)));
		}
	}
})();
dump.join("\n");
```

粘完回车会直接打出全部内容（输出被折叠时点左侧箭头展开）。想复制到剪贴板再执行 `copy(dump)`；**粘贴回会话时务必带上剪贴板内容本身**，只贴那句「已生成 N 行」的返回值等于没采集。

### 四、采集结果怎么读

**入口形态与处理方式：**

| 拿到的形态 | 特征 | 处理 |
| --- | --- | --- |
| 途径 A 导出 JSON（`{"schema":"github-zh-misses/1",…}`） | 只有 `text` / `kind` / `path` / `count` | 这是**未命中清单**，逐条登记；不能据此判断拆分 |
| 途径 B Console 输出 | `TEXT "…" \|\|\| <tag class="…">` / `ATTR …` / `EXCLUDED …` | 节点边界与真实空白以此为准；`EXCLUDED` 直接跳过 |
| 整页 HTML（DevTools 复制 outerHTML） | 结构完整 | 可据 `<strong>` / `<a>` / `<div class="note">` 的嵌套判断拆分点 |
| 截图 | 只有视觉 | **不能作为登记键的唯一依据**（换行、缩进、纯符号节点的存在与否都看不出来），只用于核对数量与语义 |

**判定规则（判错就白干）：**

1. **键 = 整个文本节点** `trim()` 后**把连续空白折叠成单个空格**的形态（引擎的 `normalizeKey`），键里**永不写换行或缩进**；
2. **标签不拆句**：`<strong>` / `<a>` / `<code>` 会把一句话切成多个文本节点，**每个节点各是一条键**。链接文本单独成条；链接前的片段单独成条；被 `<strong>` 包住的用户内容（@用户名、noreply 地址、邮箱）**不收录**；
3. **纯符号 / 纯数字节点翻不了**（`.`、`*`、`↑`、`1.2`），**不要为它们收键**——收了是永不命中的死键；
4. **`sr-only` 文本照常翻译**：`<tool-tip class="sr-only">`、`<span class="sr-only">` 里的无障碍文案也是正常词条（例：`Manage email`、`Select email to become primary`）；
5. **用户内容与纯专名不收录**：邮箱、@用户名、头像 `alt`、仓库名、文件名、`GitHub` / `Copilot` / `Git` / `CLI` 这类专名与缩写。译文必须含中文字系，硬收专名只会让门禁报「译文与键同形」；未命中即保留英文，这是正确行为而不是漏译。**例外**：维护者明确拍板的个别筛选值可以收（`pages/profile` 的 `source` → 「来源」，为了让 `/<用户名>?tab=repositories` 的结果摘要整句读通）——这类词条的误伤风险（同名的仓库 / Gist 会被一起翻）必须写进该模块注释与对应用例，且只登记**当次实机证实存在**的那一个值，不做同族推测；
6. **同一句话被拆开时，译文要能直接拼起来**：`renderNodes` 断言会把节点串起来看结果。原文节点里的前导空格由引擎保留，**译文不要自带首尾空格**（需要空格时说明为什么，例如片段末尾接纯文本邮箱的场景）。拆句里有两个反复踩到的坑（2026-10-02 在 `/<用户名>?tab=repositories` 的结果摘要上连踩两次，实机渲染成「5 个结果，source 个仓库，按 上次更新。」）：
   - **量词只能写在它修饰的那个数字之后的片段里**。数字常常是独立节点（`<strong>5</strong>`）、且永不进词典，所以「个」属于**紧跟数字之后**的那条片段（`results for` → 「个结果，」）；反过来，**页面上没有数的名词不许带量词**——`repositories` 的计数并不存在，写「个仓库」就是凭空多出来的量词；
   - **连接词要落在它所连接的那一段之后**。英文里挂在名词短语上的分词（`repositories sorted by`）在中文里必须说成「按…排序」（动词在宾语之后），若那个宾语在**后一个节点**（`last updated`），整段「按…排序」就都得归它，否则「按」会脱在空中。

### 五、每次收工前的清单

1. `bun run check:dict` —— 键在 canonical 里、译文含中文字系、没有与键同形；
2. `bun run check:view` —— 新增 / 改动同键异译会被点名，确认是有意的再 `--update`；
3. 回归测试覆盖三类断言：**每一条实机节点命中**、**拆分处的拼接结果**、**反例保持英文**；
4. `bun run format` → `bun run check` 全绿 → `bun run build`；
5. 把该页加进上文的「实机节点边界测试」表格（漏了就等于这页没有长期保护）；
6. 提交；提交信息里写清页面、判定依据（哪种采集途径）、快照为何变化。

### 六、已验证走不通的路（别再试）

| 路 | 结果 |
| --- | --- |
| `web_fetch` / 直接 HTTP 抓 github.com | 报「URL hostname resolves to a non-public IP address」（本机 DNS / 代理环境所致） |
| 复制 Edge `User Data` 副本后用无头 Edge 取登录态 | 副本里没有 `Cookies`（被运行中的 Edge 独占）；且 GitHub 是设备绑定会话，即便拿到也未必可用 |
| 读运行中 Edge 的 CDP（`/json/list`、`/json/new`） | 没有开放调试端口；本机 9012-9014 那几个端口是别的本地服务，返回 200 空体，不是 CDP |
| 让扩展自己去盘 leveldb 读 `missLog` | 不必要：popup 的「复制」已经给出等价 JSON，别去解析二进制存储 |
| 连续重试报沙箱初始化失败的 shell 命令 | 无意义，见前置事实 3 |

### 加一条静态或动态词条 / 规则

1. 在 GitHub 实机用 DevTools 确认渲染的精确原文（看文本节点，而不是 DOM 里的源码——见下方「采集实机渲染文本」）；
2. 决定归属模块：全站通用进 `global`，仅特定页面出现的进对应 `pages/<页名>`（模块路由见 `core/modules.jsonc`）；需要新模块时同时改 `core/modules.jsonc` 与 `core/canonical.jsonc`（同名同序，门禁强制）；
3. 在 `core/canonical.jsonc` 对应模块的 `keys` 里登记该键；
4. 在**每种已支持语言**的 `locales/<语言>/<模块>.jsonc` 里加键值对（没翻译的语言可以先不加，覆盖率会显示缺口）；
5. 若该页已有 `src/dict/__tests__/pages/[<模块族>/]<页名>.test.ts` 的实机节点回归，把新节点（以及拼接结果）补进去——没有就在同一 PR 里建一份：**页面上的节点边界只有测试能长期锁住**；
6. `bun run check` → `bun run build` → 浏览器重载扩展验证。

### 采集实机渲染文本

引擎按**单个文本节点**精确匹配，而 GitHub 的长说明句普遍被拆成多个节点（链接拆开、`<kbd>` 夹在中间、无障碍文本放进 `<span class="sr-only">`），因此「整句键」在实机上永远不会命中——**任何页面开工前都应先把真实节点文本抓下来**，不要照着视觉上看到的一整句登记键。做法（在目标页面打开 DevTools → Console）：

```js
// 按关键字找出承载它的文本节点，逐条打印「节点原文 + 父元素」
const probes = ["modifier keys", "formatted on paste"];
for (const p of probes) {
  const it = document.evaluate(`//text()[contains(., "${p}")]`, document, null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  for (let i = 0; i < it.snapshotLength; i++) {
    const n = it.snapshotItem(i);
    console.log(JSON.stringify(n.nodeValue), "|", n.parentElement?.tagName, n.parentElement?.className);
  }
}
```

再配合 Elements 面板右键节点 → Copy → Copy outerHTML，就能看到完整的拆分明细。四类必须记住的边界事实：

1. **`<kbd>` / `<code>` / `<pre>` / `<textarea>` / `.markdown-body` 等容器被整棵排除**（`src/content/filters.ts`），其中的文本节点绝不翻译；`kbd` 之间的连词（如 `and`）若单独成节点，**不要收录**——它与别的模块同键时会互相顶替（本模块在前会压过对方），正确做法是把连词并进相邻片段；
2. **`sr-only` 文本照常翻译**（它不在排除清单里），所以像 `alt upAlt↑` 这种「无障碍文本 + `<kbd>` 序列」在实机里是三段以上，键要按段收；翻译时按视觉意图处理即可（例如 `按 Alt ↑`）；
3. **纯符号 / 纯数字节点翻不了**：可翻译判定要求「含至少一个拉丁字母」（`isTranslatableText`），所以单独的 `.`、`↑`、`1.2` 永远保持原样——**不要为它们收词条**（收了也不会生效，只会变成 canonical 里的死键）；
4. **查询键会 trim + 折叠空白**（`walker.ts` 的 `normalizeKey`），故键里不要写源码缩进；但**不换行空格 `\u00a0` 会被 trim 掉**，按实际文本收键时按「无前导空格」的形态写（本次实测：`"\u00a0to paste a link…"` 收不中，`"to paste a link…"` 才中）。

### 实机节点边界测试（把抓下来的节点锁进仓库）

抓取只是第一步：**节点边界必须落成仓库里的测试**，否则下次 GitHub 改版没人知道它断了。现有的实机节点回归都在 `src/dict/__tests__/pages/`（**不放 `src/content/__tests__/`**：这些用例的被测对象是 `src/dict/**` 的词条数据与模块路由，`buildView` / `translateText` 只是断言工具，`src/content/__tests__/` 只留 content 各模块自身的单测）。**用例按既有文件名前缀分目录**，前缀就是分组依据（2026-10-03 整理，此前 49 个文件平铺）：

- `settings-*.test.ts` → `pages/settings/<页名>.test.ts`（账号设置族，文件名去掉 `settings-` 前缀）；
- `repo-settings-*.test.ts` → `pages/repo-settings/<页名>.test.ts`（仓库设置族，去掉 `repo-settings-` 前缀；族内那页**仓库设置根页** `/owner/repo/settings` 是 `repo-settings/index.test.ts`——它原名 `settings-repo.test.ts`，按前缀会归错组）；
- 组织设置族（模块 `pages/org-settings`，`/organizations/<组织>/settings/**`）同理收进 `pages/org-settings/<页名>.test.ts`；它在 `core/modules.jsonc` 里**排在 `pages/repo-settings` 之后**，而两者的路由互斥（仓库设置的路由排除了 `organizations` / `orgs`，见该文件的注释）；
- 其余**一模块一文件**的（`global` / `dashboard` / `repo` / `profile` / `issues` / `pulls` / `insights-security` / `status-dialog`）留在 `pages/` 根下，不再往下切。

下表列出已登记的实机节点回归，**文件列是相对 `pages/` 的路径**（表由人工维护：新用例按上文规则归位后，照「每次收工前的清单」在表里补一行，别只建文件）：

| 文件 | 覆盖的路径 | 说明 |
| --- | --- | --- |
| `settings/admin.test.ts` | `/settings/admin` | 账号管理页（Turbo frame，长句被链接切碎） |
| `settings/appearance.test.ts` | `/settings/appearance` | 外观设置页（下拉 / 分段控件的当前值本身是节点） |
| `settings/accessibility.test.ts` | `/settings/accessibility` | 辅助功能设置页（按键名 + `kbd` + `sr-only` 拼接） |
| `settings/notifications.test.ts` | `/settings/notifications` | 通知设置页（四处拼接必须成立） |
| `settings/emails.test.ts` | `/settings/emails` | 电子邮件设置页（`<strong>` / `<a>` 把说明段切成三段、弹窗里邮箱是纯文本节点） |
| `settings/education.test.ts` | `/settings/education/benefits` | 教育权益页（H2 与说明段都是**带源码缩进的单个节点**，归一空白后才等于键） |
| `settings/security.test.ts` | `/settings/security` | 账号安全页（通行密钥行的动态日期整句、2FA 横幅三段拼接、密码强度六段拼接；**独立模块** `pages/settings-security`） |
| `settings/sessions.test.ts` | `/settings/sessions` | 会话页（Web / GitHub Mobile 两张卡；动态国家码走 `settings/session-seen-in` 规则，带城市与日期的 `aria-label` 结构上翻不了） |
| `settings/keys.test.ts` | `/settings/keys` | SSH / GPG 密钥页（说明句被两个链接切成四段；`This action cannot be undone.` 三段拼接；`Added <日期>` 是标签 + 日期两个节点） |
| `settings/credentials.test.ts` | `/settings/credentials`、`/settings/apps`、`/settings/developers`、`/settings/tokens`、`/settings/personal-access-tokens` | 凭据 / 开发者设置一族（五页共用一份回归：令牌说明句的链接拼接、卡片计数规则、12 个月份的过期日期规则；OAuth 权限范围标识符保留英文） |
| `settings/limits.test.ts` | `/settings/blocked_users`、`/settings/interaction_limits`、`/settings/code_review_limits`、`/settings/organizations`、`/settings/enterprises` | 限制与组织页（备注剩余字数的规则、交互限制提示的三段拼接、离开组织确认句的动态规则；企业空状态按**实机 HTML** 收录；组织名与 `Settings for <组织名>` 保留英文） |
| `settings/repositories.test.ts` | `/settings/repositories` | 仓库默认设置页（两段说明都在链接处断开；下拉按 appearance 页实测的「标签含冒号 + 当前值」两节点形态收录，其拼好的 `aria-label` 保留英文） |
| `settings/codespaces.test.ts` | `/settings/codespaces` | 代码空间个人设置页（三段拼接的编辑器选项、说明段末尾的独立纯数字节点 + 单位句、区域下拉、仓库选择器计数规则；产品名保留英文） |
| `settings/packages.test.ts` | `/settings/packages` | 软件包个人设置页（搜索框的 aria-label 与 placeholder 同串一条键；已删除软件包空状态含动态用户名，走规则） |
| `settings/copilot-features.test.ts` | `/settings/copilot/features` | Copilot 功能设置页（句号常落在后一节点故译文以「。」起头、`through` 等连接词单独成节点、Copilot Spaces 三段拼接、用量百分比规则；产品名保留英文） |
| `settings/replies.test.ts` | `/settings/replies` | 已保存回复页（Markdown 工具栏与附件组件的文案在 `global`；附件类型说明是「链接 + `is supported`」两段；扩展名清单原样保留、`SavedReply` 是模型名） |
| `settings/pages.test.ts` | `/settings/pages`、`/settings/copilot/coding_agent` | 已验证域名页 + Copilot 云端代理页（两页都很小，合并在一个文件里；说明段是含源码换行的单节点） |
| `settings/security-analysis.test.ts` | `/settings/security_analysis` | 安全与分析页（每个功能一对「启用 / 禁用 / 全部启用 / 全部禁用 + 你即将…确认句」；私密漏洞报告那对确认句含动态账户名走规则；功能标识符 `dependency_graph` 等保留英文） |
| `settings/installations.test.ts` | `/settings/installations`、`/settings/applications`、`/settings/apps/authorizations` | 已安装 / 已授权应用一族（应用名是用户内容，`Report <名>` / `Revoke <名>` / `Reporting <名> …` / `<名> will no longer be able to access …` 四条走规则；词典先于规则命中，`Report abuse`、`Revoke all` 仍走词条） |
| `settings/logs.test.ts` | `/settings/reminders`、`/settings/security-log`、`/settings/sponsors-log`、`/settings/apps` | 定时提醒 / 安全日志 / 赞助记录 / 自建 GitHub Apps（apps 页与**安全日志的事件行**都有实机 HTML 实证：动态值各被 `<span class="context">` 包住、句号独立成节点，故收 `ending in`/`for the`/`OAuth app` 三个碎片键；提醒与赞助记录两页是截图） |
| `settings/profile.test.ts` | `/settings/profile`（ORCID 区块） | 连接 ORCID 后才渲染的段落（**实机 HTML 实证**：标识符与 @账户都被 `<strong>` 包住，故已连接提示收成 `You have a connected ORCID iD` + `for the account` 两段碎片键；另用一条断言钉住 `ORCID iD` 的译文不得与键同形——2026-09 卡死事故） |
| `settings/billing.test.ts` | `/account/billing`、`/account/billing/usage` | 账单 / 用量页（含日期区间规则的顺序语义） |
| `repo-settings/code-review-limits.test.ts` | `/owner/repo/settings/code_review_limits` | 仓库级「代码审查限制」子页（**证据是维护者贴的实机节点**：说明句、开关解释段、以及被 `<strong>read</strong>` 切成三段的开关标签；措辞是 this repository 单数，与账户级 `/settings/code_review_limits` 的 your public repositories 复数互斥，故词条登记在 `pages/repo-settings`，并断言本页不得命中账户级那两条串） |
| `repo-settings/interaction-limits.test.ts` | `/owner/repo/settings/interaction_limits` | 仓库级「临时交互限制」子页（**证据是途径 A 导出的漏翻清单**，2026-09-27：46 条实机条目全部命中；页面级别由措辞判定——本页一律说 this repository 单数，与账户级 `/settings/interaction_limits` 的 your repositories 复数互斥，故词条登记在 `pages/repo-settings`；另锁三处被链接拆开的句子拼接，以及 `Temporary interaction restrictions` 与账户级的 `Temporary interaction limits` 不得合并） |
| `repo-settings/branches.test.ts` | `/owner/repo/settings/branches` | 分支子页顶部的经典分支保护横幅（**证据是维护者贴的实机 HTML**：说明句被两个链接切成五段——前段 / `repository rules` / 连词 ` and ` / `protected branches` / 纯符号句点；` and ` 由本模块既有的 `and` 词条覆盖、句点翻不了也不收，故只登记另外三段与两个按钮。**采集时页面已装扩展，贴出的「与」是既有词条的产物而非上游原文**） |
| `repo-settings/tag-protection.test.ts` | `/owner/repo/settings/tag_protection` | 标签保护子页（**证据是维护者贴的整页截图**：弃用横幅 + `Protected tags` 空状态。横幅说明句里的 `changelog` 是链接，故整句键只作兜底、真正命中的是「前段 / `changelog` / 后段」三条；另锁页面标题 `Protected tags` 与空状态标题 `Protected tags have been deprecated` 不得互相吃掉） |
| `repo-settings/actions.test.ts` | `/owner/repo/settings/actions` | Actions 设置页（**证据是途径 A 导出的漏翻清单**，2026-09-27：63 条里除专名 / 用户内容外全部命中。三条边界事实：两条长说明在实机是**含源码换行的单节点**，键按 `normalizeKey` 折叠；允许列表那两段说明里的 `!` 与 `*` 各自被 `<code>` 包住（排除容器），故引擎看到的只是清单里那些碎片节点；四条嵌**组织名**的文案靠 5 条 `repo-settings/actions-*` 规则，其中 `Allow <org>, and select non-<org>, …` 必须排在 `Allow <org> …` 之前——后者的贪婪 `(.+)` 会把前者整段吞掉） |
| `repo-settings/runners.test.ts` | `/owner/repo/settings/actions/runners`、`…/runners/new` | 运行器列表页与新建页（**证据是途径 A 导出的漏翻清单 + 一张列表页截图**，2026-09-27：除专名外全部命中。三条边界事实：架构名与平台名（`x64` / `ARM64` / `ARM` / `Linux` / `Windows` / `macOS`，含它们作 aria-label 的形态）**有意不收录**；新建页的许可说明是**含源码换行的单节点**，键按 `normalizeKey` 折叠；两支面包屑标题靠 2 条 `repo-settings/runners-*` 规则，而侧栏那个单独的 `Runners` 是静态词条、不会被规则连仓库名一起吞掉） |
| `repo-settings/actions-policies.test.ts` | `/owner/repo/settings/actions/rules`、`…/rules/insights`、`…/actions/oidc-configuration` | Actions 策略三支（**证据是途径 A 分别导出的三份漏翻清单**，2026-09-27。三条边界事实：策略列表的弃用横幅被 `<code>pull_request_target</code>` 切成两段、两段译文拼起来要读作「…将限制 pull_request_target 在公开仓库中的使用。」；洞察页 `See how rulesets are affecting this` + 链接文本 `repository` 是两条键；OIDC 标题在实机有 `OIDC Configuration` / `OIDC configuration` 两种大小写形态，是两条不同的键，另锁两条面包屑规则 `Settings · Actions policies · <repo>` / `Settings · Insights · <repo>`） |
| `repo-settings/hooks.test.ts` | `/owner/repo/settings/hooks`、`…/hooks/new` | 网络钩子列表页与新建页（**新建页的证据是维护者贴的「未装扩展」的实机 HTML**，是权威节点边界；由此确认四件事：必填标记 `*` 是独立 `<span aria-hidden="true">`、`(not recommended)` 被独立 `<span class="f6">` 包住、说明段里的 `POST` 与 `x-www-form-urlencoded` 在 `<code>` 里而 `<em>etc</em>` **不在**（照常翻译）、三个选项标签里前两个被内联元素切开。新建页的 56 个事件各收「名称 + 说明」两条键，其中 `Deploy keys` / `Discussions` / `Pushes` 与设置侧边栏、推送设置同串同义，复用不重复登记；列表页仍只有截图，那句说明由 `repo-settings/webhooks-intro` 规则承担，撇号直弯都用 `['’]` 覆盖） |
| `repo-settings/index.test.ts` | `/owner/repo/settings` | 仓库设置页的两批**原版 HTML 片段**证据（整页仍未采集）：① 2026-09 的「Creation allowed by」筛选按钮（标签、当前值、菜单项是三个独立文本节点）；② 2026-10-03 的议题创建策略 action-list（`issue_creation_policy`，标签复用 `All users` / `Collaborators only`，说明句 `Anyone can create an issue` / `Only collaborators can create issues` 各自成节点）与保留期一节（**上游把文案改成枚举五项**的 `Check, workflow run, status, artifact and log retention`，它在同一段 HTML 里出现两次——`<h2 id="retention-header">` 与 `<strong id="artifact-retention-subheading">`，一条键覆盖两处；旧版短文案保留，由 `actions.test.ts` 覆盖，两批是不同的键） |
| `repo-settings/rulesets.test.ts` | `/owner/repo/settings/rules`、`/owner/repo/settings/rules/<id>` | 规则集列表页与详情页（**证据是途径 A 导出的漏翻清单 + 两张实机截图 + 维护者贴的两段实机 HTML**（状态检查与「合并前需要拉取请求」两个规则的展开面板），2026-09-27：清单里除专名 / 用户内容外的节点、以及两段 HTML 里的全部节点都命中；本页此前**没有任何词条**，属整页新增。三条边界事实：规则名 `Protect Default Branch`、仓库名、用户名、分支名 `main` 与产品名保持英文；组合型 aria-label（`Active, Enforcement status`、`Roles, Filter actors by category`、`Squash, Allowed merge methods`）是**属性**、不走正则规则，故逐条收静态键；含动态值的文本（列表行计数、目标计数、面包屑、`Apps • <应用名>`、`Delete include of <分支模式>`）靠 6 条 `repo-settings/ruleset-*` 规则，分隔符用字符类同时覆盖 `•` 与 `·`。清单里孤立的 `changes` 来源不明，有意不收） |
| `org-settings/profile.test.ts` | `/organizations/<组织>/settings/profile` | 组织资料页（**证据是途径 A 导出的漏翻清单**，2026-10-03：侧栏 49 项、设置外壳与表单标签全部命中，预览标签的 title / aria-label 同串也锁住。这一页同时是**路由排除的回归**：排除前整包仓库设置词条会注入组织设置页（实机把 `Actions` 译成「Actions 工作流」是仓库模块干的），排除后这两条由本模块自己提供、措辞保持一致。国家 / 地区下拉的名称、社交平台品牌名、产品名（Dependabot / Copilot / OIDC）与组织名都按反例断言保持英文） |
| `org-settings/policies-repositories.test.ts` | `/organizations/<组织>/settings/policies/repositories` | 组织仓库策略页（同一条途径 A 清单：页面标题 `Settings · Repository policies · Koishi-CE` 走 `org-settings/page-title` 规则，中段页面名保留英文、末段组织名原样带回；rulesets 提示是**同一句被链接拆开**的两段，拼接后读作「组织规则集将不会强制执行 直到你将此组织账户升级为 GitHub Team。」；国家 / 地区下拉按维护者拍板暂不收录） |
| `repo.test.ts` | `/owner/repo` 及子页 | 仓库页（导航、文件列表、README 与 README.md 的区分；侧栏星标 / 关注 / 复刻三个计数走 `repo/*-count` 规则，数字随仓库变化，另收 `4.1k` / `1,234` 这类缩写形态） |
| `profile.test.ts` | `/<用户名>?tab=repositories` | 个人 / 组织主页的仓库列表（Type 下拉九项按**整节点相等**断言；结果摘要行是五个节点——`5` / `results for` / `source` / `repositories sorted by` / `last updated`，加粗的三段各被 `<strong>` 单独包住，靠三条 `profile/repo-results-*` 规则 + `results for` / `last updated` 两条片段词条拼装，整句渲染成「5 个结果， 来源 仓库， 按上次更新排序」（量词只跟数字、连接词落在宾语之后，见「四、采集结果怎么读」第 6 条；筛选值 `source` 按维护者拍板收成词条，代价见第 5 条例外）；`Clear filter` 与 Type 菜单里上游未本地化的 `Can be sponsored` / `Templates` 一并锁住） |
| `issues.test.ts` | `/owner/repo/issues` | 议题列表页 |
| `pulls.test.ts` | `/owner/repo/pulls` | 拉取请求列表页 |
| `insights-security.test.ts` | `/owner/repo/security` | 仓库安全概览页（**证据是维护者 2026-09-27 贴的实机 HTML**：顶部 Scorecard / Code scanning 横幅被 `<a>status page</a>` 切成三段；七个功能行的标题与状态是两个节点，但**项目符号 `•` 落在标题节点内部**，故带 ` •` 的形态由本模块各收一条——裸标题 `Security policy` 仍由 pages/repo 提供，两条各自独立；`View alerts` 这类短链接在源码里带 16 空格缩进，键按 normalizeKey 折叠空白） |
| `global.test.ts` | 任意路径 | 全站外壳、动态时间文本与仓库可见性标签（`Public` / `Private` / `Public template` / `Private template` / `Public archive` / `Archived`——标签是独立节点、「可见性 + 类型」固定短语，故整族归 global，仓库页与个人主页共用；`Public template` 的证据是维护者 2026-10-02 在 `?tab=repositories` 贴的 `Label Label--secondary` 片段） |

除上表外的用例都不再是「实机节点」而是纯逻辑回归：`src/content/__tests__/pages.test.ts`（视图单槽缓存：缓存键写错会表现为「换页后一半英文」）、`src/shared/__tests__/storage.test.ts`（storage 脏数据收窄与开关 / 语言监听）、`src/dict/__tests__/locales.test.ts`（`resolveLocale` 对 `zh-Hans-CN` / `zh_TW` / `en-US` 的归属），另有门禁自身与构建脚本的测试（`tooling/checks/__tests__/`、`tooling/pipeline/build.test.ts`）。

新增的进程内测试补齐了四个**此前从未被任何测试加载**的模块：`src/content/__tests__/engine.test.ts`（观察器调度）、`src/content/__tests__/index.test.ts`（content 入口装配）、`src/popup/__tests__/popup.test.ts`（popup 全交互）、`src/shared/__tests__/identity.test.ts`（身份标记契约）。凡是需要 DOM 语义的用例（walker / engine / index / popup / collector）**一律从 `src/test-support/dom.ts` 取环境**——devDependency `happy-dom`，**手写 DOM 桩已全部退役**。

`bun test` 的 `globalThis` 与模块注册表**跨测试文件共享**，三条硬约束违反任一条都会让**别的文件**的用例成片变红（2026-10-03 逐一踩过）：

1. **不要用 `mock.module`**：它是进程级注册，会泄漏给同一进程里的其他测试文件（实测：入口测试 mock 掉 `collector` / `pages` 后，walker 与全部页面测试找不到真实导出）；
2. **全局桩一律合并挂载**（`obj["k"] = v`），**禁止整体替换** `globalThis.chrome` / `document`——整体替换会删掉别的测试文件刚装好的命名空间（实测：入口测试的 chrome 桩只有 `i18n`，把 storage 测试的 `chrome.storage` 打掉，12 个用例失败）；
3. **DOM 只有一份来源**（`src/test-support/dom.ts`）：`walker.ts` 用 `root instanceof Element` 判根节点类型，而 `instanceof` 比的是**类身份**——两个文件各造一个窗口，后装的那份会让先装的那份的节点不再 `instanceof Element`（2026-10-03 用两份内联桩实际踩到，成片用例变红）。该文件同时负责在用例文件收尾 `restore()`：bun 是**按文件**「加载 → 跑 → 下一个」（实测），还原后下一个文件拿到的仍是它自己期望的全局。它自身的行为（嵌套安装的还原、观察留痕、事件钩子留痕且照常派发）由 `src/test-support/dom.test.ts` 钉住（与被测模块平级，遵守「测试与源码同目录」）。

**popup 为什么改用真实 DOM**：popup.ts 顶层的 `assertFound` 在缺元素时直接抛错 → popup **整页空白**，而 `popup.html` 与 `popup.ts` 分属两类文件。写桩 DOM 时，桩里的选择器列表是从 HTML **抄**来的——HTML 改了测试照样全绿。改用 happy-dom 加载真实 HTML 后，删掉或改名任一元素都会当场红灯（实测：把 `#dev-panel` 改名后 popup 测试报「popup 结构不完整：缺少 #dev-panel」）。同一份契约另有一道**零依赖**的静态防线——`check:manifest` 的 `validatePopupSelectors`（只查存在性，不需要 DOM 库）：一道锁结构、一道锁行为，缺一不可。

真实 DOM 还当场纠正了一条**桩掩盖的语义**：`#status` 是双重身份元素（HTML 兜底文案 `statusLoading`，启动后立刻被 `statusOn` / `statusOff` 覆写）。手写桩把它拆成两个对象，于是「data-i18n 全部回填」的断言一直在假通过。

**真实 DOM 还抓出了一个真实缺陷（2026-10-03，已修）**：`TreeWalker` 的过滤器**不作用于 root**——DOM 规范里 root 只是遍历的起点与边界，`nextNode()` 永远不会把它交给过滤器；而属性变更记录的 `target` 恰恰是**那个元素本身**，引擎把它入队后调用的是 `translateTree(input)`。于是「上游（Turbo 快照 / `data-disable-with`）把按钮 `value` 改回英文后重翻」这条功能**在实机上是坏的**：`input` 自己的 `value` 从来不会被翻。修法是 `translateTree` 里那句 `applyAttrs(root, view)`，回归用例是 `walker.test.ts` 的「translates attributes on the traversal root itself」。**手写桩的结构性缺陷正在这里**：旧桩的 TreeWalker 会把 root 也过一遍过滤器，于是这个缺口永远是绿的——桩的危险不是「不够真」，而是它会悄悄改变被测对象的拓扑。

**防翻译循环现在有一条端到端验证**：`engine.test.ts` 的「writes nothing for a dictionary entry that maps to itself」先用真实 `MutationObserver` 证明**同值写入也产生 characterData 记录**（规范如此，这是循环在结构上成立的唯一原因），再断言引擎跑完整轮后 DOM 上一条新记录都没有。这类断言非真实 DOM 不可得。

**happy-dom 的使用边界**：它是 devDependency（不进 dist），只给「需要真实 DOM 语义」的测试用。49 个页面词条回归是纯字符串断言（`translateText`），**不要**为它们引入 DOM —— 那是测试量的主体，也是收益为零的地方。happy-dom 也不是浏览器：扩展 API（`chrome.*`）仍需自桩，语义差异风险仍在，故**不能替代实机验证**。

另注：content 入口与 popup 都有顶层副作用，**一个进程只会装配一次**，所以有两处覆盖不到，都不是「忘了写」而是结构上做不到：

- 「`enabled` 关闭时不启动观察器」这条反向条件无法再开一个测试文件验证（第二个文件会复用第一次的装配结果，`?query` 也不产生新实例——Bun 实测不支持）。该闸门由 `engine.test.ts` 的「关闭时只清空队列不翻译」与 `readEnabled` 的默认值把守；
- `popup.ts` 末尾那个 `try { main() } catch` 兜底分支同理（要覆盖它得造出第二个「`main()` 抛错」的装配场景）。它是纯兜底，代价可接受；`popup.ts` 顶层的 `assertFound` 仍在 `main()` 之外抛出，**刻意不吞**（缺元素属打包错误，掩盖它只会让人更难查）。

**已知空缺：`repo-settings`（`/owner/repo/settings`）整页尚未采集**（该页需要登录），所以仓库设置页没有**整页**的实机节点回归——目前它只有三处：`repo-settings/index.test.ts` 覆盖的「Creation allowed by」筛选按钮三节点、2026-10-03 采集的议题创建策略 action-list 与保留期改版文案，`repo-settings/actions.test.ts` 覆盖的 Actions 子页（途径 A 清单），与 `repo-settings/interaction-limits.test.ts` 覆盖的交互限制子页（途径 A 清单）；其余词条靠视图骨架层的保护（命中模块序列 + 碰撞赢家）与词典门禁。

组织设置族（模块 `pages/org-settings`）同样是**部分采集**：2026-10-03 的途径 A 清单只覆盖 `settings/profile` 与 `settings/policies/repositories` 两页，其余子页（`member_privileges` / `authentication_security` / 计费各页…）尚无任何实机证据，正文词条的长期保护同样只有视图骨架层。补下一批时的两条注意：① 采集必须在**未加载本扩展**的原始英文页面做，或明确以「仍是英文的模板文案」为待补项（本页清单是后者，故清单里混着扩展自己写入的中文译文产物——凡是 `kind: "text"` 却是中文的条目都不是漏翻，别登记）；② 国家 / 地区下拉的名称（约 200 条）与社交平台品牌名**有意不收录**，见 `pages/org-settings` 的译文文件头。

每个实机测试文件的结构都一样：文件头写明节点来源与日期，然后是一份**逐字录入的 `nodeValue` 清单**（带源码缩进 / 换行的按原样保留，因为实机里长句的节点自带缩进），用 `translateText(节点, 该路径的 buildView(...))` 断言命中与译文，另有一组**反例**断言用户内容（文件名、仓库名、`README.md`、小写常用词）**必须不被翻译**。

怎么抓（简述，不需要装任何依赖）：

1. **无扩展的无头 Edge**：用 `msedge --headless=new --remote-debugging-port=<端口> --user-data-dir=<临时目录>` 打开目标页面，**不要加载 `dist/`**——要的是 GitHub 的原始英文渲染，不是翻译后的结果；
2. **CDP 采集文本节点**：连上 DevTools 协议，用 `Runtime.evaluate` 跑一次 `document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)`，把每个文本节点的 `nodeValue` 与父元素路径（tag + class 链）一起打出来；需要元素属性时另跑一遍 `title` / `aria-label` / `placeholder` / `alt` / 按钮类 `value` / `data-disable-with`；
3. **在仓库内判定命中**：把采集结果喂给 `translateText(text, buildView(pathname, dictForLocale("zh-CN"), 别名映射))`——命中即为「这条节点已经有词条」，未命中且确实是 UI 文案就是待补的漏翻；**采集时会自然暴露出「哪些整句在实机上被拆过」**，这是登记键的唯一依据；
4. 把清单连同反例一起写进 `src/dict/__tests__/pages/[<模块族>/]<页名>.test.ts`，`bun test` 全绿后提交。

**M-02 的实机结论（`repo.test.ts` 的反例就是它的回归保护）**：仓库页的文件 / 目录列表**确实**渲染成孤立文本节点（`div.react-directory-filename-cell > a.Link--primary` 里的 `src` / `test` / `build` / `extensions` / `resources` / `scripts` / `.github`…），而它们**全部没被翻译**——因为小写常用词没收录。也就是说硬性约束 3 那条「宁可漏翻也不误伤用户内容」的权衡在实机成立；残留风险是「仓库里真有一个叫 `Docs` / `Assets` / `Star` 的目录」这类**条件性误伤**，唯一的保护是继续不收录可疑短词，而不是加白名单。

### 加一条动态规则

1. 在 `core/rules.jsonc` 对应模块分组的 `rules` 里追加 `{ "id": "...", "pattern": "..." }`——**位置决定优先级**：带修饰语的规则排在泛化规则之前（首例：`^([\\d,]+)\\+ workflow runs?$` 必须排在其泛化形式之前）；
2. id 全局唯一、形如 `<模块短名>/<语义>`（如 `global/minutes-ago`）；
3. **捕获组命名约定**（`$1` 只有位置信息，译另一门语言的人必须回头读 pattern 才知道谁是谁）：

   - **≥2 个捕获组必须用命名组**，模板里一律写 `$<name>`：

     ```jsonc
     { "id": "global/long-date-january", "pattern": "^January (?<day>\\d{1,2}), (?<year>\\d{4})$" }
     ```

     对应模板 `"$<year> 年 1 月 $<day> 日"`（原生 `$<name>`，**不要自造 `{name}` 模板语法**）。

   - **单组规则保持 `$1`，不命名**：`$1` 没有歧义，命名只增加无意义的改动与噪音。

   - 组名按语义取，同一 pattern 内必须唯一，且只允许 `[A-Za-z_$][A-Za-z0-9_$]*`（JS 规范）。现有词表：

     | 语义 | 组名 |
     | --- | --- |
     | 日期 | `day` / `year` / `time` |
     | 日期区间（同月） | `startDay` / `startYear` / `endDay` / `endYear` |
     | 计数 | `count`（总量用 `total`；改动行数用 `additions` / `deletions`） |
     | 计数 + 单复数后缀 | `count` / `plural`（`(?<plural>y\|ies)` 只为折叠单复数，模板通常不引用） |
     | 时长 | `hours` / `minutes` / `seconds` |
     | 仓库 / 用户 | `repo` / `owner` / `actor`；标题用 `title`、编号用 `number` |
     | 图表 a11y | `navigator` / `series` / `seriesCount` / `points` / `yAxis` / `xAxis` / `axisCount` / `from` / `to` |

4. 在每种语言的 `locales/<语言>/rules.jsonc` 里加 `id → 模板`；模板必须含该语言的文字系统；
5. 门禁会校验引用完整性（`$2` 超出组数、`$<month>` 未声明都会报错），`bun run check:dict` 通过后实机验证。
6. **只改 pattern 不必动任何语言的模板**（O(1)）；反过来说，**改 id 必须同步所有语言的 `rules.jsonc`**。
   另外：视图骨架门禁记的是规则 **id**、不记 pattern 源串，所以给已有规则加命名组不会动快照。
7. **单复数要整体折叠，别只给末尾加 `?`**：`repositor(?:y|ies)` 才对，写成 `repositories?` 只折叠末尾的 `s`、匹配不到单数 `repository`（2026-09 实测踩到：`Selected 1 repository.` 整条保留英文，而 `Selected 0 repositories.` 正常）；`keys?` / `tokens?` / `apps?` 这类「单数就是复数去掉 s」的词才可以直接加 `?`。加规则时把单数、复数两种形态都写进用例。

### 日期区间为什么逐组合展开（以账单页为例）

`/account/billing`（账单总览）与 `/account/billing/usage`（用量页）把同一个账期写成**两套**英文形态：
账单总览是长月份（`September 1 - September 30, 2026`），用量页是短月份（`Sep 1 - Sep 30, 2026`）。
两者都只能靠 `settings/usage-range-*` 规则覆盖，且**必须逐组合展开**（2026-09 实测：长月份
`settings/usage-range-*` 共 144 条 = 同月 12 + 跨月 132；短月份 `settings/usage-range-short-same-month-*`
11 条；两组合计 155 条，每种语言各写一份模板）：

- 引擎的替换模板不支持「捕获组 → 中文月份」的映射，模板里引用捕获组会渲染出英文 `September`，
  所以月份必须写死在 pattern 与模板里；
- **全展开的代价如实记在此处**：这 144 条长月份规则挂在 `pages/settings-billing` 模块下，而该模块的
  路由是 `^/(?:settings|account)/billing`——当前命中 **5 条探针**（`/account/billing`、`/account/billing/ai_usage`、
  `/account/billing/budgets`、`/account/billing/licensing`，以及旧路径兼容锚点 `/settings/billing`），所以视图骨架快照会在这 5 处各膨胀一百多个
  永不使用的规则 id；把它们上提到 `pages/settings` 更糟：每条 `/settings*` 探针都会背上这一百多条；
- 跨月短月份（如 `Sep 1 - Oct 1, 2026`）**暂无实证**，故目前只收同月 11 条：未命中只是保留英文，
  不会产出中英残句（`global/short-date-*` 两端都以 `^…$` 锚定，不做部分替换）。短月份里 5 月的全称与缩写
  同形（`May` 就是 `May`），原先两条 pattern 逐字符相同，后一条永不生效——已删除死规则
  `settings/usage-range-short-same-month-may`，并由词典门禁的「同模块 pattern 唯一」断言接管；
- 用量页原先的实机译文对照图**已随该页改造删除**（`71ba590` 删掉了那张图与整个图片目录，仓库里不再有该资产、也没有任何页面引用它）；需要对照时按「实机节点边界测试」一节的方法自己抓一轮，或用 popup 的开发者模式看漏翻。

### 为什么账号安全页单独成模块（`pages/settings-security`）

`/settings/security` 有一批**只能靠规则**覆盖的动态文本，大头是每条通行密钥的元信息行（实机是**含源码换行的单个文本节点**）：

```
Added on Mar 6, 2026
              | Last used
                6 days ago
```

两句都含动态值，而引擎的替换模板不支持函数映射：月份（`Mar`）与相对时间（`6 days ago`）都无法经捕获组变成中文，只能逐组合全展开——12 个月份缩写 × 10 种相对时间形态 = 120 条，另加 12 条「强制启用 2FA」横幅里的截止日长句（`before April 30, 2026`），共 132 条。

- 这批规则若挂在 `pages/settings` 下，`/settings/profile`、`/settings/accessibility`、`/settings/notifications`、`/settings/billing` 四条探针会各自背上一百多条永不使用的规则 id，把视图骨架快照淹掉；因此本页单独成模块，只有它自己的探针 `/settings/security` 承担这批 id；
- 本模块路由 `^/settings/security` 与 `pages/settings` 的 `^/(?:settings|account/billing)` **重叠**，`buildView` 逐键「先到先得」：本页专属词条放前一个模块，侧栏与通用设置词条由 `pages/settings` 兜底——**不要在两个模块里登记同一个键**，否则前者胜出、后者是看不见的死数据；
- 未枚举的相对时间形态（`last week`、绝对日期等）整节点保留英文：规则两端以 `^…$` 锚定、不做部分替换，所以不会产出中英残句，这与「宁可漏翻也不产出残句」的既有取舍一致；上游若把相对时间改成 `<relative-time>` 元素渲染，整句会被拆成多节点、这 120 条规则自然失效，届时按实机节点重收碎片词条。
- **2026-09 补丁：`about` 前缀**。GitHub 把小时档的相对时间渲染成 `about 1 hour ago`（漏翻导出在 `/settings/security` 抓到 `Added on Mar 6, 2026 | Last used about 1 hour ago`），原先的 `(?<count>\d+) hours? ago` 匹配不到，故 12 条 hours 形态的 pattern 统一放宽为 `(?:about )?(?<count>\d+) hours? ago`——**只改 pattern，各语言模板不动**（模板只引用 `$<count>`）。分钟 / 天等档位没有 `about` 形态的实证，保持原样；抓到时按同一手法放宽。

### 凭据 / 开发者设置一族的三个取舍

`/settings/credentials`、`/settings/apps`、`/settings/developers`、`/settings/tokens`、`/settings/personal-access-tokens` 五页共用 `pages/settings` 模块（路由 `^/(?:settings|account/billing)`），词条直接追加在那里，不新建模块——它们只带来 16 条规则，没有 `pages/settings-security` 那种「一百多条规则淹掉别的探针」的规模问题。三条需要记住的取舍：

- **OAuth 权限范围标识符不译**（`repo` / `user` / `workflow` / `gist` / `notifications` / `project` / `copilot` / `codespace` / `audit_log` / `admin:*` / `read:*` / `write:*` / `delete:*`）：它们是 API 里的字面量，译了会与代码、文档、报错信息对不上，与 `GPG` / `CLI` 同属「纯标识符保留英文」。芯片的 `title` 是**人类可读说明**，那部分要译（已逐条收录，见 `settings/credentials.test.ts`）；
- **令牌过期日期按 12 个月份全展开**（`settings/expires-on-*`）：实机节点形如 `on Fri, Nov 27 2026` / `on Wed, Sep  2 2026`——周几缩写 + 月份缩写 + **空格补齐的日**、年份前无逗号。月份无法经捕获组映射成中文（与 `global/short-date-*`、`settings/usage-range-*` 同一个原因），故写死月份；周几用 `[A-Za-z]{3}` 吃掉且**中文里不体现**（`2026 年 11 月 27 日` 已足够，且周几由日期唯一确定）。日与月之间的多个空格用 ` +` 容忍；
- **`GitHub API` 保留英文**：纯专名加缩写，译文无法含中文字系（门禁要求含目标语言文字系统），未命中即保留英文是正确的；句子被链接切开时按碎片收录，拼接后仍读得通。

`/settings/personal-access-tokens` 有一条**待复核**的漏翻：导出里是 `You can’t perform that action at this tim`（疑似被截断，正常文案应是 `… at this time.`）。**没有把握的原文不收**（收了就是永不命中的死键），下次采集时用 Console 片段确认后补。

### 上游改版时怎么办

| 情形 | 例子 | 做法 |
| --- | --- | --- |
| 文案改词，语义不变 | `Sign in with GitHub` → `Sign in to GitHub` | `core/aliases.jsonc` 加一行映射，译文不动（O(1)） |
| 节点被拆开 / 拼接 | `Collaborators 3` 拆成两个 span | 新增碎片词条（如 `Collaborators`），必要时配计数规则；旧整句键从 canonical 删掉 |
| 语义真的变了 | `Watch` → `Subscribe` | **不要加别名**：改 canonical 的安全做法是新增键、删旧键，然后各语言重译 |
| 页面结构变了导致漏翻 / 误伤 | React 重写 | 先修 `src/content/filters.ts` 的排除选择器，再考虑词条 |

「旧键不再渲染」不会报错（引擎只是再也命中不到它），所以定期用 popup 的开发者模式采集漏翻、并清理 canonical 里的死键是维护常态。**上游把整句拆成多节点时，整句键会静默失效**（节点拼接前的文本永远不出现）：这时要按实机节点逐片收录碎片键，并把旧整句键从 canonical 删掉——留着不会报错，但会和碎片键互相顶替（同一节点命中错的那条）。

### 新增一种语言

1. `src/dict/locales.ts`：加一条 `LocaleMeta`（id 用 BCP 47 规范写法、显示名用该语言自身书写、声明文字系统；拉丁语系目标传空数组 `scripts: []`——它与源语言同字系，脚本守卫结构上失效，防循环只剩「译文不得等于任何键」）；
2. `src/dict/registry.ts`：加一段 `LocaleRaw`（`modules` 里只列已开始翻译的模块，`rules` 指向该语言的 `rules.jsonc`，一个都没译可传 `null`）；
3. `src/dict/locales/<id>/`：建 `global.jsonc`（可先只放几条样例）与可选的 `rules.jsonc`；
4. 若该语言的浏览器界面语言也需要扩展自身 UI 文案，在 `public/_locales/<Chrome 语言标识>/messages.json` 补一份（键集合必须与默认语言完全一致，门禁强制）；
5. `bun run check`：覆盖率报告会列出待译模块。

### 批量补词条

从开发者模式导出的 JSON 往往一次带来几百条待补词条。路径是纯数据追加：先按模块把键登记进 `core/canonical.jsonc`，再往 `locales/<语言>/` 的对应文件追加键值对。不必担心「重复键被静默覆盖」——单文件重复键由 Biome 报错，跨模块同键异译由模块顺序决定（见 `registry.ts` 注释）。

## 手工加载与调试

1. `bun run watch`：改动 src / public 自动重建 `dist/`；
2. `chrome://extensions`（Edge 为 `edge://extensions`）→ 开发者模式 → 「加载已解压的扩展程序」→ 选择 `dist/`；
3. 改动源码后：重建 + 在扩展卡片点「重新加载」+ 刷新 GitHub 页签；
4. **漏翻排查**：DevTools 看文本节点原文 → 该键是否在 `core/canonical.jsonc` 里 → 当前语言的 `locales/<语言>/<模块>.jsonc` 是否收录 → 模块归属是否正确 → 是否被排除容器挡住；
5. **误伤排查**：定位承载元素 → 把容器选择器加进 `filters.ts` 排除清单 → 再考虑词典侧回避；
6. **切语言调试**：popup 改「翻译语言」会整页刷新；想验证某语言的真实覆盖率，可先切到它再逛页面，用开发者模式看漏翻量。

## 开发者模式（漏翻收集）

popup 底部的「开发者模式」开关**默认关闭**，用于系统性发现漏翻：开启后，content script 在翻译时把未命中词典与规则的文本记录下来（仅本地，无任何网络请求）。逛几页 GitHub 攒一批后，在 popup 一键复制为 JSON，粘贴给 AI 会话批量补词条。

### 用法

1. popup 开启「开发者模式」——已打开的 GitHub 页签自动刷新，之后开始收集（翻译开关关闭时不翻译，自然也不收集）；
2. 正常浏览仓库 / 议题 / PR 等页面，引擎每 5 秒（以及页面隐藏 / 卸载时）把缓冲合并写入本机 `chrome.storage.local`；
3. 回到 popup 查看「已收集 N 条」，点「复制」得到 JSON，粘贴给 AI 会话或按下方归档规则手工补词条；
4. 点「清空」重新攒一批；
5. 需要覆盖更多页面时，重复上面 1–4 步。**当前只有这条采集路径**：自动化实机探针（原先的 `tooling/verify-live.ts`，由 `bun run verify` 调用）已于 `48bf519` 删除、**尚未重建**，`package.json` 里也已删掉那个脚本，仓库里不存在任何可跑的自动化探针命令。

### 收集范围与导出格式

- 文本节点：未命中静态词条与正则规则的可见 UI 文本（trim 后原文）；
- 属性：`title` / `aria-label` / `placeholder` / `alt` 未命中词条的原值（引擎另外还翻译按钮类 `value` / `data-disable-with`，共 6 项；收集时这两项归到 `aria-label` 这一类，故 `MissKind` 只有 4 个属性名）；
- 记录的 `text` 就是「GitHub 渲染的精确英文原文」，可直接作为 canonical 候选键（`kind: "text"` 为文本节点，其余 kind 为属性名）；
- 缓冲上限 300 条、落盘上限 500 条（满了保留先收集的），同键累加出现次数、`path` 取首次出现页面的 pathname。

导出 JSON 结构（排序：path 升序 → count 降序 → text 升序）：

> `schema` 字段里的 `github-zh-misses/1` 是**故意保留的旧名**：它是用户粘贴回来的 JSON 里的字段值，
> 改名会让已经导出的旧数据无法被识别。仓库改名不影响它。

```json
{
  "schema": "github-zh-misses/1",
  "exportedAt": "2026-09-25T12:00:00.000Z",
  "items": [
    { "text": "Some English Text", "kind": "text", "path": "/owner/repo/pulls", "count": 3 }
  ]
}
```

## 隐私

- 漏翻收集**默认关闭**，开启前零收集；全程无任何网络请求；
- 收集内容仅存本机 `chrome.storage.local`，不自动上传、不同步、不导出下载；
- 导出内容可能含页面文本（文件名、仓库名等），复制后请自查再粘贴。

## 包体与分发

- content script 必须内联全部词典（现在是同步注入、天然无闪烁），所以数据是产物的大头。口径与实测（2026-09）：
  - **content.js 约 351 KiB**（`minify: false`，即不压缩、便于在浏览器里排查漏翻）——复核：`bun run build` 之后取 `(Get-Item dist/content.js).Length`（快照时是 358,969 字节）；
  - **词典数据本身**（编译后模块词典 + 规则模板的紧凑 JSON）约 **197 KiB**：zh-CN 约 198 KiB（18 个模块槽 / 2207 条词条 / 589 条规则）+ ja 样例约 3 KiB。复核办法：`JSON.stringify(dictForLocale("zh-CN"))` 的 UTF-8 字节数（2026-09 实测 203,161 字节）。这个口径不含引擎、调度与收集器代码，也不是磁盘上的某个文件。规则条数对体积敏感：`/settings/security` 那 132 条日期规则（见「为什么账号安全页单独成模块」）在紧凑 JSON 口径下就占约 15 KiB；
  - **规则与键的条数别再手抄**：随词典增长，一律看 `bun run check:dict` 的输出（「N 模块 / N 规范键 / N 条共享规则 / N 条译文」，口径见「稀疏覆盖」一节）。
  上面两个体积同样随词典增长，改动词典后如需引用数字请重新测量；
- 因此 N 种语言**全量打包**在 N=2 时仍是最优解（无闪烁、零风险）；待到 N≥4 再考虑按 locale 分发（`chrome.scripting.registerContentScripts` 按语言注册是唯一能保持同步注入、无闪烁的方案，代价是引入 background service worker 与 `scripting` 权限）；
- 发布一律用 `bun run pack` 产出的 zip：仓库根目录下的 `github-i18n-v<版本>.zip`（store 模式、零依赖打包）。

## 已知边界

- Shadow DOM 内文本不翻译；
- **拉丁语系目标语言**（西 / 法 / 德等）的「已翻译」判定在结构上不可靠（与源语言同字系），只能靠「译文不得等于任何键」的结构门禁防循环，且「译文必须含目标文字系统」这条校验对它无意义（`scripts: []`）；
- **复数的语法分歧**（俄语 3 种、阿拉伯语 6 种）无法表达：一个 `pattern` 只能配一个模板，没有复数类别；
- GitHub 正渐进迁移 React 重写页面，类名 / 结构变动导致的漏翻 / 误伤属常态：先修排除选择器，再修词条；
- **评论编辑器的 Markdown 工具栏文案归 `global`**：`Bold` / `Italic` / `Quote` / `Heading` / `Code` / `Link` / `Mention` / `Reference` / `Numbered list` / `Unordered list` / `Task list` / `Add a table` / `Attach files` 与附件组件的错误提示都是**站点级组件**（议题 / PR 的评论框同样渲染），且同一组件的 `Write` / `Preview` 早已在 `global`——只挂 `pages/settings` 会造成「编辑侧中文、格式化侧英文」的中英混杂。`Markdown` 是链接文本、属纯专名不收录（它与 `is supported` 是两个节点，拼接后读作「Markdown 受支持」）；
- `<relative-time>` 等自定义元素会自行重渲染英文，观察器会再翻一遍收敛，勿追求一次性翻译；
- 上游删除的文案会在 `core/canonical.jsonc` 里留下死键（不报错）：靠 popup 的开发者模式定期采集漏翻、或按页面逐个核对时顺手清理。
