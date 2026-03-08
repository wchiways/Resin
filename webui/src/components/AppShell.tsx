import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Database,
  LayoutDashboard,
  LogOut,
  Logs,
  Network,
  Regex,
  Rss,
  Server,
  Settings,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";
import { useAuthStore } from "../features/auth/auth-store";
import { getEnvConfig } from "../features/systemConfig/api";
import { useI18n } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

type NavItem = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { label: "总览看板", path: "/dashboard", icon: LayoutDashboard },
  { label: "平台管理", path: "/platforms", icon: Server },
  { label: "订阅管理", path: "/subscriptions", icon: Rss },
  { label: "节点池", path: "/nodes", icon: Network },
  { label: "请求头规则", path: "/rules", icon: Regex },
  { label: "请求日志", path: "/request-logs", icon: Logs },
  { label: "资源", path: "/resources", icon: Database },
  { label: "服务状态", path: "/service-status", icon: Activity },
  { label: "系统配置", path: "/system-config", icon: Settings },
];

export function AppShell() {
  const { t } = useI18n();
  const clearToken = useAuthStore((state) => state.clearToken);
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const location = useLocation();
  const envConfigQuery = useQuery({
    queryKey: ["system-config-env", "shell"],
    queryFn: getEnvConfig,
    staleTime: 30_000,
  });
  const logoSrc = `${import.meta.env.BASE_URL}vite.svg`;

  const envConfig = envConfigQuery.data;
  const authWarnings: string[] = [];
  if (envConfig && !envConfig.admin_token_set) {
    authWarnings.push(t("RESIN_ADMIN_TOKEN 为空，控制面 API 免认证"));
  }
  if (envConfig && !envConfig.proxy_token_set) {
    authWarnings.push(t("RESIN_PROXY_TOKEN 为空，正/反向代理免认证"));
  }
  if (envConfig && envConfig.admin_token_set && envConfig.admin_token_weak) {
    authWarnings.push(t("RESIN_ADMIN_TOKEN 强度较弱，建议更换为更高熵随机令牌"));
  }
  if (envConfig && envConfig.proxy_token_set && envConfig.proxy_token_weak) {
    authWarnings.push(t("RESIN_PROXY_TOKEN 强度较弱，建议更换为更高熵随机令牌"));
  }
  const showAuthWarning = authWarnings.length > 0;

  const logout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell-layout">
      <aside className="app-shell-sidebar">
        <div className="flex min-w-0 items-center gap-3 p-2">
          <div
            className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
            aria-hidden="true"
          >
            <img src={logoSrc} alt="Resin Logo" className="block h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold">Resin</p>
            <p className="truncate text-xs text-muted-foreground">{t("高性能粘性代理池 · 管理面板")}</p>
          </div>
        </div>

        <div className="app-shell-nav-scroll">
          <nav className="app-shell-nav-grid" aria-label={t("主导航")}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isCurrentPage = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  aria-current={isCurrentPage ? "page" : undefined}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex min-w-0 items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-[#2f3b51] transition-colors",
                      "hover:border-border hover:bg-white/80",
                      isActive &&
                        "border-[rgba(20,112,255,0.23)] bg-white/95 text-[var(--primary-strong)] shadow-[inset_0_0_0_1px_rgba(20,112,255,0.08)]",
                    )
                  }
                >
                  <Icon size={16} />
                  <span className="min-w-0 truncate">{t(item.label)}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="mt-0 flex shrink-0 flex-col gap-2.5 pt-1">
          {showAuthWarning ? (
            <div className="callout callout-warning mt-0 max-w-full items-start gap-1.5 p-2.5 text-xs" role="alert">
              <AlertTriangle size={16} />
              <div className="flex flex-col gap-1">
                <strong className="text-xs leading-tight">{t("安全警告")}</strong>
                <div className="flex flex-col gap-0.5 [overflow-wrap:anywhere] break-words">
                  {authWarnings.map((warning) => (
                    <span key={warning} className="text-xs leading-[1.3] [overflow-wrap:anywhere]">
                      {warning}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {!token ? <p className="m-0 text-center text-xs text-muted-foreground">{t("当前为免认证访问模式")}</p> : null}

          <div className="flex min-h-[34px] items-center gap-2">
            {token ? (
              <Button
                variant="secondary"
                size="sm"
                className="h-[34px] w-[34px] shrink-0 rounded-[10px] p-0 [&>svg]:h-4 [&>svg]:w-4"
                onClick={logout}
                aria-label={t("退出登录")}
                title={t("退出登录")}
              >
                <LogOut size={16} />
              </Button>
            ) : (
              <span className="h-[34px] w-[34px] shrink-0" aria-hidden="true" />
            )}
            <LanguageSwitcher className="ml-auto" compact />
          </div>
        </div>
      </aside>

      <main className="app-shell-main">
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="mx-auto flex w-full max-w-[1400px] flex-col gap-4"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
