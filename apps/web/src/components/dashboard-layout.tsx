"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type PropsWithChildren, useEffect, useState, Suspense } from "react";
import { PrepziiMark, ZiAssistantBadge } from "@prepzii/ui";
import { OrganizationSwitcher } from "@/components/organization-switcher";

export type AppRole = "DIRECTOR" | "COORDINATOR" | "FACULTY" | "STUDENT" | "PARENT" | "ACCOUNTANT";

const roleNavItems: Record<AppRole, { href: string; label: string; icon: string }[]> = {
  DIRECTOR: [
    { href: "/dashboard", label: "Executive Overview", icon: "❖" },
    { href: "/dashboard/crm", label: "Admissions CRM", icon: "◎" },
    { href: "/dashboard/batches", label: "Batches & Classrooms", icon: "⊞" },
    { href: "/dashboard/students", label: "Student Directory", icon: "⚑" },
    { href: "/dashboard/teachers", label: "Faculty Directory", icon: "◈" },
    { href: "/dashboard/members", label: "Members & Invites", icon: "♙" },
    { href: "/dashboard/courses", label: "Courses & DPPs", icon: "▤" },
    { href: "/dashboard/assignments", label: "Assignments", icon: "✎" },
    { href: "/dashboard/assessments", label: "Assessments & PYQs", icon: "⏱" },
    { href: "/dashboard/question-bank", label: "Question Bank", icon: "⌗" },
    { href: "/dashboard/attendance", label: "Daily Attendance", icon: "✓" },
    { href: "/dashboard/fees", label: "Fee Management", icon: "₹" },
    { href: "/dashboard/announcements", label: "Notice Board", icon: "🔔" },
    { href: "/dashboard/campuses", label: "Campus Rooms", icon: "🏛" },
    { href: "/dashboard/reports", label: "Reports & Analytics", icon: "📈" },
    { href: "/dashboard/billing", label: "Plan & Quotas", icon: "💎" },
  ],
  FACULTY: [
    { href: "/dashboard", label: "My Classes & Schedule", icon: "❖" },
    { href: "/dashboard/batches", label: "My Batches", icon: "⊞" },
    { href: "/dashboard/attendance", label: "Mark Attendance", icon: "✓" },
    { href: "/dashboard/courses", label: "Upload DPPs & Notes", icon: "▤" },
    { href: "/dashboard/assignments", label: "Assignments & Grading", icon: "✎" },
    { href: "/dashboard/assessments", label: "Create & Evaluate Tests", icon: "⏱" },
    { href: "/dashboard/question-bank", label: "Question Bank & PYQs", icon: "⌗" },
    { href: "/dashboard/announcements", label: "Notice Board", icon: "🔔" },
    { href: "/dashboard/campuses", label: "Room Allocations", icon: "🏛" },
    { href: "/dashboard/reports", label: "Batch Performance", icon: "📈" },
  ],
  STUDENT: [
    { href: "/dashboard", label: "My Learning Dashboard", icon: "❖" },
    { href: "/dashboard/assessments", label: "CBT Mock Tests & PYQs", icon: "⏱" },
    { href: "/dashboard/courses", label: "My Courses & DPPs", icon: "▤" },
    { href: "/dashboard/assignments", label: "My Assignments", icon: "✎" },
    { href: "/dashboard/fees", label: "My Fee Installments", icon: "₹" },
    { href: "/dashboard/announcements", label: "Notice Board", icon: "🔔" },
    { href: "/dashboard/reports", label: "Weak Chapter Analytics", icon: "📈" },
    { href: "/dashboard/attendance", label: "My Attendance Log", icon: "✓" },
  ],
  PARENT: [
    { href: "/dashboard", label: "Guardian Overview", icon: "❖" },
    { href: "/dashboard/announcements", label: "Circulars & Notices", icon: "🔔" },
  ],
  COORDINATOR: [
    { href: "/dashboard", label: "Academic Overview", icon: "❖" },
    { href: "/dashboard/batches", label: "Batches & Classrooms", icon: "⊞" },
    { href: "/dashboard/students", label: "Student Directory", icon: "⚑" },
    { href: "/dashboard/teachers", label: "Faculty Directory", icon: "◈" },
    { href: "/dashboard/courses", label: "Courses & DPPs", icon: "▤" },
    { href: "/dashboard/assignments", label: "Assignments", icon: "✎" },
    { href: "/dashboard/assessments", label: "Assessments & PYQs", icon: "⏱" },
    { href: "/dashboard/attendance", label: "Daily Attendance", icon: "✓" },
    { href: "/dashboard/announcements", label: "Notice Board", icon: "🔔" },
    { href: "/dashboard/campuses", label: "Campus Rooms", icon: "🏛" },
    { href: "/dashboard/reports", label: "Reports & Analytics", icon: "📈" },
  ],
  ACCOUNTANT: [
    { href: "/dashboard", label: "Finance Overview", icon: "❖" },
    { href: "/dashboard/fees", label: "Fee Management", icon: "₹" },
    { href: "/dashboard/reports", label: "Financial Reports", icon: "📈" },
  ],
};

function mapMembershipRole(role: string): AppRole {
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
  onRoleChange?: (role: AppRole) => void;
}>) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [membershipRole, setMembershipRole] = useState<AppRole>("DIRECTOR");

  useEffect(() => {
    let cancelled = false;
    const handleOrganizationChange = (event: Event) => {
      const role = (event as CustomEvent<{ role?: string }>).detail?.role ?? "";
      setMembershipRole(mapMembershipRole(role));
    };
    window.addEventListener("prepzii:organization-changed", handleOrganizationChange);
    void fetch("/api/organizations/active", { cache: "no-store" }).then(async (response) => {
      if (!cancelled && response.ok) setMembershipRole(mapMembershipRole(String((await response.json()).role ?? "")));
    });
    return () => { cancelled = true; window.removeEventListener("prepzii:organization-changed", handleOrganizationChange); };
  }, [pathname]);

  const activeRole: AppRole = propRole || membershipRole;

  const navItems = roleNavItems[activeRole] || roleNavItems.DIRECTOR;
  return (
    <main className="app-shell">
      <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="brand-row">
          <Link href="/">
            <PrepziiMark theme="dark" />
          </Link>
          <span className="inst-pill">INSTITUTIONS</span>
        </div>

        <OrganizationSwitcher />

        <nav className="side-nav">
          {navItems.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={isActive ? "active" : ""}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <a href="#settings">Institute Settings</a>
          <a href="#support">Help & Support</a>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <span className="mobile-brand">
              <PrepziiMark compact theme="light" />
            </span>
            <p className="header-subtitle">{subtitle || "Saturday, 10 October 2026"}</p>
            <h1>{title || "Institute Overview"}</h1>
          </div>

          <div className="header-actions">
            <button aria-label="Search" title="Quick Search">⌕</button>
            <button aria-label="Notifications" title="Announcements">◉</button>
            <ZiAssistantBadge text="Ask Zi AI" />

            {action || (
              <Link href="/dashboard/assessments" className="create-button pz-button pz-button-primary">
                ＋ Create Assessment
              </Link>
            )}
          </div>
        </header>

        {children}

        <footer className="workspace-footer">
          PrepZii JEE & NEET Coaching LMS · Multi-Tenant Platform
        </footer>
      </section>
    </main>
  );
}

export function DashboardLayout(props: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  currentRole?: AppRole;
  onRoleChange?: (role: AppRole) => void;
}>) {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>Loading workspace...</div>}>
      <LayoutContent {...props} />
    </Suspense>
  );
}
