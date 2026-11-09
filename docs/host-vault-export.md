# Host 保险箱导出 ↔ webclaw 启动探测

密码只在**本机** Host 保险箱与 webclaw vault 之间流动；LLM 只看见站点别名。

## 约定

1. Host（蜂行 / WorkBuddy / 豆包工作…）把站点账号写到约定路径（只读给本机用户）。
2. webclaw MCP **启动时**扫描已知路径；找不到文件则**安静跳过**。
3. 导入走 `accounts ensure` / `accounts set`（有 lite 时密码进 DPAPI vault）；**从不**把密码放进工具返回或日志。

关闭探测：`WEBCLAW_HOST_VAULT_PROBE=0`  
额外路径：`WEBCLAW_HOST_VAULT_PATHS=C:\path\a.json;D:\path\b.json`

手动刷新（`WEBCLAW_TOOLS=all`）：工具 `webclaw_host_vault_probe`。

## 导出格式 `webclaw.host-vault.v1`

```json
{
  "schema": "webclaw.host-vault.v1",
  "host": "fengxing",
  "exportedAt": "2026-11-09T08:00:00Z",
  "systems": [
    {
      "id": "ehr",
      "name": "EHR系统",
      "url": "https://cleanpro.example/login",
      "username": "alice",
      "password": "…本机明文，仅本地 drop…"
    }
  ]
}
```

可选 `signature`：对去掉 `signature` 后的 canonical JSON（`sort_keys`）做 HMAC-SHA256；密钥文件 `$WEBCLAW_HOME/host-vault.key`（≥16 字节）。有签名无密钥 → 跳过该文件。

## 已知探测路径（节选）

| Host | 路径 |
|------|------|
| 通用 drop | `$WEBCLAW_HOME/host-exports/<host>.json` |
| 蜂行同步写出 | `$WEBCLAW_HOME/host-exports/fengxing.json` |
| 蜂行 / DSH 原生库 | `$DSH_HOME/storages/web-systems.json`（默认 `~/.dsh/…`） |
| WorkBuddy | `~/.workbuddy/webclaw-vault.json`、`%LOCALAPPDATA%/WorkBuddy/webclaw-vault.json` |
| 豆包工作 | `%LOCALAPPDATA%/DoubaoWork/webclaw-vault.json` |

安全门槛：单文件 ≤ 1MB；POSIX 跳过 world-writable；损坏 JSON / 未知 schema → 记错误并跳过。

## 各助手怎么接

**蜂行**  
`corp-auth` 同步保险箱时已写入 `host-exports/fengxing.json`，并继续直接 `accounts set`。MCP 冷启动可再探测一遍。

**WorkBuddy**  
在设置里维护站点账号后，写出 `~/.workbuddy/webclaw-vault.json`（同上 schema）。无 UI 时可由安装脚本生成空模板，用户本地编辑（勿提交到 git）。

**豆包工作 / 飞书伙伴**  
密码只留用户本机；本机组件写 `DoubaoWork/webclaw-vault.json` 或 `$WEBCLAW_HOME/host-exports/doubao.json`。远程伙伴消息里禁止出现密码。

**Cursor**  
可用 `$WEBCLAW_HOME/host-exports/cursor.json`；或项目私有脚本从系统凭据管理器灌入后 drop 该文件。

## 与「登录EHR系统」菜谱

菜谱只写别名；执行时 lite 查 vault。模型可用 `webclaw_accounts_list`（无密码）确认是否已配置。
