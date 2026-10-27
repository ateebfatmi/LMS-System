"use client";

import Link from "next/link";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import { PrepziiMark } from "@prepzii/ui";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { clearRememberedActiveOrganization } from "@/lib/client-org";

export type DashboardSidebarItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type DashboardSidebarProps = {
  activeRole: string;
  collapsed: boolean;
  isOpen: boolean;
  items: DashboardSidebarItem[];
  pathname: string;
  onClose: () => void;
  onToggleCollapsed: () => void;
};

function ClerkLogoutButton({ collapsed, onClose }: { collapsed: boolean; onClose: () => void }) {
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "DELETE" });
    } catch {
      // Clerk sign-out remains authoritative if local workspace cleanup is unavailable.
    }
    clearRememberedActiveOrganization();
    onClose();
    await signOut({ redirectUrl: "/" });
  }

  return (
    <button
      type="button"
      className="sidebar-sign-out"
      onClick={() => void logout()}
      disabled={signingOut}
      aria-label={signingOut ? "Logging out" : "Log out"}
      title={collapsed ? "Log out" : undefined}
    >
      <span className="side-nav-icon"><LogOut aria-hidden="true" strokeWidth={1.8} /></span>
      <span className="side-nav-label">{signingOut ? "Logging out…" : "Log out"}</span>
    </button>
  );
}

export function DashboardSidebar({
  activeRole,
  collapsed,
  isOpen,
  items,
  pathname,
  onClose,
  onToggleCollapsed,
}: DashboardSidebarProps) {
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close dashboard navigation"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <aside
        className={`sidebar dashboard-navbar ${collapsed ? "collapsed" : ""} ${isOpen ? "mobile-open" : ""}`}
        suppressHydrationWarning
      >
        <div className="brand-row" suppressHydrationWarning>
          <motion.div whileHover={{ rotate: 1.5, scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Link href="/" aria-label="PrepZii home">
              <PrepziiMark compact={collapsed} theme="light" />
            </Link>
          </motion.div>
          <span className="inst-pill">INSTITUTIONS</span>
          <motion.button
            type="button"
            className="sidebar-collapse"
            onClick={onToggleCollapsed}
            whileTap={{ scale: 0.9 }}
            aria-label={collapsed ? "Expand dashboard navigation" : "Minimize dashboard navigation"}
            title={collapsed ? "Expand navigation" : "Minimize navigation"}
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </motion.button>
          <motion.button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
            aria-label="Close dashboard navigation"
          >
            <X aria-hidden="true" />
          </motion.button>
        </div>

        <div>
          <OrganizationSwitcher />
        </div>

        <div className="side-nav-heading">
          <span>Workspace</span>
          <span>{activeRole.toLowerCase()}</span>
        </div>

        <nav className="side-nav" aria-label="Dashboard navigation">
          {items.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <motion.div key={item.label} whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href={item.href}
                  className={isActive ? "active" : ""}
                  onClick={onClose}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="side-nav-icon">
                    <Icon aria-hidden="true" strokeWidth={1.8} />
                  </span>
                  <span className="side-nav-label">{item.label}</span>
                  {isActive && <motion.span className="side-nav-active-dot" layoutId="active-dashboard-item" />}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
            <ClerkLogoutButton collapsed={collapsed} onClose={onClose} />
          ) : (
            <Link className="sidebar-sign-out" href="/" onClick={onClose} title={collapsed ? "Exit workspace" : undefined}>
              <span className="side-nav-icon"><LogOut aria-hidden="true" strokeWidth={1.8} /></span>
              <span className="side-nav-label">Exit workspace</span>
            </Link>
          )}
        </div>

      </aside>
    </>
  );
}
