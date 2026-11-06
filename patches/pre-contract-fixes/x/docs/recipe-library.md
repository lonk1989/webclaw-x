# P1 菜谱库版本管理

## 存储与兼容

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
- 新库 `list` 同时显示版本化与平铺条目；旧文件标 `version="legacy"`、`source="flat"`。
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
| `webclaw_recipe_list` | 合并版本列表与旧平铺条目 |
| `webclaw_recipe_get` | reference=`name@version`；可选 environment/parameters(JSON) |
| `webclaw_recipe_bind_env` | name/environment/parameters(JSON)；不复制正文 |
| `webclaw_recipe_diff` | left/right 两版正文差异 |
| `webclaw_run` | 新增 recipe_ref/environment；与 recipe/recipe_path 互斥 |

回放示例：

```text
webclaw_run(recipe_ref="fuel@1", environment="fixture")
```

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

本轮没有改 Rust，无需重新编译。回滚见 `patches/ROLLBACK.md` 的 recipe-library 小节。

## 已落盘的演示库

本次构建了不含秘密的独立演示目录，未写入原 `~/.webclaw/recipes/`：

```bash
cd /workspace/webclaw-x
.venv/bin/python -m webclaw_x.recipe_library --home eval/library-demo list
.venv/bin/python -m webclaw_x.recipe_library --home eval/library-demo get fuel@1 --env fixture
.venv/bin/python -m webclaw_x.recipe_library --home eval/library-demo diff fuel@1 fuel@2
```

演示摘要：`eval/out/recipe-library-demo.json`。fixture 使用占位端口 8765，回放前需启动本地站点或修改该环境绑定；mes-test 为 `.invalid` 示例且仍被白名单拒绝。

## 本轮最终验收

- 菜谱库专项：18 passed
- L1 全量：39 passed，0 failed / xfailed / skipped
- Component Pack：2 passed
- Policy/HITL：11 passed
- L2 MCP stdio：3 passed
