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
│   │   │   └── ja/          # 同上（规则模板已全量，词条仍稀疏）
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
- 「条译文」是各语言实际给出的词条数之和（zh-CN 满覆盖 + ja 的稀疏词条），不等于规范键数；
- 「条共享规则」是 `core/rules.jsonc` 里 `id` + `pattern` 的条数（语言无关，只有一份），各语言只是给它配模板。

**2026-10-07 起 ja 的中间态：「规则已全量、词条仍稀疏」**。`locales/ja/rules.jsonc` 已按 core 补齐全部 786 条模板
（`check:view` 的 `notTranslated` 因此全空），但 `locales/ja/**` 的词条只译了一部分模块——**已译模块的权威清单在
`src/dict/registry.ts` 的 ja 段**（已列的模块名就是已翻译的，没列出的即尚未翻译），本节不重复维护这份名单。
**规则是按模块独立生效的**（缺模板才是整条不生效），所以还没译词条的模块会出现「规则覆盖到的动态节点是日语、
静态词条仍是英文」的混排——例如 `/settings/security` 的 2FA 横幅只会译出规则管的那一段。这不是缺陷，而是
「先同步规则、后补词条」的既定中间态；判断某页是否处于这种状态，看 `bun run check:dict` 的覆盖率与该页有没有词条文件，
不要看 `notTranslated`（它此时是空的）。

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
| 1 | 定模块与路由 | 该页命中哪个 `core/modules.jsonc` 模块（多半是 `pages/settings` 这类**同模块多页**，键直接追加进去，不新建模块）。**别跳过「路径真的命中」这一步**：不命中时只有 `global` 兜底，表现是「侧栏与页头整块英文、只有零散几个 global 词条是中文」——2026-10-09 的组织主题页 `/orgs/<组织>/topics` 就是一条**不在 `/settings/` 前缀下**的设置页，页面结构完全一样、路由却漏了；判断用 `matchModules(path, …)`（或给骨架门禁加一条探针）比肉眼看 URL 可靠 |
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
- 组织设置族（模块 `pages/org-settings`，`/organizations/<组织>/settings/**`）同理收进 `pages/org-settings/<页名>.test.ts`；它在 `core/modules.jsonc` 里**排在 `pages/repo-settings` 之后**，而两者的路由互斥（仓库设置的路由排除了 `organizations` / `orgs`，见该文件的注释）。**按路径归位、不按模块归位**：组织账单页的正文词条与规则其实来自 `pages/settings-billing`（它的路由有五支，见 `core/modules.jsonc`），但用例仍放 `pages/org-settings/billing.test.ts`；
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
| `repo-settings/rulesets.test.ts` | `/owner/repo/settings/rules`、`/owner/repo/settings/rules/<id>` | 规则集列表页与详情页（**证据是途径 A 导出的漏翻清单 + 两张实机截图 + 维护者贴的两段实机 HTML**（状态检查与「合并前需要拉取请求」两个规则的展开面板），2026-09-27：清单里除专名 / 用户内容外的节点、以及两段 HTML 里的全部节点都命中；本页此前**没有任何词条**，属整页新增。三条边界事实：规则名 `Protect Default Branch`、仓库名、用户名、分支名 `main` 与产品名保持英文；组合型 aria-label（`Active, Enforcement status`、`Roles, Filter actors by category`、`Squash, Allowed merge methods`）是**属性**、不走正则规则，故逐条收静态键；含动态值的文本（列表行计数、目标计数、面包屑、`Apps • <应用名>`、`Delete include of <分支模式>`）靠 6 条 `repo-settings/ruleset-*` 规则，分隔符用字符类同时覆盖 `•` 与 `·`。清单里孤立的 `changes` 来源不明，有意不收。**2026-10-07 追加**：维护者贴出 `/Koishi-CE/tools/settings/rules/new` 的**下拉展开态** HTML，补上「Require merge queue」合并方式下拉的两个禁用项 `Squash and merge` / `Rebase and merge` 与禁用说明 `Not enabled for this repository.`——它们本是 `pages/pulls` 的键，而两模块路由互斥（词条不跨模块），故在本模块各收一份同形同译，这正是「明明翻译过却漏翻」的成因。**同日又补**：`Restrict code coverage` 的规则说明被上游改写（旧句 `…When configured, uploaded coverage data must meet…`，新句多出「不等待覆盖率上传」与「把覆盖率上传的状态检查设为必需」两句）——属**语义变了**，故新增键 + 重译而**不加别名**；旧句保留（是否仍渲染未经证实），用例里两种形态都钉死） |
| `org-settings/profile.test.ts` | `/organizations/<组织>/settings/profile` | 组织资料页（**证据是途径 A 导出的漏翻清单**，2026-10-03：侧栏 49 项、设置外壳与表单标签全部命中，预览标签的 title / aria-label 同串也锁住。这一页同时是**路由排除的回归**：排除前整包仓库设置词条会注入组织设置页（实机把 `Actions` 译成「Actions 工作流」是仓库模块干的），排除后这两条由本模块自己提供、措辞保持一致。国家 / 地区下拉的名称、社交平台品牌名、产品名（Dependabot / Copilot / OIDC）与组织名都按反例断言保持英文。同日晚些时候维护者又贴了该页**下半页**（产品内消息 / Patreon / GitHub Developer Program / 服务条款 / 危险区域三个对话框）的实机 HTML，由第二组用例按标签真实嵌套登记——含被 `<strong>` 切开的 `We` + `will`、`Please type` + 组织名 + `to confirm.`、`Deleting the` + 组织名 + ` organization will delete…`，以及 `data-disable-with="Accepting terms..."` 和四组 aria-label / placeholder 属性） |
| `org-settings/policies-repositories.test.ts` | `/organizations/<组织>/settings/policies/repositories` | 组织仓库策略页（同一条途径 A 清单：页面标题 `Settings · Repository policies · Koishi-CE` 走 `org-settings/page-title` 规则，中段页面名保留英文、末段组织名原样带回；rulesets 提示是**同一句被链接拆开**的两段，拼接后读作「组织规则集将不会强制执行 直到你将此组织账户升级为 GitHub Team。」；国家 / 地区下拉按维护者拍板暂不收录。同日维护者又贴了该页**实机 HTML 与截图**，锁住空态（`You haven't created any policies` → 「你还没有创建任何策略」、`New policy` → 「新建策略」，与 pages/repo-settings 的 Actions 策略页同键同义）与被 React 拆开的「进一步了解 policies.」链接——`Learn more about` 由 global 的短键命中、剩下的片段漏翻，而 outerHTML 把相邻文本节点拼在一起输出、看不出片段含不含句点，故 `policies` / `policies.` / `Learn more about policies.` 三种形态都收） |
| `org-settings/sidebar.test.ts` | `/organizations/<组织>/settings/**`（侧栏外壳，所有子页共用） | 侧栏（**证据是维护者 2026-10-03 贴的 `Layout-sidebar` 实机 HTML**）：补 `General` / `Policies` / `Access` / `Moderation` / `Rulesets` / `Runners` / `Webhooks` / `Packages` / `Advanced Security` / `Secrets and variables` 等 25 条与五个分组标题。除 `Pages` 外全部沿用 pages/settings 与 pages/repo-settings 的**同键措辞**（改词三处必须一起改，用例逐条钉死）；`Pages` 是**对 global 的定点纠正**（global 收成「页码」，本模块在自己的路由上覆盖为「页面」），也是本模块唯一一条被骨架门禁记录的同键异译——`bun run check:view --update` 的理由就是它，将来看到这条 collisions 不必惊讶 |
| `org-settings/billing.test.ts` | `/organizations/<组织>/settings/billing` | 组织账单页（**证据是维护者 2026-10-03 贴的整页实机 HTML**）。整页是 `billing-app` 的 React 组件，文案与个人账单页**逐字相同**，此前整页英文的根因是**缺路由**（`pages/settings-billing` 原本只覆盖 `/settings/billing` 与 `/account/billing`），故同日把该模块的路由扩成三支，本页由此成为**两支路由共用一套词条与规则**的第二个例子：命中序列必须是 `pages/settings-billing` + `pages/org-settings` + `global`，账单模块在前（逐键先到先得——账单词条与规则由前者提供，组织设置侧栏由后者兜底），用例同时断言资料页**不得**命中账单模块。新补的静态词条只有两条（`Subscriptions`、`Actions and Packages storage`，两条都与既有模块同键同译）；真正的工作量在规则：「说明句 + 日期区间」在实机是**同一个文本节点**（个人账单页的漏翻导出记录的就是整句原文），`settings/usage-range-*` 那条只覆盖「区间独立成节点」的形态，故按整句另展开——同月 12 条 × 2 句，跨月只展开 January → 各月 11 条（时间范围下拉只有四个选项，能跨月的只有 This year / Last year，起点恒为 1 月；其余跨月组合整句保留英文而不会被部分替换成残句，用例有反例断言）。另把「Included usage limits reset in 29 days.」的三种可能切分都覆盖（整句 / 前缀 + 天数 / 前缀 + 数字 + 天数），并锁住 `per ` + `month` 两个碎片节点的拼接） |
| `org-settings/billing-ai-usage.test.ts` | `/organizations/<组织>/settings/billing/ai_usage` | 组织路由下的 **AI 用量页**（**证据是维护者 2026-10-07 贴的整页实机 HTML**）。同一页在两条路由（组织路由 / 个人 `/account/billing/ai_usage`）上必须**逐字一致**：组织路由没有 `pages/settings` 这一层，兜底改由 `pages/org-settings` 承担，用例对同一份节点清单同时跑两份视图并断言译文相等，另断言本路径**不得**命中 `pages/settings`（它的路由 `^/(?:settings|account/billing)` 要求路径以 `/settings` 或 `/account/billing` 开头）。补的是**新版组件族**（`AIUsageSummaryCard` / `UsageFilters`）的 12 条键与 11 条规则：分组切换器的 `Group by: Models` / `Days`、额度条的 `/ N AI credits`（两种切分）、额度卡说明句的五种切分、图表标题、两种空态、placeholder 与三处 aria-label。两条边界事实：① 说明句里的日期由 GitHub **按浏览器语言在客户端**格式化（实机是「2026年11月1日」），故这句是**混合节点**——引擎的脚本守卫只拦「整段非拉丁」的节点，混合节点照常进规则；而门禁禁止 pattern 含非拉丁字母，所以「日期已本地化」用字符类 `[^A-Za-z]+` 表达，它同时把英文日期挡在门外（英文日期时整句保留英文，宁可漏翻不做中英残句，有反例断言）；② `aria-valuetext="0 of 0 AI credits used"` **有意翻不了**——该属性不在引擎的六个可翻译属性里、属性值也不应用正则规则，动态值结构上无解，这是设计边界而不是缺词条。本页**不单列骨架探针**：命中模块、碰撞赢家与规则序列都与紧邻的 `/organizations/octocat/settings/billing` 完全相同，多一条只会把同一份快照再抄一遍；子路径的路由匹配由本文件的断言钉住 |
| `org-settings/billing-budgets.test.ts` | `/organizations/<组织>/settings/billing/budgets` | 组织路由下的**预算与提醒页**（**证据是维护者 2026-10-07 贴的实机 HTML 片段**：「所含用量提醒」的 ActionList 下拉菜单 + 表格标题的计数行）。菜单项（`ActionList.Item.Label`）与它的说明（`ActionList.Description`）各自成节点，两行菜单项只差 `on` / `off` 一个词，故分别锁住（不得互相吃掉）；计数行在两种归属下是**两种写法**——个人路由 `Account budgets`、组织路由 `Organization budgets`，归属词写死在 pattern 与模板里（模板不支持「捕获组 → 中文」映射），两条规则各认各的归属词。说明句里的 `Git LFS` / `Sandbox` 按本模块口径保持原文，`Packages` 在本模块的**句子语境**里同样保持原文（与 `Billable spend for Packages…` 一致）——单节点的 `Packages` 另有「软件包」词条，两者互不影响（整节点精确匹配）。触发下拉的按钮**标签与当前值是两个节点**：实机渲染「Included usage alerts: 开启」——不带冒号的既有键在该形态下永不命中，故补了带冒号的标签键（值节点 `On` / `Off` 由 `pages/org-settings` 与 `pages/settings` 的同键负责），用例按「标签 + 值」两节点拼接断言。同样**不单列骨架探针**，理由与本族其它子页相同 |
| `org-settings/billing-licensing.test.ts` | `/organizations/<组织>/settings/licensing` | 组织路由下的**许可页**（**证据是维护者 2026-10-07 贴的整页实机 HTML**）。它此前正文全英文的根因同样是**缺路由**，而且形态更隐蔽：路径里**没有 `billing` 段**（`/organizations/<组织>/settings/licensing`），`pages/settings-billing` 原来的三支路由一条都对不上，整页只剩 `pages/org-settings` 的侧栏词条——实机表现正是「标题『许可』是中文、正文全英文」。故把该模块的组织支扩成 `settings/(?:billing\|licensing)`：同一套 billing-app 许可组件、同一批词条与四条配额规则（`settings/licensing-*`）覆盖两条路由，而不是把二十多条键 + 四条规则复印进 `pages/org-settings`。用例按「组织侧独有 / 个人侧既有」两组分别断言，并对共享节点断言**两条路由译文逐字相等**（差异只在兜底层：个人侧是 `pages/settings`、组织侧是 `pages/org-settings`），另断言本路径**不得**命中 `pages/settings`、资料页等其它组织子页**不得**命中账单模块。补的 8 条键全是组织侧独有文案：Copilot **Business 附加项**卡（`Your AI powered pair programmer` / `Learn more about Copilot Business` / 那句 216 字符的 OpenAI 说明 / `Sign up for Copilot Business`）、GitHub Free 的组织版（`Upgrade to Team` / `The basics for organizations and developers`）与「包含 / 不包含」清单上方带冒号的小标题 `Not included:`。三条边界事实：① 「包含 / 不包含」在本页有**三个不同的串**——小标题 `Not included:`（文本节点、ASCII 冒号）、每行删除图标的 `alt="Not included"`、每行包含图标的 `alt="Included"`（本轮新收的**泛化短词**，收它的理由是整节点精确匹配 + 模块按路由限定在账单 / 许可页，实机若出现读不通的 `Included` 就删词条而不是加白名单），用例逐条钉死三者互不误吃；② 方案名不译——`Team` 与 `GitHub Copilot` / `OpenAI` 一样保持英文（与 `pages/org-settings` 的「GitHub Team」口径一致），故只译 `Upgrade to`；③ 本页**不单列骨架探针**，理由与 `billing-ai-usage` 一行相同（命中模块、碰撞赢家与规则序列都与紧邻的 `/organizations/octocat/settings/billing` 完全相同，多一条只会把同一份快照再抄一遍），子路径的路由匹配由本文件的断言钉住 |
| `org-settings/billing-payment-information.test.ts` | `/organizations/<组织>/settings/billing/payment_information` | 组织路由下的**付款信息页**（**证据是维护者 2026-10-07 贴的整页实机 HTML**）。这一页**不缺路由**：它挂在 `settings/billing` 前缀下，本轮之前表单标签与说明句就已译出（`PAYMENT_NODES`，见 `settings/billing.test.ts`），本轮补的是组织侧 HTML 新暴露的其余区块——顶部两条提示（默认 `hidden` 的 flash，含只有 aria-label 的关闭按钮）、组织账单信息关联卡、`Last payment`、附加账单信息对话框、发票区块与 Azure 按量计费区块，共 31 条键 + 1 条规则。三条边界事实：① 组织提示句在实机里是**五个文本节点**（`… by <a>signing</a> the <a>GitHub Customer Agreement</a>.`），中间那个 ` the ` 是独立冠词节点——中文没有冠词，它由**新规则** `settings/article-the`（空模板，与 `settings/per-word` 同一手法：引擎连同它的首尾空白一起清空）整个删掉；副作用是「签署」与链接文字之间少一个空格，实机渲染「…方法是 签署GitHub 客户协议.」（句末 ASCII 句点是纯符号节点，翻不了），用例把这个形态逐字锁住而不是假装它不存在；② 对话框默认 `hidden` 但仍在 DOM 里，按「隐藏节点照常翻译」收录（与 tooltip / `sr-only` 同档）；③ 国家 / 地区与州 / 省下拉的**选项名**照旧不收录（表单值，翻了会改坏提交内容），但 `选择你的国家/地区` / `选择州` / `选择省` 是**占位项**而不是国家名，早已分别由 `pages/settings-billing` 与 `pages/org-settings` 收录，用例把两者分开断言。新规则落在账单模块，故 6 条账单探针的规则序列各 +1（zh-CN）与 `notTranslated` 各 +1（ja）——这就是本轮 `check:view --update` 的全部内容（只加静态键不会动快照，加了规则才会） |
| `org-settings/billing-payment-history.test.ts` | `/organizations/<组织>/billing/history`（**不在 `/settings` 下**） | 组织付款历史页（**证据是维护者 2026-10-07 贴的整页实机 HTML**，关键特征是**整页没有任何中文**）。这是本仓库第一条靠**反推**定位的漏路由：标题 `Payment history` 是 `pages/org-settings` 的既有键、空态两句是 `pages/settings-billing` 的既有键（`HISTORY_NODES`），三条早就有译文却全是英文 ⇒ 路径里不可能带 `/settings/`（否则 `pages/org-settings` 必然命中、标题必是中文）⇒ 页面落在 `/organizations/<组织>/billing/**` 这一支上，而它此前**只有 global 命中**。该支的真实性另有两条硬证据：组织许可页的「Compare base plans」按钮 href 是 `/organizations/<组织>/billing/plans`，组织付款信息页的表单 action 指向 `/organizations/<组织>/billing/extra`。故把账单模块的路由补成**五支**（`…/(?:settings/(?:billing\|licensing)\|billing)`）。代价如实记在此处：这一支上 `pages/org-settings` 与 `pages/settings` **都不命中**，故组织侧页面的**标题类键**必须在账单模块里各来一份——本页新增的唯一词条就是 `Payment history`（同译「付款历史」，避免同一个词两副面孔），它也让骨架多出 6 条同键赢家记录（个人账单探针赢家是 `pages/settings`，组织账单探针赢家是 `pages/settings-billing`），这就是本轮 `check:view --update` 的全部内容。用例锁住「三条路由译文逐字一致」「本路径不得命中两个设置模块」「同一支的 plans / extra 也吃到账单模块」与「账单模块仍不漏进组织设置其它子页」 |
| `org-settings/billing-subscriptions.test.ts` | `/organizations/<组织>/settings/billing/subscriptions` | 组织路由下的**赞助订阅页**（**证据是维护者 2026-10-07 贴的整页实机 HTML**，页面路径由 HTML 里 `data-hydro-click` 的 `originating_url` 直接给出）。这一页**不缺路由**（挂在 `settings/billing` 前缀下），页面上半部分新出现的「账单联系人」区块才是本轮补的内容：账单管理员 / 邮件收件人两张卡 + 邀请与添加收件人对话框，共 16 条键。三条边界事实：① 说明句在页面上（`<p>`）与对话框里（`<span>`）各渲染一次、`Add` 在列表头按钮与对话框提交按钮上各出现一次、对话框标题同时是 `sr-only` 的 `<h1>` 与可见文本——**同一个键命中多处**，用例逐条钉住；② `Add billing recipient email` 只出现在属性上（按钮与输入框的 aria-label、输入框的 placeholder），`Label: Primary` 只出现在 `<span class="Label">` 的 `title` 上——属性只走词条查表、不应用规则；③ `Add` / `Update` / `Primary` / `Close dialog` 与 `pages/settings` **同键同值**：那条路由是 `^/(?:settings\|account/billing)`，**不命中 `/organizations/**`**，所以组织账单页上的按钮与标签只能由账单模块再收一份（与 `Subscriptions` / `Packages` / `Payment history` 同一回事）。这正是本轮 `check:view --update` 的**全部**内容——5 条个人账单探针各 +4 条同键赢家记录（赢家 `pages/settings`）；只加静态键不会动快照，跨模块同键同值才会。页面下半部分的赞助区块（`Sponsorships` / `Start sponsoring` 等 5 条 + 空态规则 `settings/sponsoring-none`）此前已译，用例把它当「扩展确实在这一页生效」的对照物一并锁住——没有这个对照物就无法区分「整页漏翻」与「只漏了一块」 |
| `org-settings/billing-managers.test.ts` | `/organizations/<组织>/billing_managers/new`（**不在 `/settings` 下**） | 组织**账单管理员邀请页**（**证据是维护者 2026-10-07 贴的整页实机 HTML**，页面路径由维护者直接给出）。这一页是**两支路由各管一半**的典型：正文靠 `pages/settings-billing` 组织支里 `billing` 的**前缀**命中（`billing_managers` 的前 7 个字符就是 `billing`），而它渲染的仍是那套设置外壳（`Layout-main-centered-xl` + `Billing / Add a billing manager` 面包屑 + 组织设置侧栏），侧栏词条全在 `pages/org-settings`，故同日给后者补了第三支 `…/(?:settings\|billing_managers)`——不补的话正文中文、**侧栏整块英文**（维护者贴的 HTML 只从 `Layout-main` 开始，侧栏本身看不到，故先按布局取证：`Layout-main-centered-xl` 与 `/settings/billing/*` 各页同款；同日再由维护者在实机确认侧栏已是中文，这一支收口）。补的 24 条键覆盖：标题的斜杠节点（`/ Add a billing manager` 里斜杠属于该节点，整行键永不命中）、账单管理员说明句、两组权限清单标题与 14 条清单项、邀请表单的搜索标签与提交按钮。四条必须记住的边界事实：① 说明句 `A <strong>billing manager</strong> is a user who…` 是**三个文本节点**，首节点是单个大写字母 `A`；引擎的可翻译判定是 `/[a-z]/i`（大小写不敏感），所以它能进规则——中文没有冠词，留着它就是「A 账单管理员 是…」的中英残句，故新规则 `settings/article-a` 把它译成量词「一位」（沿用 `settings/article-the` 的手法，但这里是**翻译**而不是清空），实机拼作「一位 账单管理员 是管理你组织账单设置的用户。」；② 两组清单标题被 `<strong>` 切成三段，尾句是**两个不同的键**（`have the ability to:` / `be able to:`），中间片段 `will` / `will not` 各自独立，四段缺一即整句退回英文；③ `will` 与 `Search by username, full name or email address` 是**跨模块同键同值**（前者 pages/org-settings 已有，后者 pages/settings 已有，两条路由都不命中组织根路径），故在本模块各收一份，骨架因此多出 6 条同键赢家记录——与上一批 `Add` / `Update` / `Primary` / `Close dialog` 同一回事；④ 结果列表的 aria-label `results` **有意不收录**：既有两处收录的译文互不相同（pages/settings「结果」/ pages/repo-settings「个结果」），证明它按上下文取值，且它不可见 |
| `org-settings/org-roles.test.ts` | `/organizations/<组织>/settings/org_roles` | 组织**角色管理页**（**证据是维护者 2026-10-07 贴的整页实机 HTML**）。这一页**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`，`pages/repo-settings` 被自身路由里的 `organizations` 排除），缺的是整页词条：129 条新键覆盖页首说明段、九张角色卡片的标题与说明句、卡片上两个 tooltip、角色详情面板的表头与基础角色标签、五个分组标题与 96 条权限清单项。四条边界事实：① 页首说明段是**单个文本节点**（两句话之间只有换行缩进、没有行内标签），整段一个键，按句拆成两条会双双永不命中；② 权限清单每条是 `<span>• Assign or remove a user</span>`——**项目符号在文本节点内部**（`• ` 前缀），裸短语永不命中，译文原样保留 `• `（与 `insights-security.test.ts` 的 `Security policy •` 是同一类坑，只是符号在头部）；③ 两个 tooltip（`Show role permissions` / `Hide role permissions`）是 `<tool-tip>` 里的独立文本节点（`sr-only` 照常翻译），不是属性；④ 基础角色五个标签里有两条不同的来路——`Read` / `Triage` / `Maintain` / `Admin` 在 `pages/repo-settings` 里早有同键译文，但那条路由与本页互斥、拿不到，故在本模块各收一份并**逐字同译**；`Write` 则是 global 早就收过（「编写」），而**权限级别**语境按 `pages/repo-settings` 的先例应是「写入」，故本模块显式覆盖它——这正是本轮 `check:view --update` 的**全部**内容（3 条组织设置探针各 +1 条同键赢家记录，赢家 `pages/org-settings`；只加静态键不会动快照，跨模块同键异值才会），用例另用仓库页视图断言 global 那条仍是「编写」，把「覆盖」与「改词」两件事分开。刻意**不收录**：`CI/CD`（纯英文缩写，译文只能与键同形，`validateNoIdentity` 会直接报错）、九个 SVG 的 `aria-label`（`Repository icon` / `Organization icon` / `all_repo_read icon` …：装饰性图标标签，屏显不可见，其中 `all_repo_read icon` 还是代码风格的标识串，而 `Repository icon` / `Organization icon` 是全站通用泛化短串——全仓至今只收过 `Package icon` / `GitHub Mobile icon` 两条产品专属的，此处不扩大收录面） |
| `org-settings/org-role-assignments.test.ts` | `/organizations/<组织>/settings/org_role_assignments` 与其 `new` 子页 | 组织**角色分配页**（列表空态 + 新建页；**证据是维护者 2026-10-07 贴的两段整页实机 HTML**）。这一页也**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`），缺的是词条：18 条新键覆盖空态说明句与主按钮、新建页说明段与链接、表单标签与「选择用户或团队」按钮、单选组标题与九张角色卡的 tooltip，外加一条动态条数规则 `org-settings/roles-count`（`^(\d+) roles?$` ⇒ `$1 个角色`，`9 roles` 的条数随组织有没有 enterprise 专属角色而变，故不能收静态键）。五条边界事实（2026-10-07 由维护者在实机 console 里 dump `childNodes` 实证）：① 空态说明句 `Organization roles have not been assigned to any users or teams.` 是**四个相邻文本节点**（`Organization` 已由本模块既有键译作「组织」+ ` roles have not been assigned to any `（**首尾各带一个空格**）+ `users or teams` + 独立句号 `.`），故本模块收的是**两段碎片键**；② 空态标题 `No organization roles assigned` 是**三个相邻文本节点**（`No ` + `organization` + ` roles assigned`），同样只能按碎片收——**这两句的整句键在实机永不命中**（用例把这两条反例都钉住了），碎片键一律按本义译，好让上游在别处复用同一碎片时仍然正确；③ 每个节点的首尾空白由 walker 保留（`applyTextNode` 的 lead / trail），实机因此拼作「组织 角色尚未指派给任何 用户或团队.」与「没有 组织 角色已指派」——这些空格都是既成事实，与 policies 页「组织规则集将不会强制执行 直到…」同源，改词条解决不了；④ 新建页说明段是**三个文本节点**（正文整句带尾随空格 + 链接文本 + 独立句号节点），`.` 不含拉丁字母、可翻译判定直接跳过，故中文后面仍跟着半角 `.`；⑤ 九张角色卡的 tooltip 是 `Info about <角色名>`（`popover` + `aria-hidden` 的独立文本节点，hover 时可见），角色名在这里是上游动态值、规则无法把它映射成中文，故九条逐条收成静态键、译文内嵌中文角色名；两条 enterprise 专属角色（`Enterprise Security Manager` / `Enterprise Open-Source License Manager`）本页没有渲染、角色名本身也未收录，故一并留空。这一轮给 `pages/org-settings` 添了**第一条非标题类规则**，故 `check:view --update` 的产物是 3 条组织设置探针的 `rules` 数组各 +1 条 id（跨模块同键的 `collisions` 没有变化） |
| `org-settings/repository-roles.test.ts` | `/organizations/<组织>/settings/roles` | 组织**仓库角色页**（**证据是维护者 2026-10-07 贴的整页实机 HTML**）。这一页也**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`），缺的是词条：预定义角色区块（标题、`You can …` 那句的链接）、五个预定义角色的说明句与管理员行尾的链接、页尾 Enterprise 升级横幅，共 14 条键。三条边界事实：① 本页是**服务端渲染的传统 Primer 页面**（`Subhead` + Octicon SVG），与 React 重写的空态不同——长句里没有插值项时就是一个整文本节点，故说明句按**整节点**收（`Pre-defined roles`、五条角色说明、横幅标题与说明句都是单节点，用例另用 `Create custom roles with` 作反例钉住「不得顺手收碎片键」）；② 唯一的例外是 `You can set the base role for this organization from one of these roles.`——句中的 `<a>set the base role</a>` 把句子切成**三个节点**（文本 / 链接 / 文本），整句键永不命中，用例把这条反例也钉住；③ 横幅（`react-partial`，客户端渲染）的同一批文案在被排除清单挡住的 `script[type="application/json"]` 里另有一份，整段 JSON 一起被跳过、不会被翻坏，可见文本走本模块的键（`Learn more` 由 global 的短键命中，`Create custom roles with GitHub Enterprise` 等三条与 pages/repo-settings 逐字同译）。采集时扩展仍在运行，页面上已是中文的节点（`Repository roles` 标题、五个角色名、`Learn more`）是既有键的产物 |
| `org-settings/member-privileges.test.ts` | `/organizations/<组织>/settings/member_privileges` | 组织**成员权限页**（**证据是维护者 2026-10-07 贴的整页实机 HTML**）。这一页不缺路由，缺的是整页词条：十个区块（基础权限 / 仓库创建 / 仓库复刻 / 仓库讨论 / 项目基础权限 / 页面创建 / 应用访问请求 / GitHub 应用 / 管理员仓库权限 / 成员团队权限）共 76 条键 + 2 条规则。四条边界事实：① 本页同样是**服务端渲染的传统 Primer 页面**（`Subhead` + `ActionList` + `<dialog>`），长句没有内联元素时就是一个整文本节点，故说明句按整节点收；② 仓库删除那句被 `<strong>public</strong>` / `<strong>private</strong>` 切成**五个节点**（首段 / `public` / `and` / `private` / 尾段），中间三个片段是**小写泛化词**——收它们的唯一理由是模块按路由限定在组织设置页（同 `settings` 的先例），实机若出现读不通的 `public` / `private` 就删词条而不是加白名单，用例另断言大写标签 `Public` / `Private` 仍由 global 负责、两者互不误吃；③ 说明句里的链接各自成节点，议题删除那句的链接后面还有**独立句号节点**（纯符号，翻不了）；④ 基础权限确认对话框的正文含两个动态计数（`2 members` / `5 repositories`）：上游 ERB 插值时数字各自成节点、引擎对纯数字节点直接跳过，故「常量句首 `This may change the permission that the organization’s` + 常量中段 `members have on its` + 常量句尾 `repositories.`」三段碎片键覆盖这一形态，而上游万一把它渲染成**整句一个节点**时由规则 `org-settings/base-permission-change` 兜住——两种切分都有用例钉死（采集时扩展仍在运行，页面上已是中文的 `成员权限` / 五个角色名 / `公开` / `私有` / `保存` / `关闭` / `GitHub 应用` 都是既有键的产物）。另一条动态值在仓库讨论的说明句里：组织名 `Koishi-CE’s` 走规则 `org-settings/discussion-creation-org`，撇号直弯都覆盖 |
| `org-settings/import-export.test.ts` | `/organizations/<组织>/settings/import-export` 与其 `attribution-invitations` 子页 | 组织**导入/导出页**（模特页 + 归属邀请页，**证据是维护者 2026-10-07 贴的两页整页实机 HTML**）。两页都**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`），缺的是词条：页签与表格表头、搜索框、表头 tooltip、两个空态标题、归属邀请页的说明段，共 9 条键、**没有新规则**（这一族两页都不含动态值，故 `check:view` 快照不动，也不单列骨架探针——命中模块与规则序列都与紧邻的 `/organizations/octocat/settings/profile` 完全相同）。四条边界事实：① 两页同样是**服务端渲染的传统 Primer 页面**（`Subhead` + `UnderlineNav` + `blankslate`），长句里没有内联元素时就是一个整文本节点，故 tooltip 与说明段都按整节点收（用例用「按句拆开」的三种 / 两种形态作反例钉住「不得顺手收碎片键」）；② 搜索框的 **placeholder 与 aria-label 不是同一个串**（前者末尾多三个点），属性只走精确命中，故两条各自登记；`Mannequins` 一条键同时覆盖页签与表格表头；③ 长句的节点长度要盯住引擎的 500 字符上限——归属邀请页那句约 355 字符，仍在阈值内（超了会被 `isTranslatableText` 当代码 / 用户内容跳过，表现为「词条在但页面不动」）；④ `Mannequins` 沿用 GitHub 官方中文文档的译法（docs.github.com/zh 的「模特和用户活动」把 mannequin 译作「模特」），本页补「账号」二字避免与「时装模特」混淆；说明段里的三个状态值（`invited` / `completed` / `rejected`）按 `pages/repo-settings` 译状态值的先例译成中文，其中「已完成」与 global 的 `Completed` 同译（用例把这条一致性也钉住）。采集时扩展仍在运行，页面上已是中文的两个 `Import/Export` 标题是既有键的产物 |
| `org-settings/blocked-users.test.ts` | `/organizations/<组织>/settings/blocked_users` | 组织**已屏蔽用户页**（**证据是维护者 2026-10-07 贴的整页实机 HTML**）。这一页是**一页两种渲染形态**：服务端渲染的传统 Primer 页面（说明句 + 添加屏蔽的卡片）+ 页尾一个 React partial（`blocked-users-table`：`Currently blocked` / 搜索框 / 空态）。它不缺路由，缺的是词条——23 条新键 + **4 条新规则**。三条边界事实：① 本批绝大多数串在 `pages/settings`（个人设置的 `/settings/blocked_users`）里**早就有词条**，但那条路由 `^/(?:settings|account/billing)` 不命中 `/organizations/**`，故本模块**逐字同译**各收一份，用例对 16 条同名节点断言「两份视图译文逐字相等」——这正是「明明翻译过却漏翻」的成因（同 `Subscriptions` / `Payment history` 的先例）；② 两页只有两处文案差异：备注说明的结尾（本页「所有组织管理员和版主都能看到此备注」vs 个人页「此备注仅你自己可见」）与组织侧**独有**的屏蔽时长菜单（`Block:` + `For 1 day` … `Until I unblock them`，按钮标签是两个节点），用例把「个人页那句在本页不命中」反面钉住；③ 三条动态值各有各的来路——备注框的剩余字数（`250 characters remaining.` 带句点走本模块新规则，而**不带句点**的形态是 global 的 `global/status-characters-remaining`，两条 pattern 互不覆盖、措辞不同）、屏蔽确认句里由 JS 按 `data-text-template` 填进去的用户名（静态节点走词条、填好后走规则）、以及 `data-dynamic-label` 可能把时长菜单重组成**单个节点**时的两种形态（`Block: For N day(s)` 用一条规则覆盖四档，数字是语言无关的捕获组，不留中英残句）。有意不收录：列表的 aria-label `results`（既有两处译文互不相同、屏显不可见，同 `billing-managers` 的判定）。快照变化：3 条组织设置探针各 +4 条规则 id（zh-CN 与 ja 同），外加 `Search by username, full name or email address` 在组织账单探针上成为跨模块同键（`pages/settings-billing` 胜出，两处同译） |
| `org-settings/interaction-limits.test.ts` | `/organizations/<组织>/settings/interaction_limits` | 组织**临时交互限制页**（**证据是维护者 2026-10-09 贴的整页实机 HTML**）。它**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`），缺的是整页词条：页首三段说明、三档限制对象与五个状态标签、三张卡片的按钮与五档时长，以及同一页 turbo-frame 里的拉取请求上限，共 36 条键 + **1 条新规则**。三条边界事实：① 正文与个人设置的 `/settings/interaction_limits` **几乎逐字相同**，而那条路由 `^/(?:settings|account/billing)` 不命中 `/organizations/**`，故本模块各收一份并**逐字同译**（`New users` / `Users` / `Contributors` / `Collaborators` / `Enable` / 五档时长 / 三段「已有限制」提示都属这一类），组织侧独有的三处措辞是新键而不是别名；② 页首说明的两句**同属一个文本节点**（原文之间只有空行），故整段一条键——个人页那条只覆盖第一句，两条不同的键不得互相顶替（用例反向钉住）；③ 「当前上限」那句被 `<strong>数字</strong>` 切成**三段**，数字由输入框决定（1–1000），故数字之后的整句走新规则 `org-settings/pr-cap-limit`，`pull request(s)` 的单复数用 `s?` 一条覆盖——**仓库级子页（`repo-settings/interaction-limits.test.ts`）那一页只有单数静态键**，同样的复数缺口如实记在此处，待实机复测后决定是否也给那边补规则；页首 H2 **没有出现在贴出的 HTML 里**（另两页的 H2 都在），本模块既有键 `Interaction limits` 只覆盖「H2 与侧栏项同串」那种形态，故另收一条 `Temporary interaction limits` 兜底，实机确认是哪一个之后删掉多余的那条。快照变化：3 条组织设置探针各 +1 条规则 id（zh-CN 与 ja 同；跨模块同键的 `collisions` 无变化） |
| `org-settings/code-review-limits.test.ts` | `/organizations/<组织>/settings/code_review_limits` | 组织**代码审查限制页**（**证据是维护者 2026-10-09 贴的整页实机 HTML**）。同上一页的处境：挂在 `settings` 前缀下、**不缺路由**，缺的是词条；正文与个人设置的 `/settings/code_review_limits` 几乎逐字相同而那条路由拿不到，故本模块各收一份并**逐字同译**（5 条键里只有页首那句是组织侧独有措辞 `in public repositories within this organization`，是新键）。三条边界事实：① 两段长说明在实机都是**含源码换行的单个节点**，键按 `normalizeKey` 折叠空白后才等于词典键（用例把带内部换行的原始形态也钉住）；② 页首 `<h2>代码审查限制</h2>` 是**侧栏键**的产物（H2 与侧栏项同串），不是本批新键；③ 仓库级子页的 `this repository` 单数措辞与账户级的 `your public repositories` 复数措辞在本页**都不命中**（两条反例断言）。**没有新规则**，故快照不动，也不单列骨架探针（命中模块与规则序列都与紧邻的 `/organizations/octocat/settings/profile` 完全相同） |
| `org-settings/moderators.test.ts` | `/organizations/<组织>/settings/moderators` | 组织**版主页**（**证据是维护者 2026-10-09 贴的整页实机 HTML**）。它**不缺路由**，也**没有个人设置的对应页**（版主是组织专有概念），故 6 条键全是新增：说明段（两句之间只有源码换行，整段一个文本节点）、`You may add up to` + `members or teams as moderators.` 两条碎片键（中间的数字是独立节点，引擎跳过纯数字节点）、输入框的 aria-label 与 placeholder（**两个不同的串**，属性只走精确命中）、空态句。页首 `<h2>版主</h2>` 是侧栏键的产物。有意不收录：结果列表的 aria-label `results`（既有两处收录的译文互不相同、屏显不可见，同 `billing-managers` 与已屏蔽用户页的判定）。**没有新规则**，故快照不动 |
| `org-settings/repository-defaults.test.ts` | `/organizations/<组织>/settings/repository-defaults` | 组织**仓库默认设置页**（**证据是维护者 2026-10-09 贴的整页实机 HTML**）。它**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`），缺的是整页词条：44 条键 + **1 条新规则**。五条边界事实：① 前两个区块（Repository default branch / Commit comments）与**个人设置页 `/settings/repositories`**（键在 `pages/settings`，证据是整页截图）几乎逐字相同，而那条路由 `^/(?:settings\|account/billing)` 不命中 `/organizations/**`，故本模块各收一份并**逐字同译**（组织侧独有的两处措辞 `for new repositories in this organization` / `for repositories in this organization` 是新键而非别名，用例反向钉住）；② 后三个区块（Commit signoff / Releases / Repository labels）是组织侧独有的新区块、整块新增，其中 Commit signoff 的说明段被两个链接切成五段（`. ` 与收尾的 `.` 两个节点不含拉丁字母、引擎跳过，故中文后面仍跟着半角句点，与仓库级设置页同源），DCO 沿用 `pages/repo-settings` 的「开发者原创证书（DCO）」；③ 标签表单输入框下方的剩余字数由 `data-suffix="remaining"` 拼成 `50 remaining`，走新规则 `org-settings/remaining-count`——它与屏蔽用户页那条带句点的 `^(\d+) characters? remaining\.$`、以及 global 那条 `^(\d+) characters? remaining$` 是三条互不覆盖的 pattern（用例三条都断言）；④ 列表标题的计数行是「数字」与 `labels` 两个节点（数字节点被引擎跳过），单数形态 `label` 也收（上游按 `data-singular-string` 换词），译文带量词以拼出「15 个标签」——两个小写泛化词收下的理由与风险如实写在 canonical 注释里；⑤ 有意**不收录**：16 个色板按钮的 `aria-label="Color #b60205"` 一类（属性不适用规则 + 带数据值 + 屏显不可见，同 `results` 的判定）、`data-confirm` 等 `data-*`、输入框 value 与标签行里的用户内容。快照变化：3 条组织设置探针各 +1 条规则 id（zh-CN 与 ja 同），外加 `Update` 在组织账单探针上成为跨模块同键（`pages/settings-billing` 胜出，两处同译「更新」） |
| `org-settings/topics.test.ts` | `/orgs/<组织>/topics` | 组织**主题页**（**证据是维护者 2026-10-09 贴的整页截图**）。这一页本身文案极少（页头标题 + 四行仓库 + 话题标签），它的价值在于**暴露了一条路由缺口**：路径不在 `/settings/` 前缀下，此前没有任何模块覆盖它，只有 global 兜底 ⇒ 页头的上下文切换器与**整个组织设置侧栏**保留英文，而 global 的既有键（`主题` / `代码空间` / `讨论区` / `页码` / `预览` / `公开`）是中文——这正是维护者报的「点开此页面翻译会退化」。修法是把它并进 `pages/org-settings` 的**第四支路由**（前一支是同样在组织根上的 `billing_managers`），并给骨架门禁补一条探针 `/orgs/octocat/topics`。顺带两条：① 截图里的 `页码` 是 global 的译法，即「本页此前只吃 global 兜底」的铁证，补上路由后由本模块纠正为「页面」；② 页头标题 `Koishi-CE repositories you contribute to`（组织名是动态值）的**两种切分都覆盖**——词条兜「组织名是独立节点、只剩半句」的碎片形态，新规则 `org-settings/topics-heading` 兜「整句一个文本节点」的形态（同 `base-permission-change` 的做法），规则整串锚定故不会误伤同页的仓库描述。话题标签与仓库名是用户内容，用例用反例钉住；页面其余部分（空的话题输入框、`公开` 徽章）没有可翻的静态文案。快照变化：新增一条探针（命中序列 `pages/org-settings` + `global`），3 条既有组织设置探针各 +1 条规则 id |
| `org-settings/rulesets.test.ts` | `/organizations/<组织>/settings/rules` | 组织**规则集页**的空态（**证据是维护者 2026-10-10 贴的实机 outerHTML**）。它**不缺路由**（挂在 `settings` 前缀下），缺的是整块文案——HTML 里的 `<react-app app-name="repos-rules">` 说明它与仓库级 `/owner/repo/settings/rules` 是**同一个 React 应用**、连 payload 字段都相同，而 `pages/repo-settings` 的路由排除了 `organizations`/`orgs`，故 6 条文案在本模块各收一份并**逐字同译**（同 `Repository default branch` 的先例），用例对同串节点断言两份视图译文逐字相等。三条边界事实：① H1 与空态 H2 各是一个文本节点，H2 用的是 payload 的 `headingText`（`upsellHeaderText` 那句 `Protect your most important branches` 本页**没渲染**，故有意不登记，用例反例钉住）；② 说明段是单个节点（`Define` 与 payload 的 `upsellInfoMessage` 被 React 合成同一段）；③ 文档链接在实机渲染成「进一步了解 rulesets.」——React 把它拆成 `Learn more about`（global 短键）+ `rulesets.`（本批真正补的碎片），整句键兜上游改回单节点。另收 `New ruleset` 按钮与 payload `targetDefinitions.*.createButtonText` 给的三条下拉候选（`New push ruleset` 是仓库级那批没收过的一条，实机若只渲染两条就删）；维护者随后贴出的**下拉菜单项** HTML 又补上末项 `Import a ruleset` + `Choose a JSON file to upload`（`ActionList` 的 Item.Label / Item.Description 两个节点，逐字沿用仓库级译法）——实机里那一项当时是**唯一**还是英文的，反过来证明前面三条 `New … ruleset` 确实渲染且已生效。同一段 HTML 里 `Organization rulesets won't be enforced` 已是中文（policies/repositories 那批的产物），正好当对照物。**没有新规则**，故快照不动、也不单列骨架探针 |
| `org-settings/ruleset-insights.test.ts` | `/organizations/<组织>/settings/rules/insights` | 组织**规则集洞察页**的空态（**证据是维护者 2026-10-10 贴的实机 outerHTML**，紧接前两页、同一款 `repos-rules` React 应用）。四条仍是英文 + 三条与仓库级同译：H1 `Repository ruleset insights`（**单数** `ruleset`，是**新串**，与侧栏项 `Ruleset insights` 不是同串）、空态大标题的前半句 `See how rulesets are affecting this`、`Enterprise accounts enable you to review…`、`Try GitHub Enterprise`。三条边界事实：① 大标题被 React 拆成「前半句 + 名词」两个节点，名词由 payload 的 `sourceType` 决定（组织页 `organization` → 本模块既有的小写词条「组织」；仓库页 `repository`），拼接后带一个原文自带的空格，读作「查看规则集如何影响此 组织」；② 页面底部的 `Learn more` 由 global 覆盖（贴出的 HTML 里已是「了解更多」），正好当「扩展在本页生效」的对照物；③ `repository` 在本模块**没有**键（用例反例钉住），它只属于仓库级那条路径。**没有新规则**，故快照不动 |
| `org-settings/ruleset-dashboard.test.ts` | `/organizations/<组织>/settings/rules/dashboard` | 组织**规则集仪表盘页**（**证据是维护者 2026-10-10 贴的实机 outerHTML**）。这一页与前两页**不是同一款 React 应用**（`<react-app app-name="rule-insights-dashboard">`，规则集页 / 洞察页是 `repos-rules`），故页头、筛选框、指标卡、两张图表与表格共 27 条键**全是新串**，没有仓库级同串可对；缺的还有 **7 条新规则**。四条边界事实：① 页面上已是中文的 `仓库`（`Repository` 命中既有键）与搜索按钮的 tooltip「搜索」是「扩展在本页生效」的对照物，其余英文即本批清单；② 两张图表是 Highcharts——**可见**的轴标题与图例是文本节点（`Values` / `Actor` / `Number of bypasses` / `Passes` / `Failures` / `Bypasses`），**屏显不可见**的无障碍描述（clipped 的读屏区与 SVG 的 `<desc>`）是动态文本，只能靠规则接住；这 7 条规则与 `pages/insights` 的同款规则**逐字同译**（同款 Highcharts，读屏文案不能一个模块一个说法），用例把两模块的译文钉成相等——而那条路由不命中组织路径，这正是「同款文案必须各收一份」的又一例（`Search or filter` 同理：它在 `pages/agents` 里早有同译键）；③ 轴名（`Values` / `Actor` / `Number of bypasses`）写死在模板里——规则替换**不递归翻译捕获内容**，轴名靠捕获组带不出来（同 `insights/chart-y-axis-contributions` 把 `Contributions` 写死的先例）；④ 有意**不收录**：拼了动态系列名的属性（`Rule Suites. Interactive chart.`、`Show Passes`、`Toggle series visibility, Chart`、数据点 aria-label `Saturday, Oct 3, 2026, 0. Passes.`——属性只走整串精确命中、且不走规则）、纯日期（`2026-10-03`）与纯数字节点（守卫按设计跳过）、仓库名与组织名（用户内容）。快照变化：4 条组织设置探针各 +7 条规则 id；ja 的 `notTranslated` 只 +5，因为 `org-settings/chart-bar` / `org-settings/highcharts-credit` 的 pattern 与 insights 那两条同形、被后者的 ja 模板遮住（门禁按 **pattern 源串**判重，见 AGENTS.md 的已知坑）。维护者随后贴出的**筛选联想菜单** HTML 又补 4 条键：两项可见文本 `Creation date` / `Evaluate status`、列表自身的 aria-label `Suggestions`（issues / settings-billing / agents 里早有同译键，那三条路由都不命中本页），以及**静态**的组合型 aria-label `Creation date, Filter, Creation date`（先例：`Active, Enforcement status`，分隔符按中文写成全角逗号）；同批的两条反例也钉住了：第二项的 `Evaluate status, Filter, Evaluate status: active | evaluate | all` 尾段是「冒号 + 竖线连接的一组值」，只采到一个样本、看着随筛选值变化，故**不收**（属性又不走规则），以及筛选框里已生效的查询串 `created:>@today-1w` / `evaluate-status:active`——那是 GitHub 自己的筛选语法，翻了用户就看不懂自己在筛什么。**没有新规则**，快照不动 |
| `org-settings/custom-properties.test.ts` | `/organizations/<组织>/settings/custom-properties`（含 `custom-property` 新建页） | 组织**自定义属性页**（**证据是维护者 2026-10-10 贴的实机 outerHTML**，`app-name="custom-properties"`）。这一页**不缺路由**、外壳词条也齐全，缺的是本页专属的 32 条键：页头（H1 / `New property` 按钮 / 副标题）、页签栏（sr-only 的 `Page selector navigation` + `Properties` / `Set values`）、筛选框（`Filter properties` 与 nav 的 `Page selector`）、空态区块（`Suggested custom properties` / `See more` / 建议卡）、「Set values」分支的仓库列表与表单（`Search repositories` / `No properties` / `Edit properties` / `No properties that match`）。四条边界事实：① 这次贴出的 HTML 自带**四条对照物**——`搜索或筛选`、`建议`、`搜索`、`更多` 已是中文，其中前两条正是同一天前两批刚收的键，等于实机确认它们在这条路径上生效（本仓第一次拿到「新键已被实机证实」的直接证据）；② 溢出按钮是**半中半英**的收尾实例：上游渲染 `<span>More<span class="InternalVisuallyHidden"> items</span></span>`，前一段由 global 的 `More` 译作「更多」，后一段 ` items` 是独立文本节点——**有意不补**，因为 `items` 是泛化短词，而本模块的**组织账单页**上另有一个裸 `items` 节点、早已被 `billing.test.ts` 列为「必须保持英文」的反例（词条与规则都是**模块级**的，无法只对溢出按钮生效），于是读屏文案留成「更多 items」（该 span 是 sr-only，视觉上只显示「更多」）——这条「想收也收不了」的边界由用例正面钉住；③ 三张建议卡的**属性名**（`monorepo` / `databases` / `application_name`）是标识符 / JSON 键，**有意不收录**（用例反例钉住），三张卡的**描述句**是 UI 文案、正常收录；纯数字计数与可见性隐藏的 `\u00a0(0)` 由守卫跳过；④ 采集事实：本页 payload 的 `title` 就是**完整文档标题** `Settings · Custom properties · Koishi-CE`，中段是页面名——`org-settings/page-title` 的模板不递归，故中段仍留英文（与 policies / insights 页同一边界；要中文化得给具体页名各加一条窄规则）。同日的**复测截图**又带出两条事实：⑤ 空态那三张建议卡是**上游轮换取样**的——截图里是 `compliance_frameworks` / `monorepo` / `ci`，与 HTML 里的 `monorepo` / `databases` / `application_name` 不是同一组，故卡片**描述句只能见过一条收一条**（至今十七条，能对上属性名的有十二个：monorepo / databases / application_name / compliance_frameworks / ci / backup_required / uses_external_packages / branch_protection_level / active / contains_pii / deploys_to_production / data_retention_period / open_source，另五条只给了描述句；属性名始终是标识符、不收录），将来漏翻的直接表现就是某张卡的描述仍是英文——**这也是本页唯一需要反复补的地方：每次刷新都随机取三张，只能靠维护者多点几次「查看更多」或反复刷新把池子耗干**；⑥ 同日随后贴的 `?tab=set-values` **整段 HTML** 把该分支补齐：仓库列表筛选框 `Search repositories`、空态标题 `No properties that match`、行内 `No properties` + 铅笔按钮的 tooltip `Edit properties`（同串也是可访问名，一条键覆盖 tooltip 文本 / title / aria-label 三种形态），以及该页**唯一一条动态文案**——页头 H1 与面包屑末项都是 `Set properties on <仓库名>`，故新增本模块的第 12 条规则 `org-settings/set-properties-on`（捕获组限定仓库名字符集并整串锚定，防误伤以这半句开头的长句；这是本批唯一需要 `check:view --update` 的改动，3 条组织设置探针各 +1 条规则 id）。**没有新规则**，快照不动 |
| `repo.test.ts` | `/owner/repo` 及子页 | 仓库页（导航、文件列表、README 与 README.md 的区分；侧栏星标 / 关注 / 复刻三个计数走 `repo/*-count` 规则，数字随仓库变化，另收 `4.1k` / `1,234` 这类缩写形态） |
| `profile.test.ts` | `/<用户名>?tab=repositories` | 个人 / 组织主页的仓库列表（Type 下拉九项按**整节点相等**断言；结果摘要行是五个节点——`5` / `results for` / `source` / `repositories sorted by` / `last updated`，加粗的三段各被 `<strong>` 单独包住，靠三条 `profile/repo-results-*` 规则 + `results for` / `last updated` 两条片段词条拼装，整句渲染成「5 个结果， 来源 仓库， 按上次更新排序」（量词只跟数字、连接词落在宾语之后，见「四、采集结果怎么读」第 6 条；筛选值 `source` 按维护者拍板收成词条，代价见第 5 条例外）；`Clear filter` 与 Type 菜单里上游未本地化的 `Can be sponsored` / `Templates` 一并锁住） |
| `issues.test.ts` | `/owner/repo/issues` | 议题列表页 |
| `pulls.test.ts` | `/owner/repo/pulls` | 拉取请求列表页 |
| `insights-security.test.ts` | `/owner/repo/security` | 仓库安全概览页（**证据是维护者 2026-09-27 贴的实机 HTML**：顶部 Scorecard / Code scanning 横幅被 `<a>status page</a>` 切成三段；七个功能行的标题与状态是两个节点，但**项目符号 `•` 落在标题节点内部**，故带 ` •` 的形态由本模块各收一条——裸标题 `Security policy` 仍由 pages/repo 提供，两条各自独立；`View alerts` 这类短链接在源码里带 16 空格缩进，键按 normalizeKey 折叠空白） |
| `global.test.ts` | 任意路径 | 全站外壳、动态时间文本与仓库可见性标签（`Public` / `Private` / `Public template` / `Private template` / `Public archive` / `Archived`——标签是独立节点、「可见性 + 类型」固定短语，故整族归 global，仓库页与个人主页共用；`Public template` 的证据是维护者 2026-10-02 在 `?tab=repositories` 贴的 `Label Label--secondary` 片段） |

除上表外的用例都不再是「实机节点」而是纯逻辑回归：`src/content/__tests__/pages.test.ts`（视图单槽缓存：缓存键写错会表现为「换页后一半英文」）、`src/shared/__tests__/storage.test.ts`（storage 脏数据收窄与开关 / 语言监听）、`src/dict/__tests__/locales.test.ts`（`resolveLocale` 对 `zh-Hans-CN` / `zh_TW` / `en-US` 的归属），另有门禁自身与构建脚本的测试（`tooling/checks/__tests__/`、`tooling/pipeline/build.test.ts`）。

新增的进程内测试补齐了四个**此前从未被任何测试加载**的模块：`src/content/__tests__/engine.test.ts`（观察器调度）、`src/content/__tests__/index.test.ts`（content 入口装配）、`src/popup/__tests__/popup.test.ts`（popup 全交互）、`src/shared/__tests__/identity.test.ts`（身份标记契约）。凡是需要 DOM 语义的用例（walker / engine / index / popup / collector）**一律从 `src/test-support/dom.ts` 取环境**——devDependency `happy-dom`，**手写 DOM 桩已全部退役**。

`bun test` 的 `globalThis` 与模块注册表**跨测试文件共享**，四条硬约束违反任一条都会让**别的文件**的用例成片变红（2026-10-03 逐一踩过，第四条是 2026-10-07 补的）：

1. **不要用 `mock.module`**：它是进程级注册，会泄漏给同一进程里的其他测试文件（实测：入口测试 mock 掉 `collector` / `pages` 后，walker 与全部页面测试找不到真实导出）；
2. **全局桩一律合并挂载**（`obj["k"] = v`），**禁止整体替换** `globalThis.chrome` / `document`——整体替换会删掉别的测试文件刚装好的命名空间（实测：入口测试的 chrome 桩只有 `i18n`，把 storage 测试的 `chrome.storage` 打掉，12 个用例失败）；
3. **DOM 只有一份来源**（`src/test-support/dom.ts`）：`walker.ts` 用 `root instanceof Element` 判根节点类型，而 `instanceof` 比的是**类身份**——两个文件各造一个窗口，后装的那份会让先装的那份的节点不再 `instanceof Element`（2026-10-03 用两份内联桩实际踩到，成片用例变红）。该文件同时负责在用例文件收尾 `restore()`：bun 是**按文件**「加载 → 跑 → 下一个」（实测），还原后下一个文件拿到的仍是它自己期望的全局。它自身的行为（嵌套安装的还原、观察留痕、事件钩子留痕且照常派发）由 `src/test-support/dom.test.ts` 钉住（与被测模块平级，遵守「测试与源码同目录」）。

4. **模块单例状态也算共享状态，且「谁改谁收尾」**：`src/content/collector.ts` 的 `enabled` 与漏翻缓冲是模块级的，而 `src/content/__tests__/index.test.ts` 跑的是**真实入口**——bootstrap 会按 storage 把开关打开（`enabled=true`，devMode 再装上自动落盘），翻译过程中的漏翻留在缓冲里。它此前收尾只 `restore()` 了 DOM，单例状态一直漏给后面的文件，于是 `collector.test.ts` 的「starts disabled」与「records text and attribute misses under the current path」**随文件发现顺序红绿**：本机 Windows 按目录字母序把 `collector` 排在 `index` 之前（一直绿），CI 的 Linux `readdir` 顺序正好相反（2026-10-02 起 CI 一直红，两条用例分别是 `Expected: false / Received: true` 与多出 4 条 `/microsoft/vscode` 记录）。修法两条：① 入口测试的 `afterAll` 里 `setEnabled(false)` + `flushMisses()`（flush 顺带清空缓冲）；② `collector.test.ts` 装好桩之后**自建基线**（同样两句），并把「模块默认关闭」改成对**全新实例**断言——带查询串的 `import("../collector.ts?fresh-default-state")` 在 Bun 1.4.2 里确实是新实例（2026-10-07 实测，另见本节末的更正）。

**popup 为什么改用真实 DOM**：popup.ts 顶层的 `assertFound` 在缺元素时直接抛错 → popup **整页空白**，而 `popup.html` 与 `popup.ts` 分属两类文件。写桩 DOM 时，桩里的选择器列表是从 HTML **抄**来的——HTML 改了测试照样全绿。改用 happy-dom 加载真实 HTML 后，删掉或改名任一元素都会当场红灯（实测：把 `#dev-panel` 改名后 popup 测试报「popup 结构不完整：缺少 #dev-panel」）。同一份契约另有一道**零依赖**的静态防线——`check:manifest` 的 `validatePopupSelectors`（只查存在性，不需要 DOM 库）：一道锁结构、一道锁行为，缺一不可。

真实 DOM 还当场纠正了一条**桩掩盖的语义**：`#status` 是双重身份元素（HTML 兜底文案 `statusLoading`，启动后立刻被 `statusOn` / `statusOff` 覆写）。手写桩把它拆成两个对象，于是「data-i18n 全部回填」的断言一直在假通过。

**真实 DOM 还抓出了一个真实缺陷（2026-10-03，已修）**：`TreeWalker` 的过滤器**不作用于 root**——DOM 规范里 root 只是遍历的起点与边界，`nextNode()` 永远不会把它交给过滤器；而属性变更记录的 `target` 恰恰是**那个元素本身**，引擎把它入队后调用的是 `translateTree(input)`。于是「上游（Turbo 快照 / `data-disable-with`）把按钮 `value` 改回英文后重翻」这条功能**在实机上是坏的**：`input` 自己的 `value` 从来不会被翻。修法是 `translateTree` 里那句 `applyAttrs(root, view)`，回归用例是 `walker.test.ts` 的「translates attributes on the traversal root itself」。**手写桩的结构性缺陷正在这里**：旧桩的 TreeWalker 会把 root 也过一遍过滤器，于是这个缺口永远是绿的——桩的危险不是「不够真」，而是它会悄悄改变被测对象的拓扑。

**防翻译循环现在有一条端到端验证**：`engine.test.ts` 的「writes nothing for a dictionary entry that maps to itself」先用真实 `MutationObserver` 证明**同值写入也产生 characterData 记录**（规范如此，这是循环在结构上成立的唯一原因），再断言引擎跑完整轮后 DOM 上一条新记录都没有。这类断言非真实 DOM 不可得。

**happy-dom 的使用边界**：它是 devDependency（不进 dist），只给「需要真实 DOM 语义」的测试用。75 个页面词条回归文件是纯字符串断言（`translateText`），**不要**为它们引入 DOM —— 那是测试量的主体，也是收益为零的地方。happy-dom 也不是浏览器：扩展 API（`chrome.*`）仍需自桩，语义差异风险仍在，故**不能替代实机验证**。

另注：content 入口与 popup 都有顶层副作用，**一个进程只会装配一次**，所以有两处覆盖不到，都不是「忘了写」而是结构上做不到：

- 「`enabled` 关闭时不启动观察器」这条反向条件无法再开一个测试文件验证（第二个文件静态 import `../index.ts` 会复用第一次的装配结果）。**更正（2026-10-07）**：带查询串的 `import` 在 Bun 1.4.2 里**确实产生新实例**——`collector.test.ts` 用 `../collector.ts?fresh-default-state` 实测，新实例的 `setEnabled` 不影响共享单例（早前「`?query` 也不产生新实例」的结论已不成立）。也就是说这条反向条件在结构上**可以**再开一个文件覆盖（同一个加载器机制），只是本轮没做。该闸门目前仍由 `engine.test.ts` 的「关闭时只清空队列不翻译」与 `readEnabled` 的默认值把守；
- `popup.ts` 末尾那个 `try { main() } catch` 兜底分支同理（要覆盖它得造出第二个「`main()` 抛错」的装配场景）。它是纯兜底，代价可接受；`popup.ts` 顶层的 `assertFound` 仍在 `main()` 之外抛出，**刻意不吞**（缺元素属打包错误，掩盖它只会让人更难查）。

**已知空缺：`repo-settings`（`/owner/repo/settings`）整页尚未采集**（该页需要登录），所以仓库设置页没有**整页**的实机节点回归——目前它只有三处：`repo-settings/index.test.ts` 覆盖的「Creation allowed by」筛选按钮三节点、2026-10-03 采集的议题创建策略 action-list 与保留期改版文案，`repo-settings/actions.test.ts` 覆盖的 Actions 子页（途径 A 清单），与 `repo-settings/interaction-limits.test.ts` 覆盖的交互限制子页（途径 A 清单）；其余词条靠视图骨架层的保护（命中模块序列 + 碰撞赢家）与词典门禁。

组织设置族（模块 `pages/org-settings`）同样是**部分采集**：2026-10-03 的途径 A 清单只覆盖 `settings/profile` 与 `settings/policies/repositories` 两页，同日维护者贴的两段实机 HTML 又补上**组织账单总览页**（正文词条与规则来自 `pages/settings-billing`，见 `org-settings/billing.test.ts`）与**侧栏外壳**（`org-settings/sidebar.test.ts`，所有子页共用，一次采集覆盖全部），2026-10-07 贴的 AI 用量页 HTML 再补上**组织路由下的 AI 用量页**（`org-settings/billing-ai-usage.test.ts`，同样是 `pages/settings-billing` 的第二支路由）、同日的预算页片段又补上**组织路由下的预算与提醒页**（`org-settings/billing-budgets.test.ts`，只覆盖贴出的下拉菜单与计数行，页面其余部分仍靠个人路径的 `settings/billing.test.ts`）、同日贴的许可页 HTML 再补上**组织路由下的许可页**（`org-settings/billing-licensing.test.ts`；它的路径不在 billing 前缀下，故该模块的组织支在那一轮又加了一支）、同日的付款信息页 HTML 又补上**组织路由下的付款信息页**（`org-settings/billing-payment-information.test.ts`；这一页**不缺路由**，补的是表单标签以外的其余区块 + 一条清空独立冠词节点的规则 `settings/article-the`）、同日的付款历史页 HTML 又反推出**组织账单的非 settings 支**（`org-settings/billing-payment-history.test.ts`；整页无中文 ⇒ 路径不带 `/settings/` ⇒ `/organizations/<组织>/billing/**` 此前未被任何模块覆盖）、同日的赞助订阅页 HTML 又补上**组织路由下的赞助订阅页**（`org-settings/billing-subscriptions.test.ts`；这一页也不缺路由，补的是 GitHub 新加的组织侧「账单联系人」区块，另示范了跨模块同键同值该怎么收）、同日贴的账单管理员邀请页 HTML 又补上**组织根上的邀请页**（`org-settings/billing-managers.test.ts`；它**不在 `/settings` 下**，正文靠 `billing` 前缀命中账单模块、侧栏靠 `pages/org-settings` 同日补的第三支，两处缺一即半页英文）、同日贴的角色管理页 HTML 又补上**组织角色管理页**（`org-settings/org-roles.test.ts`；它**不缺路由**，补的是整页 129 条词条——九个角色的权限矩阵与其中 96 条清单项，另把权限级别的 `Write` 从 global 的「编写」定点纠正为「写入」），同日贴的角色分配列表页与新建页 HTML 又补上**组织角色分配页**（`org-settings/org-role-assignments.test.ts`；也不缺路由，补的是空态说明句、新建页说明段与链接、表单标签与九张角色卡的 tooltip，并给本模块添了第一条非标题类规则 `org-settings/roles-count`——`9 roles` 的条数随组织有没有 enterprise 角色而变，静态键覆盖不了；同日复测又按维护者在实机 console dump 的 `childNodes` 把空态标题与空态说明句都改成**碎片键**（`No ` / `organization` / ` roles assigned` 与 ` roles have not been assigned to any ` / `users or teams`——这两句的整句键在实机永不命中，`outerHTML` 也看不出节点边界，**新页开工前务必先 dump 一次 `childNodes`**，详见 `org-role-assignments.test.ts` 头部注释）；同日贴的仓库角色页 HTML 又补上**组织仓库角色页**（`org-settings/repository-roles.test.ts`；也不缺路由——挂在 `settings` 前缀下、命中 `pages/org-settings` + `global`，缺的是词条：预定义角色区块、五个预定义角色的说明句与管理员行尾链接、页尾的 Enterprise 升级横幅共 14 条键。这一页是**服务端渲染的传统 Primer 页面**（`Subhead` + Octicon SVG），与 React 重写的空态不同：长句里没有插值项时就是一个整文本节点，故说明句按整节点收；唯一的例外是 `You can …` 那句，句中的 `<a>set the base role</a>` 把句子切成文本 / 链接 / 文本三段，整句键永不命中——它同时是「**同一句里有没有内联元素**决定要不要拆」的对照例，也说明上一条 dump 规程针对的是 React 页面，传统页面按标签嵌套即可判边界）；同日贴的成员权限页 HTML 又补上**组织成员权限页**（`org-settings/member-privileges.test.ts`；也不缺路由，缺的是整页 76 条词条 + 2 条规则——基础权限 / 仓库创建 / 仓库复刻 / 仓库讨论 / 项目基础权限 / 页面创建 / 应用访问请求 / GitHub 应用 / 管理员仓库权限 / 成员团队权限十个区块，以及八条确认对话框的标题与警告横幅。三处切分与两处动态值是这页的全部难点：① 仓库删除那句被 `<strong>public</strong>` / `<strong>private</strong>` 切成**五个节点**，中间三个片段是小写泛化词（`public` / `and` / `private`），收它们的唯一理由仍是模块按路由限定；② 议题删除那句的链接后面跟着一个**独立句号节点**，翻不了；③ 基础权限对话框正文含两个动态计数（`2 members` / `5 repositories`），上游 ERB 插值时数字各自成节点（引擎对纯数字节点直接跳过），故用「常量句首 + 常量中段 + 常量句尾」三段碎片键覆盖，万一上游把它渲染成整句一个节点则由规则 `org-settings/base-permission-change` 兜住——**两种切分都锁了用例**；④ 仓库讨论说明句里的组织名走规则 `org-settings/discussion-creation-org`））、同日贴的导入/导出两页 HTML 又补上**组织导入/导出页**（`org-settings/import-export.test.ts`；模特页与归属邀请页都不缺路由，补的是页签与表格表头、搜索框、表头 tooltip、两个空态标题与说明段共 9 条键，**没有新规则**故骨架快照不动。三条要点：① 搜索框的 **placeholder 与 aria-label 差末尾三个点**，是两个不同的串，属性只走精确命中；`Mannequins` 一条键同时覆盖页签与表头；② 归属邀请页的说明段约 355 字符，仍在引擎的 500 字符上限内（超了会被当代码 / 用户内容整段跳过），三个状态值译成中文且「已完成」与 global 的 `Completed` 同译；③ `Mannequins` 沿用 GitHub 官方中文文档的「模特」译法（docs.github.com/zh 的「模特和用户活动」）另加「账号」二字，避免与「时装模特」混淆）、同日贴的已屏蔽用户页 HTML 又补上**组织已屏蔽用户页**（`org-settings/blocked-users.test.ts`；一页两种渲染形态——服务端渲染的说明句与添加屏蔽卡片 + 页尾 React partial。它不缺路由，缺的是 23 条键 + 4 条规则：① 其中 16 条串在 `pages/settings` 的个人页里早有词条而那条路由不命中 `/organizations/**`，故本模块逐字同译各收一份，用例断言两份视图译文逐字相等；② 只有备注说明的结尾与组织侧独有的屏蔽时长菜单是新文案；③ 三条动态值——带句点的剩余字数（不带句点那条是 global 的规则，两条互不覆盖）、按 `data-text-template` 填入的用户名、以及 `data-dynamic-label` 可能把时长菜单重组成单个节点时的两种形态（`Block: For N day(s)` 一条规则覆盖四档，不留中英残句）；三条组织设置探针的规则序列各 +4，另在组织账单探针上多出一条跨模块同键记录）、2026-10-09 贴的交互限制 / 代码审查限制 / 版主三页 HTML 又补上**组织交互限制页、组织代码审查限制页与组织版主页**（`org-settings/interaction-limits.test.ts`、`org-settings/code-review-limits.test.ts`、`org-settings/moderators.test.ts`；三页都不缺路由，缺的是整页词条：前两页的正文与个人设置的 `/settings/interaction_limits`、`/settings/code_review_limits` **几乎逐字相同**而那条路由不命中 `/organizations/**`，故本模块逐字同译各收一份（`New users` / `Users` / `Contributors` / `Collaborators` / `Enable` / 五档时长都属这一类），版主页没有个人侧对应物、六条全是新增。三类边界事实：① 交互限制页页首说明的两句**同属一个文本节点**（原文之间只有空行），故整段一条键——个人页那条只覆盖第一句，两条不是同一个串；② 交互限制页的「当前上限」那句被 `<strong>数字</strong>` 切成三段（前缀词条 + 纯数字节点 + 数字之后的整句），数字由输入框决定（1–1000），故第三段走新规则 `org-settings/pr-cap-limit`，单复数用 `s?` 一条覆盖（**仓库级子页只有单数静态键**，同类缺口记在那边待办）；③ 版主页「最多可添加 10 名成员或团队」同样是数字节点两侧各一条碎片键；交互限制页的 H2 **没有出现在贴出的 HTML 里**（另两页的 H2 都在），本模块既有键 `Interaction limits` 只覆盖「H2 与侧栏项同串」那种形态，故另收一条 `Temporary interaction limits` 兜底，实机确认后删掉多余的那条。三条组织设置探针的规则序列各 +1）、同日贴的仓库默认设置页 HTML 又补上**组织仓库默认设置页**（`org-settings/repository-defaults.test.ts`；也不缺路由，缺的是整页 44 条键 + 1 条规则。前两个区块与个人设置页 `/settings/repositories` 几乎逐字相同而那条路由不命中 `/organizations/**`，故各收一份逐字同译；后三个区块（Commit signoff / Releases / Repository labels）是组织侧独有、整块新增。四类边界事实：① Commit signoff 的说明段被两个链接切成五段，`. ` 与收尾的 `.` 翻不了；② 标签表单下方的剩余字数 `50 remaining` 走新规则 `org-settings/remaining-count`，与屏蔽用户页那条带句点的、以及 global 那条不带句点但带 `characters` 的三条 pattern 互不覆盖；③ 列表标题的计数行是「数字」+ `labels` 两节点，单数 `label` 也收，译文带量词拼出「15 个标签」；④ 16 个色板按钮的 `Color #<hex>` aria-label 与 `data-confirm` 等 `data-*` 有意不收录。三条组织设置探针的规则序列各 +1，另在组织账单探针上多出一条 `Update` 的跨模块同键记录），其余子页（`authentication_security` / 组织路由下计费的 `usage` 等子页）尚无任何实机证据——**注意计费子页与个人账单页共用同一套词条与规则**，那些规则在个人路径上已有实机回归（`settings/billing.test.ts`），缺的只是「组织路由下确实加载了同一个模块」这一层，而它已由 `org-settings/billing.test.ts` 与 `org-settings/billing-*.test.ts`（AI 用量 / 预算 / 许可 / 付款信息 / 付款历史 / 赞助订阅 / 账单管理员邀请）的路由断言钉住；剩余子页的**正文**词条仍只有视图骨架层保护。补下一批时的三条注意：① 采集必须在**未加载本扩展**的原始英文页面做，或明确以「仍是英文的模板文案」为待补项（本页清单是后者，故清单里混着扩展自己写入的中文译文产物——凡是 `kind: "text"` 却是中文的条目都不是漏翻，别登记）；② 国家 / 地区下拉的名称（约 200 条）、州 / 省下拉的名称（2026-10-03 由服务条款里的企业账单表单带出）与社交平台品牌名**有意不收录**，见 `pages/org-settings` 的译文文件头；③ 危险区域三个对话框里 `We` / `will` / `archived` / `cancel` 与设置范围切换器里的 `settings`（小写）这类**单词键**是泛化词，收它们的唯一理由是模块按路由限定在组织设置页，一旦实机误伤就删词条，别加白名单；`settings` 一条另有 pages/settings 的同句先例——维护者 2026-10-03 指出组织设置页的「切换 settings 上下文」必须与用户设置页一致，故从「不收录」改为收录。2026-10-09 维护者贴的**组织主题页**（`/orgs/Koishi-CE/topics`）截图又暴露**第四支路由**：这一页不在 `/settings/` 前缀下、此前只有 global 兜底，页头与整个侧栏保留英文，故路由里补上 `topics` 一支、骨架门禁加一条探针 `/orgs/octocat/topics`（`org-settings/topics.test.ts`）——它顺带演示了 SOP 里那条容易被跳过的前提：**先确认路由命中，再谈词条**；页面词条再多，路由不命中也是零。2026-10-10 维护者贴的**组织规则集页** outerHTML（`/organizations/<组织>/settings/rules`，HTML 里的 `<react-app app-name="repos-rules">`）又演示了**相反方向的一半**：这一页路由是对的，但同一款 React 应用在**仓库级路径**上也渲染（`/owner/repo/settings/rules`），那批文案只登记在 `pages/repo-settings` 里，而它的路由排除了组织路径——于是组织侧「明明翻译过却漏翻」（`org-settings/rulesets.test.ts`）。判断这类页面只要看 `react-app app-name`：同一个 app 出现在两条路径上，就要问「另一个模块的词条我这一侧有没有」。同日的**组织规则集仪表盘页**（`/organizations/<组织>/settings/rules/dashboard`）正是这条判据的反面实例：它的 `app-name` 是 `rule-insights-dashboard`，与规则集页 / 洞察页的 `repos-rules` **不是同一款应用**，所以整页 27 条键全是新串、没有仓库级同串可对（`org-settings/ruleset-dashboard.test.ts`）——**看一次 `app-name` 就能定「要不要去另一个模块找同串」**，省掉整轮猜测。这一页还带出 Highcharts 的第二类事实：可见的轴标题与图例是文本节点，**屏显不可见的读屏描述**（clipped 区域与 SVG `<desc>`）是动态文本，而 `pages/insights` 里那批同款规则**不命中组织路径**，故又各收一份（7 条，逐字同译，用例把两模块的译文钉成相等）。同日维护者贴的**组织自定义属性页**（`/organizations/<组织>/settings/custom-properties`）HTML 又补上页签栏、筛选框与「建议的自定义属性」空态区块（`org-settings/custom-properties.test.ts`）——这一批的特殊价值在于它**自带实机证据**：贴出的 HTML 里 `搜索或筛选` / `建议` 已是中文，而那正是同一天前两批刚登记的键，于是第一次拿到「新键在实机上确实生效」的直接确认（此前只能靠维护者复测口头回报）。同一批还记下一条采集事实：组织设置页的**文档标题**由 payload 的 `title` 直接给出完整串（`Settings · Custom properties · Koishi-CE`），中段是页面名、规则不递归，故中段恒为英文。

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
- **全展开的代价如实记在此处**：这批长月份规则挂在 `pages/settings-billing` 模块下，而该模块的路由是
  `^/(?:(?:settings|account)/billing|(?:organizations|orgs)/[^/]+/(?:settings/(?:billing|licensing)|billing))`（2026-10-03 并入组织账单支，
  2026-10-07 并入组织许可支——许可页路径里没有 `billing` 段，必须显式加支；同日又并入组织账单的
  **非 settings 支** `/organizations/<组织>/billing/**`——付款历史页实机整页无中文反推出的那一支；
  该支里的 `billing` 是**前缀匹配**，顺带覆盖了组织根上的 `/organizations/<组织>/billing_managers/**`，
  即同日补的账单管理员邀请页——将来收紧这条正则必须把 `billing_managers` 显式写回备选项）——
  当前命中 **6 条探针**（`/account/billing`、`/account/billing/ai_usage`、`/account/billing/budgets`、
  `/account/billing/licensing`、旧路径兼容锚点 `/settings/billing`，以及组织账单页 `/organizations/octocat/settings/billing`），
  所以视图骨架快照会在这 6 处各膨胀一百多个永不使用的规则 id；把它们上提到 `pages/settings` 更糟：
  每条 `/settings*` 探针都会背上这一百多条（组织路由下的 AI 用量页、预算与提醒页、许可页都与账单总览
  同模块、同命中序列，故按 2026-10-07 的判断**不另列探针**，见上表 `org-settings/billing-ai-usage.test.ts` 一行）；
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
