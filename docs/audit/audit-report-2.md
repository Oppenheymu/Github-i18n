# Github-i18n 第二轮审计报告

- 审计对象：`C:\Dev\Tool-Dev\Github-i18n`（扩展显示名「GitHub 界面本地化」，MV3，MIT）
- 审计基线：`main` @ **`88289b0`**（上一份报告审计的是 `71ba590`；本轮修复见 `8001d9f` / `e52322a`，其后用户又提交了 `88289b0`）
- 审计日期：2026-09-27
- 审计方式：门禁与产物**实跑** + 源码逐文件精读 + 词典数据脚本化统计 + **真机审计（无头 Edge + CDP，19 个真实 GitHub 页面）** + 对上一轮修复的对抗性复核
- 与上一份报告的差别：上一份明确声明「未启动浏览器」；本轮建立了可复用的真机通道，**页面级覆盖率、误伤、属性行为、popup 渲染都是实测结论**

---

## 0. 结论摘要

**综合评级：良好（B+，与上一轮同档但性质不同）**。上一轮的问题是「数据有确定性缺陷 + 门禁有空洞」；本轮修复后 **不再发现高危的实现缺陷或安全缺陷**，剩下的问题集中在**产品目标的达成度**与**结构性的维护负担**上：
1. **词典侧 100% ≠ 页面侧 100%**（本轮最重要的发现）：19 个真实页面上可翻译文本节点合计 **3265/5483 = 59.5%** 命中，最低的用户主页只有 **29.9%**。其中相当一部分是**不该翻的用户内容**（提交信息、仓库名、用户名、语言名），但仍有**成体系的真 UI 文案未收录**——最典型的是 GitHub 营销导航改版后新增的 13 条文案，它们在 **17 个页面上**同时缺失。
2. **一批保留路径没有模块归属**：`/orgs/<组织>`（覆盖率 34.8%）只命中 `global`，而有 **17 条已收录词条**就躺在 `pages/profile` 里用不上；`/login`、`/notifications`、`/marketplace` 同类。
3. **上一轮我加的保留名单本身不完备**（自审）：`/copilot`、`/import`、`/projects`、`/packages`、`/advisories`、`/security-advisories`、`/gist` 这 7 条真实路径仍会被 `pages/profile` 过度命中——静态 deny-list 在设计上不可能完备。
4. **运行时有三处静默失效**：属性观察缺口（6 个可翻属性只观察 2 个）、漏翻日志静默截断（300/500 上限无计数）、`bootstrap()` 无错误兜底。
5. **数据卫生**：4 组语义塌缩（`Follow`/`Watch` 都成「关注」）、3 组术语不一致、约 15 组「上游改文案后旧键未清理」的双登记、1 个空壳模块、354 个单 token 键（其中 24 个小写常用词）。

**关于误伤**：本轮做了 19 个真实页面的全量命中扫描，**未观察到任何一例用户内容被误翻**；那 24 个高危小写键里只有 5 个在实机上命中过，且都是正常 UI 文案。风险是**条件性的**（需要仓库/目录/用户名恰好等于某个键），不是正在发生的伤害。

---

## 1. 本轮方法与基线

| 门禁/命令                       | 结果                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile` | 通过（39 包，无漂移）                                                                                                                                                                   |
| `bun run check`                 | **exit 0**：lint 29 info、两份 tsc 通过、dict/manifest/view 三道门禁通过、**259 pass / 0 fail**（21 文件）                                                                              |
| `bun run check:dict`            | 17 模块 / **2091** 规范键 / **446** 共享规则 / **2141** 译文；zh-CN 2091/2091（100%），ja 50/2091（2.4%）                                                                               |
| `bun run build`                 | 11 个产物；`content.js` 298,197 B；`popup.js` 10,887 B                                                                                                                                  |
| `bun run pack`                  | 11 条目、330,556 B、store 模式                                                                                                                                                          |
| 真机审计                        | 无头 Edge 154 + CDP，19 个公开页面：**6,380 个文本节点**（可翻译 5,483 / 命中 3,265 / 漏翻 2,218；排除容器内 411；无拉丁字母或超长 486）+ **1,640 个候选属性**（命中 594 / 漏翻 1,046） |

真机通道的建立是本轮的方法论突破：词典侧的覆盖率只证明「登记过的东西都翻了」，**不证明「该翻的都登记过」**；只有抓真实 DOM 才能回答后者。

---

## 2. 发现分级总览

| 编号 | 级别 | 问题                                                                                                                                 | 位置                                      |
| ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| A-1  | 高   | 页面级覆盖率与词典侧 100% 严重脱节（19 页合计 59.5%，最低 29.9%）                                                                    | 词典整体                                  |
| A-2  | 高   | 13 条营销导航文案在 **17 个页面**上同时未收录；门禁无法发现这类缺口                                                                  | `core/canonical.jsonc`、`global` 模块     |
| A-3  | 中   | profile 图表 tooltip `No contributions on <日期>.` **365 条**未翻，一条规则即可覆盖                                                  | `core/rules.jsonc`                        |
| B-1  | 中   | `/orgs/<组织>` 无模块归属，17 条已收录词条用不上                                                                                     | `core/modules.jsonc`                      |
| B-2  | 中   | `/login`、`/notifications`、`/marketplace` 等保留路径无模块；登录页 10 条漏翻                                                        | `core/modules.jsonc`                      |
| B-3  | 中   | 45 条「已收录但提供模块不命中该路径」（`Actions` 8 页、`Features` 4 页…）                                                            | 模块粒度                                  |
| C-1  | 中   | 属性观察缺口：6 个可翻属性只观察 `value`/`data-disable-with`                                                                         | `content/engine.ts:38`                    |
| C-2  | 中   | 漏翻日志静默截断（300/500 上限无计数、无提示）                                                                                       | `content/collector.ts:14-16`              |
| C-3  | 中   | content script `bootstrap()` 无错误兜底                                                                                              | `content/index.ts:75`                     |
| C-4  | 中   | 开发者模式计数被重复遍历灌水（机制确认；合成实验 7×）                                                                                | `collector.ts:44`、`walker.ts`            |
| D-1  | 中   | 语义塌缩 4 组：`Follow`/`Watch`、`Unfollow`/`Unwatch`、`Following`/`Watching`、`Watchers`/`Followers`                                | `global`、`pages/repo`                    |
| D-2  | 中   | 术语不一致：`GitHub Apps`（应用/应用程序）、`Scheduled reminders`（定时/定期）、`On`/`Off`（开启/关闭 vs 开/关）                     | 多模块                                    |
| D-3  | 中   | 约 15 组「上游改文案 / 节点边界变更后旧键未清理」的双登记                                                                            | `pages/settings`、`marketing`、`profile`… |
| D-4  | 低   | `pages/discussions` 是 0 键 0 译文的空壳模块                                                                                         | `canonical.jsonc:1276`                    |
| D-5  | 低   | 一条译文以未闭合全角 `（` 结尾                                                                                                       | `locales/zh-CN/pages/repo-settings.jsonc` |
| D-6  | 中   | 单 token 键 391 槽位 / 354 唯一（18.7%），其中 24 个小写常用词（真机未观测到误伤）                                                   | 词典整体                                  |
| E-1  | 中   | **自审**：保留名单漏 7 条真实路径（`/copilot`、`/import`、`/projects`、`/packages`、`/advisories`、`/security-advisories`、`/gist`） | `core/modules.jsonc`                      |
| E-2  | 中   | **自审**：键形态门禁漏「长度上限」条件（663 字符键能过门禁但引擎永不查表）                                                           | `tooling/checks/dict.ts`                  |
| E-3  | 低   | **自审**：产物集合断言无法发现同名入口互相覆盖                                                                                       | `tooling/pipeline/build.ts`               |
| E-7  | 低   | **自审**：`popup.html` 版本号门禁的正则会被单引号/无引号写法绕过，且会误命中注释里的假元素                                           | `tooling/checks/manifest.ts:73`           |
| E-4  | 低   | 时间线失实：文档把 `verify` 脚本的删除归因到 `48bf519`，实为 `8001d9f`                                                               | `AGENTS.md:73`、`development.md:377`      |
| E-5  | 低   | 同键异译举例过期（漏 `pages/settings`、`pages/wiki`）                                                                                | `development.md:70`                       |
| E-6  | 低   | 目录树不完整（测试文件位置错、缺 `src/shared/text.ts`、`ja/pages/issues.jsonc`）                                                     | `development.md:9-50`                     |
| F-1  | 低   | zip 不可复现（实测两次 SHA256 不同；JS 产物可复现）                                                                                  | `pipeline/pack.ts`                        |
| F-2  | 低   | `pack.ts` 无条目数/体积上限、crc32 重复计算、不拒 symlink                                                                            | `pipeline/pack.ts`                        |
| F-3  | 低   | `EXCLUDE_SELECTOR` 不含 `[contenteditable]`（静态；未观测到实例）                                                                    | `content/filters.ts:8-30`                 |
| F-4  | 低   | popup 异步初始化可能用旧值覆盖在途操作（静态推断）                                                                                   | `popup/popup.ts:150-182`                  |
| F-5  | 低   | `data-disable-with` 只对按钮类 `<input>` 生效，而 GitHub 登录按钮是 `<button>`                                                       | `walker.ts:33-39`                         |
| F-6  | 低   | `identity` 标记 `configurable: true`，可被静默覆盖                                                                                   | `content/index.ts:29-32`                  |
| F-7  | 低   | ja 的 `Explore → 探索` 与 zh 同形                                                                                                    | `locales/ja/global.jsonc`                 |
| F-8  | 低   | 「446 条规则」口径未说明「同一页面最多 7 条生效」                                                                                    | 文档                                      |

---

## 3. 重点发现详述

### A-1 / A-2 页面级覆盖率与营销导航缺口（高）

**实测（19 页，可翻译文本节点）**：

| 页面                             | 命中/可翻译   | 覆盖率    |
| -------------------------------- | ------------- | --------- |
| `/octocat`                       | 186/622       | **29.9%** |
| `/orgs/microsoft`                | 131/376       | 34.8%     |
| `/topics/javascript`             | 146/416       | 35.1%     |
| `/marketplace`                   | 114/229       | 49.8%     |
| `/search`                        | 147/285       | 51.6%     |
| `/`（未登录）                    | 143/277       | 51.6%     |
| `/microsoft/vscode/wiki`         | 145/255       | 56.9%     |
| `/microsoft/vscode`              | 213/350       | 60.9%     |
| `/microsoft/vscode/issues`       | 176/282       | 62.4%     |
| `/microsoft/vscode/commits/main` | 212/339       | 62.5%     |
| `/microsoft/vscode/pulls`        | 160/236       | 67.8%     |
| `/microsoft/vscode/branches`     | 153/184       | 83.2%     |
| `/microsoft/vscode/releases`     | 255/298       | 85.6%     |
| `/features`                      | 313/364       | 86.0%     |
| **合计**                         | **3265/5483** | **59.5%** |

**这些漏翻里大部分是「不该翻」的**：提交信息、仓库描述、议题标题、用户名、语言名（`TypeScript`/`C++`/`Rust`）、文件名。**但下面这一批是明确该翻却没收录的 UI 文案**：

在 **17 个页面**上同时缺失（GitHub 营销导航的三个下拉菜单，路径为 `ul.NavGroup-module__list… > a.Primer_Brand__Link-module__Link`）：

```
GitHub Copilot   GitHub Copilot app   MCP Registry   GitHub Advanced Security
DevSecOps        DevOps               AI             GitHub Skills
GitHub Sponsors  Security Lab         GitHub Stars   Archive Program
Copilot for Business
```

在 4–8 个页面上缺失：`Copilot`（8 页）、`Roadmap`（5 页）、`Team`、`GitHub CLI`、`GitHub Desktop`、`GitHub Mobile`、`GitHub Marketplace`、`The ReadME Project`（各 4 页）。

同样属于「未收录但明确是 UI」的还有：登录页的 `Continue with Google` / `Continue with Apple` / `Continue with passkey` / `Sign in with a passkey` / `New to GitHub?` / `Contact GitHub Support` / `Waiting for input from browser interaction...`；首页的 `Sign up for GitHub` / `Enter your email` / `Plan` / `Collaborate` / `Automate` / `Secure`；仓库页的 `Open commit details` / `Dependency graph` / `GitHub Actions` / `GitHub Packages`；文件页的 `Copy path` / `More file actions` / `File metadata and controls` / `Edit and raw actions`；placeholder 类的 `Find a repository…` / `Find a release` / `Search in GitHub Marketplace`。

**为什么门禁发现不了**：`check:dict` 的覆盖率分母是 `canonical.jsonc` 自己，**登记过的都翻了 → 100%**。一个从未登记的新文案不会进入分母。这不是门禁的 bug，而是**指标的口径盲区**：现有门禁能保证「不出错」，不能保证「不漏」。

**建议**（按性价比排序）：
1. 把上述 13 条营销导航文案与 8 条共现文案补进 `global`（它们出现在每个页面上，收益最高）；
2. 把「实机漏翻采样」变成有节奏的动作（本轮的真机脚本可直接复用：无头 Edge + CDP 采集 → 喂给 `translateText` + 该路径的 `buildView`）；
3. 考虑在文档里明确「词典侧 100% 与页面级覆盖率是两个指标」，避免误读。

### A-3 profile 图表 tooltip（中，一条规则覆盖 365 条）

实测 `/octocat` 页面上 `No contributions on September 21st.`、`…September 28th.` 等**同形态文本节点共 365 条**（贡献日历每个格子的 tooltip），全部漏翻。它们是普通文本节点（非排除容器），**一条规则即可覆盖**：

```jsonc
{
	"id": "profile/no-contributions-on",
	"pattern": "^No contributions on (?<date>.+)\\.$"
}
```

这也是 `/octocat` 只有 29.9% 的主要原因之一（该页 436 条漏翻里这类占大头）。

### B-1 组织页没有归属模块（中）

实测 `/orgs/microsoft` 命中的模块序列是 **`[global]`**（`pages/profile` 的单段路由 `^/[^/]+$` 匹配不到两段的组织页，`pages/repo` 又被上一轮的保留名单排除了 `orgs`）。后果是这 17 条**已经收录在 `pages/profile` 里**的词条在组织页上完全用不上：

```
People  Sponsoring  Sources  Mirrors  Select language  Select order  Last updated
View all repositories  Top languages  Most used topics  Projects  Packages
GitHub Sponsor  Developer Program Member  We've verified that the organization
Learn more about verified organizations  …
```

**建议**：把 `pages/profile` 的路由扩成 `^(?:/[^/]+|/orgs/[^/]+)$`（或新建 `pages/orgs` 模块复用同一批词条）。组织页与用户主页的 UI 高度重合，复用的性价比很高。

### B-3 模块粒度带来的 45 条漏翻（中，取舍型）

实测 **45 条**「canonical 里有、译文也有，但提供它的模块在该路径不命中」的文案，典型：
- `Actions` → 提供者是 `pages/settings` / `pages/repo-settings` / `pages/repo`，却在 8 个页面（营销导航里）漏翻；
- `Code`（3 页）、`Projects`（2 页）、`Features`（4 页）、`About`、`Packages`、`Name`、`Languages`、`Home`、`Merge pull request`、`Search Issues`…

这不是 bug，而是「按页面模块切分词典」的固有代价：同一句文案出现在多个页面时，只有登记过的那个页面能翻。**修法有张力**：把这类词条下沉到 `global` 能立刻修好漏翻，但会**扩大单 token 键的站点级误伤面**（见 D-6）。属于需要权衡的设计决策，不建议无脑下沉。

### C-1 属性观察缺口（中；实测部分证实、部分推翻）

**静态事实**：`walker.ts:15-26` 会改写 **6** 个属性（`title`/`aria-label`/`placeholder`/`alt`/按钮类 `value`/`data-disable-with`），而 `engine.ts:38-39` 的 `attributeFilter` 只观察 **2** 个（`value`/`data-disable-with`）。

**我的实测**（真机加载扩展，构造页面）：

| 步骤                            | `aria-label` | `title` | `placeholder` | `alt` | `value`                       |
| ------------------------------- | ------------ | ------- | ------------- | ----- | ----------------------------- |
| ① 首轮翻译                      | 星标         | 星标    | 搜索          | 星标  | 下载 ZIP                      |
| ② 页面**就地**改回英文后        | Star         | Star    | Search        | Star  | **下载 ZIP**（被观察 → 重翻） |
| ③ 再触发一次普通 childList 变更 | 星标         | 星标    | 搜索          | 星标  | 下载 ZIP                      |

**结论**：观察缺口**成立**（② 证明这 4 个属性不会立即重翻）；但**「只有整页刷新能恢复」不成立**——③ 证明任何祖先子树的下一轮 flush 会把它们一起重扫重翻。由于 GitHub 页面持续产生 mutation，现实影响通常是「短暂显示英文」，而不是永久失效。严重性定为**中**。
**建议**：把 `attributeFilter` 派生自 `TRANSLATABLE_ATTRS`（并在测试里断言二者一致），或接受这一取舍并在注释里写清。

### C-2 漏翻日志静默截断（中）

`collector.ts:14-16`：`BUFFER_CAP = 300`、`MISS_LOG_CAP = 500`；`:62` 与 `:117` 两处超限都**直接丢弃且不计数**。`popup.ts` 显示的是 `misses.length`，所以**面板会永久停在 500**，用户无法区分「正好 500 条」与「被截断」。由于开发者模式是当前**唯一**的采集通道（自动探针已于 `48bf519` 删除且未重建），「先到先得」意味着**第一个页面的漏翻会占满配额，后续页面一条都进不来**。

**建议**：落盘时附带 `dropped` 计数并在 popup 显示「另有 N 条超出上限未记录」；或按 `path` 分层保留。

### C-3 `bootstrap()` 无兜底（中）

`content/index.ts:47-51,75`：`await Promise.all([readEnabled(), readDevMode(), readLocale()])` 之后才 `engine.start()`，而入口是 `void bootstrap();`——**没有 `.catch`**。storage 读失败（配额、被清除、扩展上下文失效）会让扩展**完全不翻译且没有任何提示**。popup 侧已经有 try/catch（上一轮加的），content 侧没有。
**建议**：`void bootstrap().catch((error) => console.error(...))`，并让 storage 读取失败时回退到默认值（`true` / `null` / `false`）。

### C-4 计数灌水（中）

`upsertMiss` 对已存在的键 **每次调用都 `count + 1`**，而 `recordText` 在每个未命中节点上、**每一轮 flush 都会调用一次**；任何一次 DOM 变更都会让祖先子树被重扫。子代理用计数桩实测出 **7.00×** 的灌水（200 个文案 → 1,400 次调用）。后果：导出的漏翻 JSON 里 `count` 是「被扫描次数」而非「出现次数」，`sortMisses` 按 count 排序会把真正新出现的漏翻压到列表底部。
**建议**：walker 层按 `(node, value)` 做 `WeakMap` 记忆化（这也是上一轮 L-01 的同一根因，本轮把它从「性能观察」升格为「数据污染」）。

### D-1 语义塌缩（中）

实测（`bun` 脚本逐键核对）：

| 英文键                   | 译文                | 问题                                                                       |
| ------------------------ | ------------------- | -------------------------------------------------------------------------- |
| `Follow` / `Watch`       | 关注 / 关注         | GitHub 的 Follow（关注人）与 Watch（订阅仓库动态）**是两个动作**，中文同形 |
| `Unfollow` / `Unwatch`   | 取消关注 / 取消关注 | 同上                                                                       |
| `Following` / `Watching` | 正在关注 / 正在关注 | 同上                                                                       |
| `Followers` / `Watchers` | 关注者 / 关注者     | 同上                                                                       |

**建议**：`Watch` 系改为「订阅/停止订阅」，`Following` 系保留「正在关注」。

### D-3 上游改文案后的双登记（中）

实测同一模块内「不同英文键 → 同一中文」的高价值簇（共 60 组同值，下面是要清理的）：
- `pages/settings`：`Changing your username can have` + `your username can have`；`Emails` / `on Email` / `Email`；`on GitHub` + `On GitHub`；`Sync with system` + `Follow system`；`Enable` + `Enabled`
- `pages/settings-billing`：`…free Actions usage, see` + `…free Actions usage,`
- `pages/repo-settings`：`Find people or a team...` + `Find people or a team…`（上游把 `...` 换成了 `…`）
- `pages/marketing`：`Pages and Wikis` + `Pages and wikis`、`Audit log API` + `Audit Log API`、`GitHub Security Advisories` + `GitHub security advisories` 等 **8 组纯大小写变体**
- `pages/profile`：`January` + `Jan` 等月份全称/缩写（这个是**有意**的，两种形态实机都存在）

**建议**：删掉不再出现的旧形态，或改用 `core/aliases.jsonc`（该通道至今为空）把旧文案指向规范键——这正好是 aliases 机制设计出来要解决的场景。

### D-6 单 token 键面与真机撞车实测（中，但**未观测到实际误伤**）

静态量化：**391 槽位 / 354 唯一键**是「纯字母无空格的单 token」（占 2091 的 18.7%），其中 `global` 提供 141 个（站点级生效）；**24 个小写开头的常用词**风险最高：

```
and  budget  by  commented  commit  commits  context  descending  discounts
feedback  followers  following  forever  from  merged  opened  organization
pinned  published  remaining  results  selection  settings  updated
```

**真机实测（19 个页面，这是上一轮无法做的）**：
- 这 24 个键里**只有 5 个真的命中过**：`opened`（议题状态片段）、`descending`（排序）、`followers`、`following`（主页统计标签）、`forever`（定价页）——**全部是正常 UI 文案**；
- **19 个从未命中**（`and`/`by`/`from`/`commit`/`commits`/`merged`/`updated`/`published`/`settings`/`results`…）；
- 19 个页面的全量命中里，**没有一例用户内容被误翻**；文件/目录名（`src`/`test`/`build`/`extensions`…）确实是孤立文本节点，但都没有被翻译（因为小写常用词没收录）。

**结论**：`AGENTS.md` 硬性约束 3 的权衡**在实机成立**；风险是条件性的（需要某个仓库/目录/用户名恰好等于键）。建议把上面 24 个键逐个复核一遍（尤其 `by`/`from`/`updated`/`published`），而不是批量下沉到 `global`。

### E-1 / E-2 我上一轮修复的残留漏洞（自审，中）

**E-1 保留名单不完备**：用真实 GitHub 顶层路径逐个试，仍有 10 条被过度命中，其中 **7 条是真实的非用户页面**：

```
/copilot  /import  /projects  /packages  /advisories  /security-advisories  /gist
（/hooks、/keys、/git-lfs 也在名单外，但 /git-lfs 是真实组织名，本就不该排除）
```

它们会命中 `pages/profile`，把那 149 条词条注入进去——与上一轮修的 H-04 是同一类问题，只是量级更小。**根因是静态 deny-list 不可能完备**：GitHub 会不断新增产品路径。
**建议**：把上述 7 条补进两份名单，并把「新增 GitHub 产品路径时同步名单」写进文档的维护约定（`development.md` 已有一节，补充这条即可）。

**E-2 键形态门禁漏长度条件**：`isTranslatableText` 有 `MAX_TEXT_LENGTH = 500`（`filters.ts:52`），**超过 500 字符的键在引擎里走不到查表那一步**。我上一轮加的门禁只断言 `normalizeKey(键) === 键`，**不检查长度**：

```
663 字符的键 → validateCanonicalKeys 放行；isTranslatableText = false（永不命中）
当前最长规范键 325 字符 < 500 → 目前无现网影响
```

**建议**：在 `validateCanonicalKeys` 里直接断言 `isTranslatableText(key)`（而不只检查长度）——这样将来 `isTranslatableText` 新增任何条件都会自动被门禁继承。

### E-7 版本号门禁的正则缺口（自审，低）

`manifest.ts:73` 用正则 `class="[^"]*\bversion\b[^"]*"` 提取 popup.html 里的版本号元素。实测各种写法：

| popup.html 写法                                         | 门禁行为                  |
| ------------------------------------------------------- | ------------------------- |
| `<span class="version">0.2.0</span>`                    | ✓ 正常识别                |
| `<span class="badge version">9.9.9</span>`              | ✓ 正常识别                |
| `<span class='version'>9.9.9</span>`（单引号）          | ✗ **未识别 → 校验被跳过** |
| `<span class=version>9.9.9</span>`（无引号）            | ✗ **未识别 → 校验被跳过** |
| `<!-- <span class="version">9.9.9</span> -->`（注释里） | ⚠ **被当成真元素 → 误报** |
| CSS 里的 `.version { … }`                               | ✓ 不误命中                |

**影响**：该门禁是防御性的（理论上防「改了 package.json 忘了改 popup.html」），当前 popup.html 用的是双引号标准写法，所以**没有现网影响**；但绕过形态存在，且注释会误报。**建议**：直接断言 popup.html 里存在 `class="version">${packageVersion}<` 这个精确串（或同时兼容两种引号），比正则更严格也更简单。



### E-4 时间线失实（低但明确）

`AGENTS.md:73` 与 `docs/guides/development.md:377` 说「`tooling/verify-live.ts` 与 `package.json` 的 `verify` 脚本都已在 `48bf519` 删除」。实测 `git show 48bf519:package.json` 里**仍有** `"verify": "bun tooling/verify-live.ts"`；该脚本是 **`8001d9f`**（本轮修复）才删的（`git log -S'"verify"' -- package.json` 证实）。事实状态（现在都不存在）只是归因错了一个提交。

### F-1 zip 不可复现（低，实测）

连续两次 `bun run build && bun run pack`：

```
zip 第一次 SHA256  08740BDC…E652C
zip 第二次 SHA256  C994577B…133B66   ← 不同
dist/content.js 两次 SHA256 完全相同  ← JS 产物可复现
```

zip 条目时间戳取的是当前时刻（`ZipFile` 读出 09/27/2026 00:19:02），所以商店包不可复现，第三方无法「用源码重建出同一个包」来核验发布物。**建议**：给条目写固定时间戳（如 `1980-01-01` 或源码仓库的提交时间），实现可复现打包。

### F-5 `data-disable-with` 的设计缺口（低，有真实 HTML 证据）

抓取真实的 `https://github.com/login` HTML 可见：

```html
<button ... class="btn btn-primary btn-block js-sign-in-button"
        data-disable-with="Signing in…" data-signin-label="Sign in" ...>
```

而 `walker.ts:120-124` 的守卫要求 `data-disable-with` 只作用于**按钮类 `<input>`**（`isButtonInputValue` 检查 `tagName === "INPUT"`）。**GitHub 的登录/OAuth 按钮是 `<button>`**，所以 `Signing in…`、`Continuing with Google...`（实测 7 条）**永远不会被翻译**，提交期间会闪英文。
**建议**：把 `data-disable-with` 的目标放宽到 `<button>`（它是 Rails 的提交期替换文案，语义与 `<input value>` 完全相同；只翻文本不改结构，风险可控），或在文档里明确这是有意不为。

---

## 4. 已排除 / 证伪清单（本轮实测，避免后续重复调查）

| 疑点                                                          | 结论                                                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 词典里存在「引擎够不到的键」（除已修的长度类）                | **否**。2091 条键逐条跑 `isTranslatableText` **全部通过**；最长键 325 字符 < 500；无「无拉丁字母 / 含非拉丁字母 / 纯符号」的漏网                                                                       |
| 同模块内规则互相遮挡（不完全相同但后者被覆盖）                | **不存在，且可证明**：446 条 pattern **全部 `^…$` 双端锚定** ⇒ 同模块内不同 pattern 的匹配集互斥；同模块重复 pattern 0 条；2,454 条候选串 pairwise 子集检测 **0 对**                                   |
| 规则 pattern 过度宽泛 / ReDoS                                 | **否**。`.*`/`.+` 结尾 0 条；单关键词 pattern 2 条（`^now$`/`^yesterday$`）且完全锚定；最可疑的两条多贪婪捕获组规则在 500 字符不匹配输入下耗时 ≤0.03 ms                                                |
| `#flush` 抛错会让引擎永久自锁                                 | **证伪**。`engine.ts:69` 的 `#flushScheduled = false` 在函数首行，人为让 `getView()` 抛错后下一次 mutation 仍能正常翻译                                                                                |
| `#pending` 去重失效                                           | **证伪**（一批 `[parent, child, text, parent]` 只产生一次根级遍历）                                                                                                                                    |
| 属性若允许走正则规则会提升覆盖率                              | **否，实测 0 收益**。`title`/`aria-label` 的 885 条漏翻里**没有一条**能被现有规则命中（日期 tooltip 带时刻与时区，规则形态是 `^Sep 26, 2026$`），所以「放开属性走规则」不是有效建议                    |
| 词典数据有机械字符串替换痕迹                                  | **否**。重复词 `\b(\w+)\s+\1\b` 0 条、`your your`/`other your` 0 条、译文以纯标点构成 0 条                                                                                                             |
| 汉字/假名与半角拉丁数字之间缺空格                             | **0 条**；反向（有空格）437 条，约定执行一致                                                                                                                                                           |
| 中英标点混用                                                  | **0 条真缺陷**：中文句中的半角逗号全是千分位（`10,000`），半角句号全是域名/版本号/金额                                                                                                                 |
| 产物里有 ESM / 网络请求 / 危险 API                            | **否**：`content.js`/`popup.js` 均以 `(() => {` 开头，无顶层 import/export、无动态 import、无 sourceMappingURL、无 `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon`/`eval`/`new Function`/`innerHTML` |
| `dist` 与 `public` 不一致                                     | **否**：9 个 public 文件逐字节一致                                                                                                                                                                     |
| zip 结构损坏                                                  | **否**：11 条目，中央目录自洽，**11/11 CRC 用我独立实现的 CRC32 复算一致**，条目字节与 `dist/` 完全一致，`manifest.json` 在根目录，无重复条目                                                          |
| 上一轮新增的门禁是「摆设」                                    | **否，端到端反证通过**：把换行键塞回 canonical → `check:dict` 立刻报「键必须是引擎归一化后的形态」；删掉 `_locales/zh_CN` 的 `$COUNT$` → `check:manifest` 立刻报「缺少占位符」                         |
| 真机误伤（用户内容被翻）                                      | **19 页扫描零命中**（详见 D-6）                                                                                                                                                                        |
| 两份保留名单是否一致（只改一处会留单侧越界）                  | **一致**：`pages/profile` 与 `pages/repo` 的负向前瞻逐字符相同（各 37 条）                                                                                                                             |
| 保留名单是否误伤真实账号                                      | **否**：`torvalds`/`microsoft`/`google`/`git-lfs`/`nodejs`/`rust-lang`/`octocat`/`vuejs`/`vercel`/`github` 十个真实账号无一被排除                                                                      |
| 「缺键语言跳过占位符比较」是否留漏洞                          | **否**：`validateLocales` 先断言各语言消息键集合完全相等（缺键即报错），占位符比较只在键齐全的语言间进行                                                                                               |
| `msg()` 降级返回消息键是否会被持久化或参与比较                | **否**：9 处调用全部流向 `textContent` 与 `document.title`，只在显示层（最坏是显示一个未本地化的键名）                                                                                                 |
| 页面测试用软失败加载器（`src/dict/index.ts`）是否会让测试空转 | **部分**：词典模块编译失败时反向断言（`expect(null)`）仍会通过，但**同一文件的正向断言会先失败**，整体仍能拦住；若后人删掉正向断言，测试会退化成空转                                                   |

---

## 5. 与上一份报告的对照

| 上一轮结论                                                              | 本轮状态                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 `SECURITY.md` 是 Koishi-CE 的内容                                  | **已修**（`8001d9f`）；本轮复核：版本线/攻击面/范围划分正确，全仓无 Koishi 痕迹（唯一残留 `settings-billing.test.ts` 的 `"Koishi-CE"` 是测试数据）                                                                   |
| H-02 换行键永不命中                                                     | **已修**且**真机复验**：`/pulse` 说明句两种节点形态都能译出                                                                                                                                                          |
| H-03 伪键 + 语法不通的碎片                                              | **已修**且**真机复验**：拼接结果「你可以 @mention 你公司的 GitHub 组织来链接它。」                                                                                                                                   |
| H-04 `pages/repo` 注入 `/settings/**`                                   | **已修**且**真机复验**：设置页上的 `Code Clone Download ZIP` 保持英文                                                                                                                                                |
| H-05 CI 不跑 build                                                      | **已修**（`ci.yml` 有 `bun run build` + `permissions` + SHA pin）                                                                                                                                                    |
| M-01…M-09                                                               | 均已落地；本轮核对了 M-04/M-08 的成效，并新增 7 个测试文件（257→259 用例）                                                                                                                                           |
| 「视图快照 17 个碰撞键 / 2 个随路径变化的真同键异译（Actions、Pages）」 | **口径已变**：修掉越界后是 **16 个碰撞键 / 37 条记录，只有 `Pages` 的胜出者随路径变化**。`Actions` 的两种译法仍在（`pages/repo`「操作」vs `pages/settings`/`repo-settings`「Actions 工作流」），但不再共存于同一路径 |
| 「L-01 walker 无记忆化：结构性观察，无法量化」                          | **本轮量化**：同一根因导致漏翻计数灌水 7×（见 C-4），并从「性能」升格为「数据质量」                                                                                                                                  |
| 「L-06 `action.default_title` 可能是裸占位符，待实机确认」              | **已推翻**（`chrome.action.getTitle()` → 「GitHub 界面本地化」）                                                                                                                                                     |
| 「L-09 zip 非可复现、无上限校验」                                       | **本轮实测确认**：两次打包 SHA256 不同；`pack.ts` 无条目数/体积上限校验                                                                                                                                              |

---

## 6. 开放项（受环境限制，本轮未能覆盖）

| 开放项                                                   | 原因/确认方式                                 |
| -------------------------------------------------------- | --------------------------------------------- |
| `/owner/repo/settings`、`/settings/**` 的**登录后**界面  | 需登录；本轮只能测到未登录重定向后的 `/login` |
| `/notifications` 登录后的通知中心                        | 同上                                          |
| `contenteditable` 富文本容器是否真的存在于 GitHub（F-3） | 需登录进入评论/编辑器场景                     |
| C-1 的属性就地改写**发生频率**                           | 需要长时间实机观察 React/Turbo 的重渲染模式   |
| C-2/C-3 在多标签页、storage 配额耗尽下的真实表现         | 需要构造真实浏览器环境                        |
| 商店审核状态、真实用户的误伤反馈                         | 仓库外信息                                    |

---

## 7. 建议的修复顺序

**第 1 批（收益最高，成本低）**
1. A-2：把 13 条营销导航文案 + 8 条共现文案补进 `global`；
2. A-3：加一条 `profile/no-contributions-on` 规则（覆盖 365 条/页）；
3. E-2：`validateCanonicalKeys` 断言 `isTranslatableText(key)`；
4. E-4/E-5/E-6：修正文档的归因、举例与目录树。

**第 2 批（结构）**
5. B-1：让 `pages/profile` 也覆盖 `/orgs/<组织>`；
6. E-1：补齐 7 条保留路径，并把维护约定写进文档；
7. C-2：漏翻日志加 `dropped` 计数并在 popup 显示；
8. C-1：`attributeFilter` 派生自 `TRANSLATABLE_ATTRS`（配测试断言）；
9. C-3：`bootstrap()` 加 `.catch`。

**第 3 批（数据与卫生）**
10. D-1/D-2：统一 `Watch` 系、`GitHub Apps`、`Scheduled reminders`、`On`/`Off`；
11. D-3：清理 15 组双登记（优先用 `aliases` 通道，顺带给它开张）；
12. D-6：逐个复核 24 个小写单 token 键；
13. D-4/F-5/F-1：空壳模块定调、`data-disable-with` 是否放宽到 `<button>`、zip 可复现化。

---

## 8. 审计声明

- 本轮审计**只读**：未修改仓库任何受版本控制的文件（`git status` 全程干净）；所有一次性脚本写在系统临时目录（`%TEMP%\i18n-*.ts`），未进仓库。
- 真机审计使用 Edge 154 无头模式 + CDP，加载的是**当前工作区构建出的 `dist/`**；采集对象是未登录状态下的 19 个公开页面，因此登录后才出现的界面（设置页、通知中心、仓库设置）不在覆盖范围内（见第 6 节）。
- 本轮结论分为三类并逐条标注：**实测**（附命令/实验输出）、**静态推断**（读代码得出，未实机验证）、**无法核实**。
- 所有「子代理提出、我复核后修正」的地方均已在新报告中采用修正后的口径（例如 `1 star` 那条建议，实测证明删键会让译文从「1 个星标」退化成「1 星标」，故**不采纳**）。
