# P1 菜谱库版本管理

## 存储与兼容

菜谱正文支持中英动词（解析期归一到中文 canonical）；库内建议 freeze 后用归一正文便于 diff。

根目录为 `$WEBCLAW_HOME/recipe-library/`（默认 `~/.webclaw/recipe-library/`）：

```text
recipe-library/
  fuel/
    environments.json                  # 共享环境绑定，不复制菜谱正文
    versions/
      1/
        metadata.json                  # name/version/tags/parameters/read_only/hash
        recipe.webclaw                 # 保留 {{base_url}} 模板
      2/
        metadata.json
        recipe.webclaw
```

- 版本采用正整数递增：`1 → 2 → 3`；不支持 semver，省略 `version` 自动升版。
- 每版有 `name`、`version`、`tags`、`parameters` 默认值、`read_only: true`、创建时间（Asia/Shanghai）和正文 SHA-256。
- 已发布版本不可覆盖；API/CLI 拒绝重复版本。文件只读权限防误写，读取时校验正文 hash。
- 只读不是对本机文件所有者/root 的安全沙箱；人为改文件会触发 hash 错误，不提供签名审计。
- 发布使用 Linux `flock` + 临时目录原子改名，避免并发丢版。
- 原 `$WEBCLAW_HOME/recipes/*.webclaw` **保持不变**；旧 `webclaw_freeze` / `recipe_path` 仍可用。
- `webclaw_list_recipes` 与 `webclaw_recipe_list` 共用 `RecipeLibrary.list()`，合并平铺与全部不可变版本，不依赖 lite 启动。
- 统一列表在 `data.recipes`；每条有 `name`、`id`（如 `fuel@1`）、`source="library"|"flat"`、`version`、`tags`、`parameters_summary`（占位符名/默认值的键名，不含环境参数值）。旧文件标 `version="legacy"`，保留 `path/title/bytes/mtimeMs`；同名平铺与版本条目不会互相覆盖。
- 旧 `webclaw_list_recipes` 的 `data.stdout_tail` 已 deprecated，仅为旧 Host 保留 `type="recipes"/items` JSONL 兼容视图；大库可能截尾，程序应读完整 `data.recipes`。`get` 的既有 `source="versioned"` 不变。
- `get fuel`：有新版取最新，无新版回退平铺；`fuel@1` 固定版本；`fuel@legacy` 显式读取旧文件。

## 一次发布、跨环境回放

模板 `recipes/fixture-library.webclaw`：

```text
打开{{base_url}}/table.html，等待{{wait_seconds}}，采集表格
```

参数优先级：**版本默认值 < 环境绑定 < 单次调用覆盖**。
环境绑定可独立更新，历史正文不变；因此 `name@1 + env` 本身不冻结配置，运行结果附模板 `sha256` 与 `rendered_sha256` 供比对。完整可重复部署需另行保存环境配置快照。

CLI（仅标准库，支持 `publish` / `freeze` 别名）：

```bash
cd /workspace/webclaw-x
export WEBCLAW_HOME=/tmp/webclaw-recipe-demo

.venv/bin/python -m webclaw_x.recipe_library publish fuel \
  --file recipes/fixture-library.webclaw --tags fixture,table \
  --params '{"wait_seconds":"2"}'

# 再发布一次为 v2（正文可以修改后发布；v1 不变）
.venv/bin/python -m webclaw_x.recipe_library freeze fuel \
  --file recipes/fixture-library.webclaw --params '{"wait_seconds":"1"}'

.venv/bin/python -m webclaw_x.recipe_library bind-env fuel fixture \
  --params '{"base_url":"http://127.0.0.1:8765"}'
.venv/bin/python -m webclaw_x.recipe_library bind-env fuel mes-test \
  --params '{"base_url":"https://mes-test.example.invalid"}'

.venv/bin/python -m webclaw_x.recipe_library list
.venv/bin/python -m webclaw_x.recipe_library get fuel@1 --env fixture
.venv/bin/python -m webclaw_x.recipe_library diff fuel@1 fuel@2
```

`diff` 只比较步骤正文；如果仅默认参数或标签不同，正文 diff 为空，分别 `get` 查看 metadata 即可。

## MCP 工具

| 工具 | 功能 |
|------|------|
| `webclaw_recipe_publish` | 发布下一版，参数为 name/recipe/tags/parameters(JSON)/可选 version |
| `webclaw_recipe_list` / `webclaw_list_recipes` | 统一发现版本与平铺条目，返回 `data.recipes` |
| `webclaw_recipe_get` | reference=`name@version`；可选 environment/parameters(JSON) |
| `webclaw_recipe_bind_env` | name/environment/parameters(JSON)；不复制正文 |
| `webclaw_recipe_diff` | left/right 两版正文差异 |
| `webclaw_run` | 新增 recipe_ref/environment；与 recipe/recipe_path 互斥 |

回放示例：

```text
webclaw_run(recipe_ref="fuel@1", environment="fixture", params_confirmed=true)
```

`params_confirmed` 现在由网关强制检查，不再只是 Host 提示：正文、路径（包括平铺 stem）、版本引用的**渲染前正文**含 `{{...}}` 且未确认，返回 `PARAMS_UNCONFIRMED` 与 `data.pending_parameters` 名单，绝不启动 lite。即便库默认值/环境绑定已齐全也要先让用户确认；确认后传 `params_confirmed=true`。不含占位符无需此标志。它不是用户身份凭证，不能替代 Host 真实征求确认；不允许借此传密码。

路径菜谱读取一次并通过 stdin 执行同一快照，避免检查后文件变化绕过门禁。参数缺失仍由原库/运行时规则校验；`params_confirmed=true` 不会给缺失参数补值。

整个渲染后的菜谱通过一次 stdin 交给原 runtime；不做逐步 probe，HITL 仍走同一续跑通道。`recipe_version` 包含选中版本/环境与渲染 hash。

## 安全规则与错误码

- 拒绝明文密码/验证码、常见 token/API key 参数、URL 内嵌账号密码，以及 secret 类占位符。
- 新库不承载秘密：登录使用 runtime 账号金库，验证码走 HITL。过滤属于常见模式检查，不是任意文本的完整 DLP；不要尝试把秘密改名后写入。
- 参数必须为字符串 JSON 对象，缺少模板字段返回 `RECIPE_MISSING_PARAMS`，不带残缺模板执行。
- 环境绑定是受信任的菜谱配置，不是任意不可信文本沙箱；不要将页面内容直接当作 env 参数。
- `mes-test` 只是环境名，不自动放开站点。渲染 URL 继续经过 Rust 白名单，未列入仍返回 `POLICY_DENIED`。
- 旧平铺文件不迁移/不修改；新库 API 发现旧文件有秘密时拒绝输出/执行。旧工具维持原行为，需额外治理旧库。

主要错误码：`RECIPE_VERSION_EXISTS`、`RECIPE_NOT_FOUND`、`RECIPE_ENV_NOT_FOUND`、`RECIPE_MISSING_PARAMS`、`RECIPE_SECRET_REJECTED`、`RECIPE_INTEGRITY_ERROR`、`RECIPE_INVALID_ARGS`。

## 验收

```bash
cd /workspace/webclaw-x
.venv/bin/python scripts/eval_recipe_lib.py  # eval/out/recipe-library.json
.venv/bin/python scripts/eval_smoke.py       # 所有 pytest 回归
.venv/bin/python scripts/eval_components.py
.venv/bin/python scripts/eval_policy.py
```

含两版发布/list/get/diff、并发升版、只读/hash、旧库兼容、跨环境模板、敏感信息拒绝、真实 fixture 回放，以及环境无法旁路域名策略。

菜谱库本身不改 Rust；后续 Host 契约加固增加了 lite 结构化错误码，已重新编译，回滚见 `patches/ROLLBACK.md` 的 Host 契约小节。

## 已落盘的演示库

本次构建了不含秘密的独立演示目录，未写入原 `~/.webclaw/recipes/`：

```bash
cd /workspace/webclaw-x
.venv/bin/python -m webclaw_x.recipe_library --home eval/library-demo list
.venv/bin/python -m webclaw_x.recipe_library --home eval/library-demo get fuel@1 --env fixture
.venv/bin/python -m webclaw_x.recipe_library --home eval/library-demo diff fuel@1 fuel@2
```

演示摘要：`eval/out/recipe-library-demo.json`。fixture 使用占位端口 8765，回放前需启动本地站点或修改该环境绑定；mes-test 为 `.invalid` 示例且仍被白名单拒绝。

## 菜谱库初次验收（历史）

- 菜谱库专项：18 passed
- L1 全量：39 passed，0 failed / xfailed / skipped
- Component Pack：2 passed
- Policy/HITL：11 passed
- L2 MCP stdio：3 passed

## Host 错误码契约加固

lite 的失败 `done` 新增 `error_code`，保留实际失败步骤原因，而不是仅返回“失败 N 步”；probe 失败也输出 `type="error"/error_code`。MCP 优先读取 `done.error_code`，再读结构化 error/step_fail，最后才兼容旧版 ASCII 标记/中文歧义日志。`POLICY_DENIED`、`AMBIGUOUS_TARGET`、`TIMEOUT` 可独立处理；未知码保守落 `RUN_FAILED`。CDP 传输超时在源头标 `TIMEOUT`，网关 watchdog 的 TIMEOUT 优先级最高。未标注的历史步骤超时仍可能是 `RUN_FAILED`，不对全部中文“超时”作推断。

复核：`.venv/bin/python -m pytest tests/test_host_contract_fixes.py -q`，再跑 smoke、recipe_lib、L2。新 L2 增加 C-01..04：确认门禁、合并发现、确认后版本回放、结构化策略拒绝。已有 Host 需重启/重连 MCP 进程才能加载网关新代码；工具名不变，无需改 mcp.json。


### Host 加固后实测（2026-11-06 13:44，Asia/Shanghai）

`WEBCLAW_CDP_PORT=19339 WEBCLAW_RUN_TIMEOUT_MS=90000 .venv/bin/python scripts/eval_all.py` → 全部 green：L1 86、components 2、policy 11、recipe_lib 18、selfheal 10、L2 7 passed；0 failed / skipped / xfailed。L1 包含新增 Host 契约 37 项。Rust 错误码单测 2 passed。报告：`eval/out/dashboard.json`；隔离测试端口避免复用 WorkBuddy 的 19222 浏览器。
