# 项目常驻指令

> 本文件是本仓库（Github-i18n，曾用名 Github-ZH；扩展显示名「GitHub 界面本地化」——把 GitHub 界面本地化为多种语言（当前 zh-CN / ja）的浏览器扩展，Chrome / Edge，Manifest V3，MIT）的常驻开发约定，适用于本仓库内所有会话与任务。

## 基本约束

- **全程使用简体中文**：所有回复、代码注释、提交说明、生成的文档均使用简体中文。
- **不要在 Biome 的 JSON 行尾不可见字符上浪费 Token**：已知、正常、无害，看到即跳过，不调查、不修复、不报告。
- 除以上约束外，不要过度解读本指令——其余行为遵循默认 Agent 规则。

## 硬性约束（违反 = 错误）

1. **许可证纪律**：全仓 MIT（见 LICENSE 与 NOTICE）。**严禁引入任何 GPL / AGPL 系汉化项目的词典或代码**（包括但不限于 maboloshi/github-chinese）；词典 100% 原创，逐条手写。
2. **词典归档纪律**：语言无关的数据只进 `src/dict/core/`，译文只进 `src/dict/locales/<语言 id>/`（id 见 `src/dict/locales.ts`，支持 zh-CN / ja）：
  - `core/modules.jsonc`：模块名 + 路由，**顺序即优先级**（具体页在前，`global` 兜底必须最后且路由为 `^/`，门禁强制）；
  - `core/canonical.jsonc`：**键的权威清单**（仅门禁使用、不进 content 包）。上游新增 / 改动文案，先在这里登记键；各语言词条的键与它不一致即报错；
  - `core/aliases.jsonc`：只在「上游改了词、语义没变」时加一行「当前 DOM 文本 → 规范键」；**拆节点的改动不能靠别名**（整句译文无法复用），必须新增碎片词条；
  - `core/rules.jsonc`：共享规则的 `id` 与 `pattern`，**顺序即语义**；规则 id 全局唯一，**同模块内 `pattern` 必须唯一**（同模块首条命中生效，重复的那条是永不生效的死规则；`May` 这类全称与缩写同形只留一条，跨模块重复合法），改名必须同步各语言模板；不得带 `flags` 字段（`g` / `y` 的 `lastIndex` 会跨节点累积导致漏翻）；
  - `locales/<语言>/<模块>.jsonc` 只放键值对，`locales/<语言>/rules.jsonc` 只放「规则 id → 模板」；键必须是 canonical 里的英文原文精确串（不得含目标语言文字系统），值必须含该语言的文字系统（防替换循环），译文不得等于任何键；
  - **稀疏覆盖是正常状态**：缺模块 / 缺键 / 缺规则模板 = 尚未翻译，引擎保留英文；新增语言要同时改 `src/dict/locales.ts`（元数据）与 `src/dict/registry.ts`（数据），覆盖率由 `check:dict` 报告；
  - JSONC 里正则的反斜杠必须双写（`\d` 写作 `\\d`）；新增 / 改名模块要同步 `core/modules.jsonc` 与 `core/canonical.jsonc`（两者同名同序，门禁强制）。
3. **词典键是「整节点精确匹配」语义**：收录可能与仓库名、文件名、用户名撞车的泛化短词（如 `docs` / `test` / `blog` 等小写词）前三思，优先收录多词无歧义短语；大小写必须与 GitHub 实际渲染一致。
4. **manifest.json 手写在 `public/`**：构建时原样拷贝进 dist，不存在自动生成；改 `matches` / 权限 / 产物文件名时，同步 `tooling/checks/manifest.ts` 的断言。
5. **content script 产物必须是经典脚本（IIFE）**：MV3 的 `content_scripts` 不支持 `type: "module"`，`tooling/pipeline/build.ts` 用 Bun.build `format: "iife"` 产出，勿改回 esm。
6. **排除清单优先**：代码块 / 用户内容可能出现的容器，先加进 `src/content/filters.ts` 的排除选择器，再考虑词典侧回避；**不得为覆盖 UI 词条而放宽排除**。
7. **dist/ 是构建产物**：不入 git；商店发布一律使用 `bun run pack` 产出的 zip。

## 门禁与工作流

```bash
bun install                     # 安装依赖（Bun，产出 bun.lock）
bun run check                   # 全量门禁：lint + typecheck + check:dict + check:manifest + check:view + test
bun run lint                    # biome check .（格式 + lint 唯一权威）
bun run format                  # biome format --write .
bun run typecheck               # 两条 tsc：src（浏览器侧）+ tooling（脚本侧）
bun run check:dict              # 词典门禁（结构编译 / 交叉引用 / 键形态 / pattern 唯一 / 译文形态 / 防循环 / 覆盖率报告）
bun run check:manifest          # manifest 门禁（MV3 字段完整性、_locales 键集合与占位符、popup.html 版本号与 popup.ts 选择器、public 资产存在性）
bun run check:view              # 视图骨架门禁（模块顺序 / 命中序列 / 同键异译赢家 / 规则 id 序列；--update 重生成快照）
bun test                        # 全量用例（bun test）
bun run build                   # 构建 dist/（Bun.build IIFE ×2 + 拷贝 public/）
bun run watch                   # 构建并监听（改 src 自动重建，扩展需手动重载）
bun run pack                    # dist/ 打 zip（Chrome Web Store / Edge Add-ons 通用）
```

- 提交前 `bun run check` 必须全绿；实机验证：构建后在 `chrome://extensions`（Edge 为 `edge://extensions`）开发者模式加载 `dist/` 目录。
- GitHub 改版导致漏翻 / 误伤属常态：先在实机确认失效点，再修对应词条或排除选择器。
- 审计后补强的门禁项（细节见 `docs/guides/development.md`）：`check:dict` 要求**键必须等于引擎 `normalizeKey` 后的形态**（带换行 / 连续空格的键永不命中，只会虚高覆盖率）且**同模块内 pattern 唯一**；`check:manifest` 校验**跨语言 `$NAME$` 占位符一致性与 `placeholders` 声明**、**`popup.html` 的 `class="version"` 文本等于 `package.json` 版本**、以及 **`popup.ts` 的每个 `querySelector` 字面量都存在于 `popup.html`**（缺元素会让 popup 整页空白）；`bun run build` 断言**产物集合与入口一一对应**（`tooling/pipeline/build.test.ts` 另真跑一遍构建，断言两份产物都是 **IIFE 包装**且 `public/` 资产已拷入）。

## 代码风格

- 缩进 tab、双引号、无分号（asNeeded）——**biome 是格式的唯一权威**（`.editorconfig` 已与之对齐：代码 tab，文档 `.md`/`.yml` 2 空格）。
- TS 严格全家桶（根 `tsconfig.json` 与 `tooling/tsconfig.json` **各维护一份完整 `compilerOptions`**，不用共享 extends 基座；改严格选项必须同步两处）：`strict` + `noUncheckedIndexedAccess` + `noPropertyAccessFromIndexSignature` + `exactOptionalPropertyTypes` + `noUnusedLocals/Parameters` + `verbatimModuleSyntax` + `isolatedModules` + `erasableSyntaxOnly`；类型导入一律 `import type`；显式 `any` 保持 0，动态边界用 `unknown` + 收窄。
- 测试与源码同目录 `*.test.ts`（**例外：页面词条回归统一放 `src/dict/__tests__/pages/`**——被测对象是词典数据与模块路由，不是某个源码模块；同一模块族多到成规模的再收进同名子目录 `pages/settings/`、`pages/repo-settings/`（文件名去掉族前缀），一模块一文件的留在 `pages/` 根下；见已知坑「逐页开工的固定起手式」），`bun:test`（`describe` / `it`，英文短描述）；门禁与工具脚本零第三方依赖、bun 直跑，校验逻辑导出为纯函数（`main` 用 `import.meta.main` 守卫）供测试复用；错误信息中文，失败统一 `process.exitCode = 1`。

## 已知坑（一行一条，细节见 docs/guides/development.md）

- **biome.json 里不能写注释**：出现 `//` 会让 Biome **静默丢弃整个 `overrides` 数组**。
- **Bun.build 没有 `outfile`**：产物命名靠 `naming` 模板，content 与 popup 按入口分别构建；iife 是硬约束（见硬性约束 5）。
- **`check:view --update` 的行宽判定必须含尾随逗号**：`serializeSkeleton` 自己按 Biome 规则排版，验收标准是 `--update` 之后 `biome check tooling/fixtures/` 零改动；数组**非末位**元素末尾的逗号也算一列，漏算会让「内联正好 60 列」的元素被误判成内联（2026-09-27 在 `collisions` 上首次踩到，此前从未产生过非空 collisions；已修 + 回归用例）。
- **图标是静态资产，没有生成脚本**：`public/icons/` 下的 `logo-16.jpg` / `logo-32.jpg` / `logo-48.jpg` / `logo-128.jpg` 直接提交在仓库里，改图标就替换这四个文件（四个尺寸都要换）；**改文件名必须同步 `public/manifest.json` 的 `icons` 与 `public/popup.html` 的 `<img src>`**（`check:manifest` 校验引用存在性，漏改即红灯）；`assets/icon.svg` 与 `tooling/gen-icons.ts` 已删除，`bun run icons` 不再存在（历史：曾用无头浏览器 CDP 栅格化 SVG，新版无头浏览器的 `--screenshot` 不支持透明背景，故当时必须走 CDP）。
- **GitHub 正在渐进迁移 React 重写页面**：类名 / 结构变动导致漏翻或排除失灵属常态，修词条前先修对应排除选择器。
- **防翻译循环现在是三件事**：脚本守卫（文本含非拉丁字母即视为已译文，语言无关，见 `src/content/filters.ts`）负责收敛，结构门禁（译文不得等于任何键、替换产物不得再命中规则）负责让循环的第二条件不可能成立，**引擎侧「同值不写入」守卫**（`src/content/walker.ts`：`next === value` 时直接返回）负责让自我触发在物理上不可能。**拉丁语系目标语言只能靠后两者**——它与源语言同字系，脚本守卫结构上失效。
- **译文绝不能与键同形（`"X": "X"`），且白名单不是出路**：DOM 规范规定 `node.nodeValue = 同值` 也会产生 characterData 变更记录，观察器会把它再入队，于是「命中 → 写入 → 再命中」在微任务队列无限自转，页面**不报错但卡死**（2026-09 真实事故：`"ORCID iD": "ORCID iD"` 让 `/settings/profile` 卡死，只有含该标签的页面命中）。想保留英文原文的正确做法是**不收录该词条**——未命中即保留英文。门禁 `tooling/checks/dict.ts` 无白名单，`validateNoIdentity` 会直接报错。
- **`core/canonical.jsonc` 不进 content 包**：它只被 `tooling/checks/dict.ts` import；一旦 `src/**` 也 import 它，全部规范键就会进包（当前 2207 个槽位 / 2134 个唯一键，紧凑 JSON 约 80 KB；数字随词典增长，以 `bun run check:dict` 输出为准）。
- **规则模板按 id 对齐 pattern**：`core/rules.jsonc` 里改 pattern 是 O(1) 的（各语言模板不用动），但**改 id 必须同步所有语言的 `rules.jsonc`**；模板引用的 `$1` / `$<name>` 由门禁对着 pattern 校验。
- **`<relative-time>` 等自定义元素会自行重渲染英文**：靠观察器再翻一遍收敛，勿试图一次性翻译。
- **词典误伤权衡**：静态词典按「整节点精确匹配」工作，任何词条都可能命中同名的用户内容（仓库名 / 文件名），高风险短词靠不收录来回避（见硬性约束 3）。
- **JSONC 正则的反斜杠必须双写**：`\d` 在 `.jsonc` 里要写 `\\d`；写漏一层 Bun 直接报 `Syntax Error`（响亮失败，不会静默变成别的正则）。另注意 `RegExp#source` 会把 `/` 转义回 `\/`，断言路由 / 规则请断言行为，别断言 `source`。
- **tsc 不认 `.jsonc`**：开了 `resolveJsonModule` 也报 TS2307，靠 `src/dict/types/jsonc.d.ts` 的 ambient 声明；`tooling/tsconfig.json` 的 include 必须含 `../src/**/*.d.ts`，否则脚本侧工程拿不到该声明。
- **词典数据由两条路消费同一个注册表**：`src/dict/index.ts` 单模块编译失败只跳过 + 打日志（保整站翻译），`tooling/checks/dict.ts` 走同一套 `load.ts` 但严格报错。**禁止让门禁 import `index.ts`**——那样坏数据被静默跳过后门禁反而变绿。
- **`.jsonc` 的重复键归 Biome 管**：`biome check .` 会扫 `.jsonc`，`noDuplicateObjectKeys` 对加引号 / 裸键两种写法都报，故 `check:dict` 不再扫源码。编辑器侧另有 `src/dict/types/dict.schema.json`（`$schema` 只对编辑器生效，CI 不读它；它用 `oneOf` 覆盖六种数据形状）。
- **扩展自身 UI 文案走 `public/_locales/`**：manifest 的 `name` / `description` / `action.default_title` 用 `__MSG_*__`，popup 文案用 `data-i18n` + `chrome.i18n.getMessage`；门禁强制「各语言消息键集合一致」与「引用的键都存在」。**（未来重建的）实机探针不能用 `manifest.name` 认扩展**（它随浏览器语言变化），要用 content script 写下的身份标记（`src/shared/identity.ts`，当前只写不读）。
- **逐页开工的固定起手式：先抓实机渲染文本，再登记键**。GitHub 的长说明句普遍被拆成多个文本节点（链接、`<kbd>`、`sr-only` 各自成节点），整句键在实机上永不命中；抓取方式与四类边界事实（`kbd` 内文本被排除、`sr-only` 照常翻译、纯符号节点翻不了、`\u00a0` 会被 trim）见 `docs/guides/development.md` 的「采集实机渲染文本」。**节点边界必须同时写进 `src/dict/__tests__/pages/[<模块族>/]<页名>.test.ts`**，否则下次改版无人知道它断了。
- **逐页补翻译的完整流程已固化成 SOP**：见 `docs/guides/development.md` 的「逐页补翻译的标准作业流程」。开工前先读那一节，别在同一个地方重新摸索。三条最容易白费 token 的既定事实：① 实机文本**只能由维护者在浏览器里采集**——本机 `web_fetch` 到 github.com 会报「解析到非公网地址」、复制 Edge 配置副本拿不到登录态（`Cookies` 库被运行中的 Edge 独占）、运行中的 Edge 不暴露 CDP 端点，这三条路都已实测走不通；② 采集必须在**未加载本扩展**的原始英文页面上做，否则拿到的是中英混杂的渲染结果；③ PowerShell 沙箱偶发 `SetNamedSecurityInfoW … grantWrite` 初始化失败时**连续重试无用**，直接说明并改用文件读写（read / write / edit / glob / grep）继续推进。
- **自动化实机探针已于 `48bf519` 删除、尚未重建**：`tooling/verify-live.ts` 与 `package.json` 里的 `verify` 脚本都已不在仓库里，**文档与脚本都不得再引用那条命令**；现在只有 popup 的开发者模式 + 手工浏览这条采集路径（做法见 `docs/guides/development.md`）。`src/shared/identity.ts` 的身份标记保留给未来的实机探针（`content/index.ts` 仍照常写入 `__githubI18nContent`），当前全仓没有任何读取方。
- **`bun test` 的 `globalThis` 与模块注册表跨测试文件共享，三个动作会打红别人的用例**：① `mock.module` 是**进程级**注册、会泄漏（实测把 walker / pages 的真实导出顶掉）；② `globalThis.chrome` / `document` 等桩必须**合并挂载**（`obj["k"] = v`）、禁止整体替换，否则会删掉别的文件刚装的命名空间；③ **DOM 只有一份来源**（`src/test-support/dom.ts`，bun 是按文件「加载 → 跑 → 下一个」，故它负责收尾 `restore()`），因为 `root instanceof Element` 比的是**类身份**，两个文件各造一个窗口会让先装的那份节点不再是 `Element`。细节见 `docs/guides/development.md` 的「实机节点边界测试」末段。
- **`TreeWalker` 的过滤器不作用于 root**：DOM 规范里 root 只是遍历的起点与边界，`nextNode()` 永远不会把它交给过滤器。而属性变更记录的 `target` 恰恰是**那个元素本身**，所以 `translateTree(root)` 必须另外 `applyAttrs(root, view)` 一次——漏掉就会表现为「上游把按钮 `value` 改回英文后再也不重翻」（2026-10-03 由真实 DOM 用例抓出，见 `walker.ts` 与 `walker.test.ts` 的「translates attributes on the traversal root itself」）。顺带一提：**手写 DOM 桩会把 root 也过一遍过滤器**，因此这个缺口在桩上是永远绿的。
- **需要真实 DOM 语义的测试统一用 `src/test-support/dom.ts`（happy-dom，唯一新增的 devDependency，不进 dist），但页面词条回归绝不引入**：popup 测试直接加载仓库里的 `public/popup.html`，才能锁住「HTML 元素 ↔ popup.ts 选择器」这条契约——写桩 DOM 时那份选择器列表是从 HTML **抄**来的，HTML 改了测试照样绿（同一契约另有零依赖的 `check:manifest` 静态防线）。**手写 DOM 桩已全部退役**：桩的危险不是「不够真」，而是它会悄悄改变被测对象的拓扑。`happy-dom` **不是浏览器**：扩展 API（`chrome.*`）仍要自桩，也不能替代实机验证。

## git 提交流程

1. 先跑 `bun run check`（必要时先 `bun run format`），确保通过再提交。
2. `git add -A` 后提交，提交信息用简体中文，格式参考现有历史（`feat:` / `fix:` / `docs:` / `chore:` / `build:`，可带 scope 如 `fix(dict):`）。
3. 提交到主分支 `main`；若当前不在主分支，先切回主分支再提交。
4. 提交完成后向用户简要说明改了什么与提交哈希。
