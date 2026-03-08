# Resin 代理配置指南（PowerShell / Bash / Zsh）

这份文档面向新手，演示如何把 Resin 配置到常见命令行环境中：`pwsh`、`bash`、`zsh`。

## 1. 先确认你的代理地址

默认情况下（按 README 示例）：

- HTTP 代理：`http://127.0.0.1:2260`
- SOCKS5 代理：`socks5h://127.0.0.1:1080`（推荐 `socks5h`，由代理侧解析域名）

如果你启用了 Resin 认证（`RESIN_AUTH_VERSION=V1` 且 `RESIN_PROXY_TOKEN` 非空），凭据格式为：

- 用户名：`Platform` 或 `Platform.Account`（`Account` 为可选）
- 密码：`RESIN_PROXY_TOKEN`

例如：

- HTTP（仅 Platform）：`http://Asia:my-token@127.0.0.1:2260`
- HTTP（Platform + Account）：`http://Asia.user_tom:my-token@127.0.0.1:2260`
- SOCKS5（仅 Platform）：`socks5h://Asia:my-token@127.0.0.1:1080`
- SOCKS5（Platform + Account）：`socks5h://Asia.user_tom:my-token@127.0.0.1:1080`

> 不需要按账号做粘性时，可只传 `Platform`；需要按账号维持粘性时，再传 `Platform.Account`。

> 如果你设置了 `RESIN_PROXY_TOKEN=""`（空字符串），可不带用户名密码。

---

## 2. 在 PowerShell（pwsh）中配置

### 2.1 仅当前会话生效

```powershell
# 建议先配置 HTTP/HTTPS
$env:HTTP_PROXY  = "http://Asia.user_tom:my-token@127.0.0.1:2260"
$env:HTTPS_PROXY = $env:HTTP_PROXY

# 如需 SOCKS5，可配置 ALL_PROXY
$env:ALL_PROXY   = "socks5h://Asia.user_tom:my-token@127.0.0.1:1080"

# 本地地址不走代理
$env:NO_PROXY    = "localhost,127.0.0.1,::1"
```

### 2.2 持久化到当前用户（重开终端后仍生效）

```powershell
[Environment]::SetEnvironmentVariable("HTTP_PROXY",  "http://Asia.user_tom:my-token@127.0.0.1:2260", "User")
[Environment]::SetEnvironmentVariable("HTTPS_PROXY", "http://Asia.user_tom:my-token@127.0.0.1:2260", "User")
[Environment]::SetEnvironmentVariable("ALL_PROXY",   "socks5h://Asia.user_tom:my-token@127.0.0.1:1080", "User")
[Environment]::SetEnvironmentVariable("NO_PROXY",    "localhost,127.0.0.1,::1", "User")
```

### 2.3 检查与取消

```powershell
# 查看
Get-ChildItem Env: | Where-Object Name -Match "PROXY"

# 仅取消当前会话
Remove-Item Env:HTTP_PROXY,Env:HTTPS_PROXY,Env:ALL_PROXY,Env:NO_PROXY -ErrorAction SilentlyContinue

# 取消持久化（User）
[Environment]::SetEnvironmentVariable("HTTP_PROXY",  $null, "User")
[Environment]::SetEnvironmentVariable("HTTPS_PROXY", $null, "User")
[Environment]::SetEnvironmentVariable("ALL_PROXY",   $null, "User")
[Environment]::SetEnvironmentVariable("NO_PROXY",    $null, "User")
```

---

## 3. 在 Bash 中配置

### 3.1 仅当前会话生效

```bash
export HTTP_PROXY="http://Asia.user_tom:my-token@127.0.0.1:2260"
export HTTPS_PROXY="$HTTP_PROXY"
export ALL_PROXY="socks5h://Asia.user_tom:my-token@127.0.0.1:1080"
export NO_PROXY="localhost,127.0.0.1,::1"

# 兼容部分只认小写环境变量的工具
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export no_proxy="$NO_PROXY"
```

### 3.2 持久化（写入 `~/.bashrc`）

把下面内容追加到 `~/.bashrc`：

```bash
export HTTP_PROXY="http://Asia.user_tom:my-token@127.0.0.1:2260"
export HTTPS_PROXY="$HTTP_PROXY"
export ALL_PROXY="socks5h://Asia.user_tom:my-token@127.0.0.1:1080"
export NO_PROXY="localhost,127.0.0.1,::1"
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export no_proxy="$NO_PROXY"
```

应用配置：

```bash
source ~/.bashrc
```

### 3.3 检查与取消

```bash
# 查看
env | grep -i proxy

# 取消（当前会话）
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY
unset http_proxy https_proxy all_proxy no_proxy
```

---

## 4. 在 Zsh 中配置

Zsh 与 Bash 基本一致，区别在配置文件是 `~/.zshrc`。

### 4.1 仅当前会话生效

```zsh
export HTTP_PROXY="http://Asia.user_tom:my-token@127.0.0.1:2260"
export HTTPS_PROXY="$HTTP_PROXY"
export ALL_PROXY="socks5h://Asia.user_tom:my-token@127.0.0.1:1080"
export NO_PROXY="localhost,127.0.0.1,::1"
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export no_proxy="$NO_PROXY"
```

### 4.2 持久化（写入 `~/.zshrc`）

将上面 `export` 片段写入 `~/.zshrc`，然后执行：

```zsh
source ~/.zshrc
```

### 4.3 取消

```zsh
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY
unset http_proxy https_proxy all_proxy no_proxy
```

---

## 5. 快速验证是否生效

```bash
# 观察出口 IP（应变为代理出口 IP）
curl https://api.ipify.org
```

如果你想显式验证 SOCKS5：

```bash
curl --proxy "socks5h://Asia.user_tom:my-token@127.0.0.1:1080" https://api.ipify.org
```

---

## 6. 常见问题

### Q1：为什么有些命令不走代理？

有些工具只识别小写变量（如 `http_proxy`），建议大小写都设置。

### Q2：本地服务访问异常？

请确保配置了 `NO_PROXY=localhost,127.0.0.1,::1`，避免本地请求被代理。

### Q3：认证失败（407 / SOCKS5 鉴权失败）？

请检查：

1. 是否使用了 V1 格式：`Platform.Account:RESIN_PROXY_TOKEN`
2. Platform 是否存在（例如你使用的是 `Asia`）
3. Token 是否和 `RESIN_PROXY_TOKEN` 一致
4. 用户名/密码中是否有特殊字符（必要时做 URL 编码）
