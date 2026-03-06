# Resin Proxy Setup Guide (PowerShell / Bash / Zsh)

This guide is for beginners and shows how to configure Resin proxy settings in common shells: `pwsh`, `bash`, and `zsh`.

## 1. Confirm your proxy endpoints

Default endpoints (based on the README examples):

- HTTP proxy: `http://127.0.0.1:2260`
- SOCKS5 proxy: `socks5h://127.0.0.1:1080` (`socks5h` is recommended so DNS is resolved by the proxy side)

If Resin auth is enabled (`RESIN_AUTH_VERSION=V1` and `RESIN_PROXY_TOKEN` is not empty), credentials are:

- Username: `Platform` or `Platform.Account` (`Account` is optional)
- Password: `RESIN_PROXY_TOKEN`

Examples:

- HTTP (Platform only): `http://Asia:my-token@127.0.0.1:2260`
- HTTP (Platform + Account): `http://Asia.user_tom:my-token@127.0.0.1:2260`
- SOCKS5 (Platform only): `socks5h://Asia:my-token@127.0.0.1:1080`
- SOCKS5 (Platform + Account): `socks5h://Asia.user_tom:my-token@127.0.0.1:1080`

> If you do not need account-level sticky routing, use `Platform` only.
> If you need sticky routing per account, use `Platform.Account`.

If `RESIN_PROXY_TOKEN=""` (empty string), credentials can be omitted.

---

## 2. PowerShell (pwsh)

### 2.1 Current session only

```powershell
# Prefer setting HTTP/HTTPS first
$env:HTTP_PROXY  = "http://Asia.user_tom:my-token@127.0.0.1:2260"
$env:HTTPS_PROXY = $env:HTTP_PROXY

# Optional: SOCKS5 via ALL_PROXY
$env:ALL_PROXY   = "socks5h://Asia.user_tom:my-token@127.0.0.1:1080"

# Bypass local addresses
$env:NO_PROXY    = "localhost,127.0.0.1,::1"
```

### 2.2 Persist for current user

```powershell
[Environment]::SetEnvironmentVariable("HTTP_PROXY",  "http://Asia.user_tom:my-token@127.0.0.1:2260", "User")
[Environment]::SetEnvironmentVariable("HTTPS_PROXY", "http://Asia.user_tom:my-token@127.0.0.1:2260", "User")
[Environment]::SetEnvironmentVariable("ALL_PROXY",   "socks5h://Asia.user_tom:my-token@127.0.0.1:1080", "User")
[Environment]::SetEnvironmentVariable("NO_PROXY",    "localhost,127.0.0.1,::1", "User")
```

### 2.3 Check and unset

```powershell
# Check
Get-ChildItem Env: | Where-Object Name -Match "PROXY"

# Unset in current session
Remove-Item Env:HTTP_PROXY,Env:HTTPS_PROXY,Env:ALL_PROXY,Env:NO_PROXY -ErrorAction SilentlyContinue

# Remove persisted user vars
[Environment]::SetEnvironmentVariable("HTTP_PROXY",  $null, "User")
[Environment]::SetEnvironmentVariable("HTTPS_PROXY", $null, "User")
[Environment]::SetEnvironmentVariable("ALL_PROXY",   $null, "User")
[Environment]::SetEnvironmentVariable("NO_PROXY",    $null, "User")
```

---

## 3. Bash

### 3.1 Current session only

```bash
export HTTP_PROXY="http://Asia.user_tom:my-token@127.0.0.1:2260"
export HTTPS_PROXY="$HTTP_PROXY"
export ALL_PROXY="socks5h://Asia.user_tom:my-token@127.0.0.1:1080"
export NO_PROXY="localhost,127.0.0.1,::1"

# Compatibility: some tools only read lowercase vars
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export no_proxy="$NO_PROXY"
```

### 3.2 Persist in `~/.bashrc`

Append:

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

Apply:

```bash
source ~/.bashrc
```

### 3.3 Check and unset

```bash
# Check
env | grep -i proxy

# Unset in current session
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY
unset http_proxy https_proxy all_proxy no_proxy
```

---

## 4. Zsh

Zsh is the same as Bash, but uses `~/.zshrc`.

### 4.1 Current session only

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

### 4.2 Persist in `~/.zshrc`

Put the same export block into `~/.zshrc`, then run:

```zsh
source ~/.zshrc
```

### 4.3 Unset

```zsh
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY
unset http_proxy https_proxy all_proxy no_proxy
```

---

## 5. Quick validation

```bash
# Check egress IP (should become proxy egress IP)
curl https://api.ipify.org
```

To explicitly test SOCKS5:

```bash
curl --proxy "socks5h://Asia.user_tom:my-token@127.0.0.1:1080" https://api.ipify.org
```

---

## 6. Troubleshooting

### Q1: Why do some tools ignore the proxy?

Some tools only read lowercase vars (`http_proxy`, etc.), so set both uppercase and lowercase.

### Q2: Why are local services broken?

Set `NO_PROXY=localhost,127.0.0.1,::1` to avoid proxying local traffic.

### Q3: Auth failed (407 / SOCKS5 auth failure)

Check:

1. You are using V1 format: `Platform` or `Platform.Account` with password `RESIN_PROXY_TOKEN`
2. Platform exists (for example `Asia`)
3. Token matches `RESIN_PROXY_TOKEN`
4. Special characters in username/password are URL-encoded if needed
