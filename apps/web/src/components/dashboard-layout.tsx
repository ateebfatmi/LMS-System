"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type PropsWithChildren, useEffect, useState, Suspense } from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck2,
  ClipboardCheck,
  ClipboardPenLine,
  ContactRound,
  Gem,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessagesSquare,
  Printer,
  School,
  UserCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { PrepziiMark } from "@prepzii/ui";
import { DashboardSidebar } from "@/components/ui/dashboard-sidebar";
import { resolveActiveOrganization } from "@/lib/client-org";

export type AppRole = "DIRECTOR" | "COORDINATOR" | "FACULTY" | "STUDENT" | "PARENT" | "ACCOUNTANT";

let rememberedSidebarCollapsed = false;
let rememberedMembershipRole: AppRole = "DIRECTOR";
let rememberedOrganizationStatus: "checking" | "available" | "missing" = "checking";

const roleNavItems: Record<AppRole, { href: string; label: string; icon: LucideIcon }[]> = {
  DIRECTOR: [
    { href: "/dashboard/workspace", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/crm", label: "Admissions", icon: ContactRound },
    { href: "/dashboard/students/workspace", label: "Students", icon: GraduationCap },
    { href: "/dashboard/teachers", label: "Faculty", icon: UserCog },
    { href: "/dashboard/batches/workspace", label: "Batches & Academics", icon: School },
    { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
    { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardPenLine },
    { href: "/dashboard/doubts", label: "Doubt Desk", icon: MessagesSquare },
    { href: "/dashboard/assessments/workspace", label: "Assessments", icon: ClipboardCheck },
    { href: "/dashboard/omr", label: "OMR Generator & Scan", icon: Printer },
    { href: "/dashboard/attendance/workspace", label: "Attendance", icon: CalendarCheck2 },
    { href: "/dashboard/fees/workspace", label: "Fees", icon: IndianRupee },
    { href: "/dashboard/announcements", label: "Announcements", icon: Bell },
    { href: "/dashboard/reports/workspace", label: "Reports", icon: BarChart3 },
    { href: "/dashboard/student-success", label: "Student Success", icon: LifeBuoy },
    { href: "/dashboard/members", label: "Members & Access", icon: UsersRound },
    { href: "/dashboard/billing", label: "Subscription", icon: Gem },
  ],
  FACULTY: [
    { href: "/dashboard/workspace", label: "My Overview", icon: LayoutDashboard },
    { href: "/dashboard/batches/workspace", label: "My Batches", icon: School },
    { href: "/dashboard/attendance/workspace", label: "Mark Attendance", icon: CalendarCheck2 },
    { href: "/dashboard/courses", label: "Upload DPPs & Notes", icon: BookOpen },
    { href: "/dashboard/assignments", label: "Assignments & Grading", icon: ClipboardPenLine },
    { href: "/dashboard/doubts", label: "Doubt Desk", icon: MessagesSquare },
    { href: "/dashboard/assessments/workspace", label: "Create & Evaluate Tests", icon: ClipboardCheck },
    { href: "/dashboard/omr", label: "OMR Generator & Scan", icon: Printer },
    { href: "/dashboard/announcements", label: "Notice Board", icon: Bell },
    { href: "/dashboard/reports/workspace", label: "Batch Performance", icon: BarChart3 },
    { href: "/dashboard/student-success", label: "Student Success", icon: LifeBuoy },
  ],
  STUDENT: [
    { href: "/dashboard/workspace", label: "My Learning Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/assessments/workspace", label: "CBT Mock Tests & PYQs", icon: ClipboardCheck },
    { href: "/dashboard/courses", label: "My Courses & DPPs", icon: BookOpen },
    { href: "/dashboard/assignments", label: "My Assignments", icon: ClipboardPenLine },
    { href: "/dashboard/doubts", label: "Ask a Doubt", icon: MessagesSquare },
    { href: "/dashboard/fees/workspace", label: "My Fee Installments", icon: IndianRupee },
    { href: "/dashboard/announcements", label: "Notice Board", icon: Bell },
    { href: "/dashboard/attendance/workspace", label: "My Attendance Log", icon: CalendarCheck2 },
    { href: "/dashboard/student-success", label: "My Success Plan", icon: LifeBuoy },
  ],
  PARENT: [
    { href: "/dashboard/workspace", label: "Guardian Overview", icon: LayoutDashboard },
    { href: "/dashboard/student-success", label: "Success Plans", icon: LifeBuoy },
    { href: "/dashboard/announcements", label: "Circulars & Notices", icon: Bell },
  ],
  COORDINATOR: [
    { href: "/dashboard/workspace", label: "Academic Overview", icon: LayoutDashboard },
    { href: "/dashboard/batches/workspace", label: "Batches & Classrooms", icon: School },
    { href: "/dashboard/students/workspace", label: "Student Directory", icon: GraduationCap },
    { href: "/dashboard/teachers", label: "Faculty Directory", icon: UserCog },
    { href: "/dashboard/courses", label: "Courses & DPPs", icon: BookOpen },
    { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardPenLine },
    { href: "/dashboard/doubts", label: "Doubt Desk", icon: MessagesSquare },
    { href: "/dashboard/assessments/workspace", label: "Assessments & PYQs", icon: ClipboardCheck },
    { href: "/dashboard/omr", label: "OMR Generator & Scan", icon: Printer },
    { href: "/dashboard/attendance/workspace", label: "Daily Attendance", icon: CalendarCheck2 },
    { href: "/dashboard/announcements", label: "Notice Board", icon: Bell },
    { href: "/dashboard/reports/workspace", label: "Reports & Analytics", icon: BarChart3 },
    { href: "/dashboard/student-success", label: "Student Success", icon: LifeBuoy },
  ],
  ACCOUNTANT: [
    { href: "/dashboard/workspace", label: "Finance Overview", icon: LayoutDashboard },
    { href: "/dashboard/fees/workspace", label: "Fee Management", icon: IndianRupee },
    { href: "/dashboard/reports/workspace", label: "Financial Reports", icon: BarChart3 },
  ],
};

export function mapMembershipRole(role: string): AppRole {
  if (role === "TEACHER") return "FACULTY";
  if (role === "ACADEMIC_COORDINATOR") return "COORDINATOR";
  if (role === "STUDENT" || role === "PARENT" || role === "ACCOUNTANT") return role;
  return "DIRECTOR";
}

function LayoutContent({
  children,
  title,
  subtitle,
  action,
  currentRole: propRole,
}: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  currentRole?: AppRole;
}>) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(rememberedSidebarCollapsed);
  const [membershipRole, setMembershipRole] = useState<AppRole>(rememberedMembershipRole);
  const [organizationStatus, setOrganizationStatus] = useState<"checking" | "available" | "missing">(rememberedOrganizationStatus);

  useEffect(() => {
    let cancelled = false;
    const handleOrganizationChange = (event: Event) => {
      const role = (event as CustomEvent<{ role?: string }>).detail?.role ?? "";
      rememberedMembershipRole = mapMembershipRole(role);
      rememberedOrganizationStatus = "available";
      setMembershipRole(rememberedMembershipRole);
      setOrganizationStatus("available");
    };
    window.addEventListener("prepzii:organization-changed", handleOrganizationChange);
    void resolveActiveOrganization().then((result) => {
      if (cancelled) return;
      if (result?.organization) {
        rememberedMembershipRole = mapMembershipRole(String(result.role ?? ""));
        rememberedOrganizationStatus = "available";
        setMembershipRole(rememberedMembershipRole);
        setOrganizationStatus("available");
      } else {
        rememberedOrganizationStatus = "missing";
        setOrganizationStatus("missing");
      }
    });
    return () => { cancelled = true; window.removeEventListener("prepzii:organization-changed", handleOrganizationChange); };
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

  const activeRole: AppRole = propRole || membershipRole;

  const navItems = organizationStatus === "available" ? (roleNavItems[activeRole] || roleNavItems.DIRECTOR) : [];
  return (
    <main className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <DashboardSidebar
        activeRole={organizationStatus === "available" ? activeRole : organizationStatus === "missing" ? "GET STARTED" : "CHECKING"}
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

      <section className="workspace">
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
                <PrepziiMark compact theme="light" />
              </span>
            </div>
            {organizationStatus !== "missing" && subtitle && <p className="header-subtitle">{subtitle}</p>}
            <h1>{organizationStatus === "missing" ? "Get started" : title || "Institute Overview"}</h1>
          </div>

          {organizationStatus === "available" && action && <div className="header-actions">{action}</div>}
        </header>

        {organizationStatus === "missing" ? (
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
        ) : organizationStatus === "checking" ? (
          <p className="empty-state dashboard-shell-loading">Checking institute access…</p>
        ) : children}
      </section>
    </main>
  );
}

export function DashboardLayout(props: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  currentRole?: AppRole;
}>) {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>Loading workspace...</div>}>
      <LayoutContent {...props} />
    </Suspense>
  );
}
