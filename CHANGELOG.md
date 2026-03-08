# Changelog

## [V1-0.3.1] - 2026-03-07

### 新增
- **平台详情新增「环境配置」同级页签**（与「监控 / 配置 / 运维」同级），提供 Bash / Zsh / PowerShell 的 HTTP/SOCKS5 环境变量示例，并支持一键复制。
- 环境配置内容改为**动态生成**：
  - 平台名来自当前平台详情；
  - 代理令牌来自 `/api/v1/system/config/env` 的 `proxy_token`；
  - 地址来自 `/api/v1/system/status` 的 `http_proxy.listen_address` / `socks5_proxy.listen_address`；
  - `0.0.0.0` 自动映射为 `127.0.0.1` 以便本机使用。
- `/api/v1/system/status` 新增 `request_log_queue` 指标：
  - `queue_len`、`queue_capacity`、`enqueued_total`、`dropped_total`、`flush_total`、`flush_failed_total`、`flushed_entries_total`。
- 请求日志查询新增过滤参数：`upstream_stage`、`resin_error`。
- 请求日志仓库新增对应索引：`upstream_stage`、`resin_error`。
- 新增 SOCKS5 生命周期测试文件：`internal/proxy/socks_lifecycle_test.go`。
- 新增 Tailwind/PostCSS 基础接入文件：`webui/src/styles/tailwind.css`、`webui/postcss.config.js`。
- 新增样式分层目录：`webui/src/styles/theme/`（00/10/20/30/40）。

### 变更
- 请求日志 `proxy_type` 过滤范围从 `1..2` 扩展到 `1..3`（新增 SOCKS5）。
- `/api/v1/system/config/env` 响应新增 `proxy_token` 字段，前端可用于生成环境变量配置。
- API Server 构造函数增加 `requestlog.Service` 依赖并贯通到系统状态接口。
- SOCKS5 生命周期顺序调整为**认证成功后**再进入请求生命周期，减少未认证噪声占用日志队列。
- WebUI 组件层统一引入 `class-variance-authority` 变体模式（Button/Badge/Card/Input/Select/Textarea/Switch/Toast/Pagination/DataTable 等）。
- `cn()` 工具升级为 `clsx + tailwind-merge`，减少类名冲突。
- 主题样式从单体 `theme.css` 拆分为分层导入（tokens/primitives/components/features/responsive）。
- 断点魔法数收敛为可维护 token：`--breakpoint-resin-lg: 1120px`、`--breakpoint-resin-sm: 760px`。

### 修复
- **请求日志 Payload 解码缓存性能问题**：
  - 从无界缓存改为有界缓存（条目上限 + 字符预算）；
  - key 从大 payload 串改为轻量签名；
  - 避免高频重复解码造成的内存和 CPU 风险。
- **PlatformMonitorPanel 语言切换不刷新时间标签**：修复 `useMemo`/格式化依赖，切换 locale 后图表时间正确刷新。
- **react-hook-form 监听方式**：将 `watch` 使用调整为 `useWatch`，移除不兼容 lint 抑制并保持行为一致。
- **AppShell 导航可访问性**：当前路由项补充 `aria-current="page"`。
- **ServiceStatus 页面每秒全页重渲染**：将 uptime 秒级刷新下沉到局部组件 `LiveUptime`。
- **DataTable 可访问性**：可点击行支持键盘（Tab / Enter / Space）与 focus-visible。
- **SystemConfig Switch 语义关联**：补齐 `label` 与 `id` 关联，改善读屏与点击标签可操作性。
- **Input/Select 尺寸一致性**：新增 `Input uiSize="sm"`，并替换高频内联 32px 控件样式。

### 前端体验与样式治理
- RequestLogs / Nodes / SystemConfig 三页高频内联样式收敛为复用 class，减少重复样式定义。
- Dashboard / PlatformMonitor / ServiceStatus / AppShell 等页面完成一轮低风险样式结构化重排，保持既有视觉语义。
- RequestLogs 增加 SOCKS5 类型展示与筛选，HTTP 列文案统一为 `HTTP / SOCKS`。

### 依赖调整
- 将 `class-variance-authority`、`tailwind-merge` 调整为运行时依赖（`dependencies`）。
- 新增 `@radix-ui/react-slot` 运行时依赖。
- 引入 `tailwindcss`、`postcss`、`@tailwindcss/postcss` 开发依赖与对应 lockfile 更新。

### 文档更新
- 重写代理 Shell 配置文档：
  - `doc/proxy-shell-setup.md`
  - `doc/proxy-shell-setup.zh-CN.md`
- 内容覆盖 PowerShell / Bash / Zsh 的 HTTP/SOCKS5 设置、持久化、取消与排障说明。

### 测试与契约更新
- API 契约测试补充：
  - 请求日志新过滤参数与非法参数校验；
  - `proxy_type=3` 行为；
  - `/system/status` 的 `request_log_queue` 字段。
- Handler 与 E2E 测试同步更新 `NewServer` 新签名。
- requestlog repo/service 测试补充：
  - `upstream_stage`、`resin_error` 过滤；
  - 队列入队/丢弃/flush 计数快照。

---