"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type CSSProperties, type PropsWithChildren, useContext, useEffect, useState, Suspense } from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck2,
  ClipboardCheck,
  ClipboardPenLine,
  GraduationCap,
  LayoutDashboard,
  Menu,
  School,
  Settings,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { InstituteMark } from "@/components/institute-mark";
import { DashboardSidebar } from "@/components/ui/dashboard-sidebar";
import { resolveActiveOrganization, type ActiveOrganizationSelection, WORKSPACE_SWITCH_EVENT } from "@/lib/client-org";

export type AppRole = "DIRECTOR" | "COORDINATOR" | "FACULTY" | "STUDENT" | "PARENT";

let rememberedSidebarCollapsed = false;
const DashboardInstituteContext = createContext<{
  selection: ActiveOrganizationSelection;
  updateSelection: (selection: ActiveOrganizationSelection) => void;
} | null>(null);

export function useDashboardInstitute() {
  return useContext(DashboardInstituteContext);
}

const roleNavItems: Record<AppRole, { href: string; label: string; icon: LucideIcon }[]> = {
  DIRECTOR: [
    { href: "/dashboard/workspace", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/students/workspace", label: "Students", icon: GraduationCap },
    { href: "/dashboard/teachers", label: "Faculty", icon: UserCog },
    { href: "/dashboard/batches/workspace", label: "Batches & Courses", icon: School },
    { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardPenLine },
    { href: "/dashboard/assessments/workspace", label: "Assessments", icon: ClipboardCheck },
    { href: "/dashboard/attendance/workspace", label: "Attendance", icon: CalendarCheck2 },
    { href: "/dashboard/announcements", label: "Announcements", icon: Bell },
    { href: "/dashboard/reports/workspace", label: "Reports", icon: BarChart3 },
    { href: "/dashboard/members", label: "Settings", icon: Settings },
  ],
  FACULTY: [
    { href: "/dashboard/workspace", label: "My Overview", icon: LayoutDashboard },
    { href: "/dashboard/batches/workspace", label: "My Batches", icon: School },
    { href: "/dashboard/courses", label: "Courses & Materials", icon: BookOpen },
    { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardPenLine },
    { href: "/dashboard/assessments/workspace", label: "Assessments", icon: ClipboardCheck },
    { href: "/dashboard/attendance/workspace", label: "Attendance", icon: CalendarCheck2 },
    { href: "/dashboard/announcements", label: "Announcements", icon: Bell },
  ],
  STUDENT: [
    { href: "/dashboard/workspace", label: "Home", icon: LayoutDashboard },
    { href: "/dashboard/courses", label: "My Courses", icon: BookOpen },
    { href: "/dashboard/assignments", label: "My Assignments", icon: ClipboardPenLine },
    { href: "/dashboard/assessments/workspace", label: "My Assessments", icon: ClipboardCheck },
    { href: "/dashboard/attendance/workspace", label: "My Attendance", icon: CalendarCheck2 },
    { href: "/dashboard/announcements", label: "Announcements", icon: Bell },
  ],
  PARENT: [
    { href: "/dashboard/workspace", label: "Home", icon: LayoutDashboard },
    { href: "/dashboard/announcements", label: "Announcements", icon: Bell },
  ],
  COORDINATOR: [
    { href: "/dashboard/workspace", label: "Academic Overview", icon: LayoutDashboard },
    { href: "/dashboard/students/workspace", label: "Students", icon: GraduationCap },
    { href: "/dashboard/teachers", label: "Faculty", icon: UserCog },
    { href: "/dashboard/batches/workspace", label: "Batches & Courses", icon: School },
    { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardPenLine },
    { href: "/dashboard/assessments/workspace", label: "Assessments", icon: ClipboardCheck },
    { href: "/dashboard/attendance/workspace", label: "Attendance", icon: CalendarCheck2 },
    { href: "/dashboard/announcements", label: "Announcements", icon: Bell },
    { href: "/dashboard/reports/workspace", label: "Reports", icon: BarChart3 },
  ],
};

export function mapMembershipRole(role: string): AppRole {
  if (role === "TEACHER") return "FACULTY";
  if (role === "ACADEMIC_COORDINATOR") return "COORDINATOR";
  if (role === "PARENT") return "PARENT";
  if (role === "STUDENT" || role === "ACCOUNTANT") return "STUDENT";
  return "DIRECTOR";
}

function LayoutContent({
  children,
  title,
  subtitle,
  action,
  currentRole: propRole,
  welcome = false,
}: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  currentRole?: AppRole;
  welcome?: boolean;
}>) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(rememberedSidebarCollapsed);
  const [selection, setSelection] = useState<ActiveOrganizationSelection | null | undefined>();
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handleSwitch = (event: Event) => setSwitching((event as CustomEvent<boolean>).detail);
    const reloadRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener(WORKSPACE_SWITCH_EVENT, handleSwitch);
    window.addEventListener("pageshow", reloadRestoredPage);
    void resolveActiveOrganization().then((result) => {
      if (!cancelled) setSelection(result);
    });
    return () => {
      cancelled = true;
      window.removeEventListener(WORKSPACE_SWITCH_EVENT, handleSwitch);
      window.removeEventListener("pageshow", reloadRestoredPage);
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMobileMenuOpen]);

  const active = switching ? null : selection;
  const organization = active?.organization;
  const loading = switching || selection === undefined;
  const activeRole = propRole ?? mapMembershipRole(active?.role ?? "");
  const accent = organization?.accentColor;
  const navItems = active ? roleNavItems[activeRole] : [];

  return (
    <main
      className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}
      style={accent ? { "--institute-accent": accent } as CSSProperties : undefined}
    >
      <DashboardSidebar
        activeRole={active ? activeRole : loading ? "CHECKING" : "GET STARTED"}
        selection={selection ?? null}
        switching={switching}
        selectionPending={selection === undefined}
        collapsed={isSidebarCollapsed}
        isOpen={isMobileMenuOpen}
        items={navItems}
        pathname={pathname}
        onClose={() => setIsMobileMenuOpen(false)}
        onToggleCollapsed={() => {
          const nextValue = !isSidebarCollapsed;
          rememberedSidebarCollapsed = nextValue;
          setIsSidebarCollapsed(nextValue);
        }}
      />

      <section className="workspace" aria-busy={loading}>
        <header className="workspace-header">
          <div>
            <div className="mobile-nav-row">
              <motion.button
                type="button"
                className="dashboard-menu-button"
                onClick={() => setIsMobileMenuOpen(true)}
                whileTap={{ scale: 0.9 }}
                aria-label="Open dashboard navigation"
                aria-expanded={isMobileMenuOpen}
              >
                <Menu aria-hidden="true" />
              </motion.button>
              <span className="mobile-brand">
                <InstituteMark name={organization?.name} logoUrl={organization?.logoUrl} />
                <strong>{organization?.name ?? "Institute workspace"}</strong>
              </span>
            </div>
            {active && subtitle && <p className="header-subtitle">{subtitle}</p>}
            <h1>{loading ? "Institute workspace" : active ? title || "Institute Overview" : "Get started"}</h1>
          </div>

          {active && action && <div className="header-actions">{action}</div>}
        </header>

        {loading ? (
          <p className="empty-state dashboard-shell-loading" role="status">
            {switching ? "Switching institute…" : "Checking institute access…"}
          </p>
        ) : !active ? (
          <section className="no-organization-state" aria-labelledby="no-organization-title">
            <span className="no-organization-icon"><School aria-hidden="true" /></span>
            <p className="eyebrow">Institute access required</p>
            <h2 id="no-organization-title">Create your institute to open the workspace</h2>
            <p>Set up an institute, or open the invitation link sent by an institute owner to join an existing workspace.</p>
            <div>
              <Link className="pz-button pz-button-primary" href="/onboarding">Create institute</Link>
              <Link className="pz-button pz-button-secondary" href="/">Return home</Link>
            </div>
          </section>
        ) : (
          <DashboardInstituteContext.Provider value={{ selection: active, updateSelection: setSelection }}>
            {welcome && (
              <section className="institute-welcome" aria-labelledby="institute-welcome-title">
                <InstituteMark name={active.organization.name} logoUrl={active.organization.logoUrl} />
                <div>
                  <p>Institute workspace</p>
                  <h2 id="institute-welcome-title">Welcome to {active.organization.name}</h2>
                </div>
              </section>
            )}
            {children}
          </DashboardInstituteContext.Provider>
        )}
      </section>
    </main>
  );
}

export function DashboardLayout(props: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  currentRole?: AppRole;
  welcome?: boolean;
}>) {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>Loading workspace...</div>}>
      <LayoutContent {...props} />
    </Suspense>
  );
}
