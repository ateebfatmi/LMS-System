"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type PropsWithChildren, useState, Suspense } from "react";
import { PrepziiMark, ZiAssistantBadge } from "@prepzii/ui";

export type AppRole = "DIRECTOR" | "FACULTY" | "STUDENT" | "PARENT";

const roleNavItems: Record<AppRole, { href: string; label: string; icon: string }[]> = {
  DIRECTOR: [
    { href: "/dashboard", label: "Executive Overview", icon: "❖" },
    { href: "/dashboard/crm", label: "Admissions CRM", icon: "◎" },
    { href: "/dashboard/batches", label: "Batches & Classrooms", icon: "⊞" },
    { href: "/dashboard/students", label: "Student Directory", icon: "⚑" },
    { href: "/dashboard/teachers", label: "Faculty Directory", icon: "◈" },
    { href: "/dashboard/courses", label: "Courses & DPPs", icon: "▤" },
    { href: "/dashboard/assessments", label: "Assessments & PYQs", icon: "⏱" },
    { href: "/dashboard/attendance", label: "Daily Attendance", icon: "✓" },
    { href: "/dashboard/fees", label: "Fee Management", icon: "₹" },
    { href: "/dashboard/announcements", label: "Notice Board", icon: "🔔" },
    { href: "/dashboard/campuses", label: "Campus Rooms", icon: "🏛" },
    { href: "/dashboard/reports", label: "Reports & Analytics", icon: "📈" },
    { href: "/dashboard/billing", label: "Plan & Quotas", icon: "💎" },
  ],
  FACULTY: [
    { href: "/dashboard?role=FACULTY", label: "My Classes & Schedule", icon: "❖" },
    { href: "/dashboard/batches", label: "My Batches", icon: "⊞" },
    { href: "/dashboard/attendance", label: "Mark Attendance", icon: "✓" },
    { href: "/dashboard/courses", label: "Upload DPPs & Notes", icon: "▤" },
    { href: "/dashboard/assessments", label: "Create & Evaluate Tests", icon: "⏱" },
    { href: "/dashboard/announcements", label: "Notice Board", icon: "🔔" },
    { href: "/dashboard/campuses", label: "Room Allocations", icon: "🏛" },
    { href: "/dashboard/reports", label: "Batch Performance", icon: "📈" },
  ],
  STUDENT: [
    { href: "/dashboard?role=STUDENT", label: "My Learning Dashboard", icon: "❖" },
    { href: "/dashboard/assessments", label: "CBT Mock Tests & PYQs", icon: "⏱" },
    { href: "/dashboard/courses", label: "My Courses & DPPs", icon: "▤" },
    { href: "/dashboard/fees?role=STUDENT", label: "My Fee Installments", icon: "₹" },
    { href: "/dashboard/announcements", label: "Notice Board", icon: "🔔" },
    { href: "/dashboard/reports", label: "Weak Chapter Analytics", icon: "📈" },
    { href: "/dashboard/attendance", label: "My Attendance Log", icon: "✓" },
  ],
  PARENT: [
    { href: "/dashboard?role=PARENT", label: "Child Progress Overview", icon: "❖" },
    { href: "/dashboard/fees?role=PARENT", label: "Fee Dues & Receipts", icon: "₹" },
    { href: "/dashboard/announcements", label: "Circulars & Notices", icon: "🔔" },
    { href: "/dashboard/reports", label: "Test Rank Cards", icon: "📈" },
    { href: "/dashboard/attendance", label: "Attendance Calendar", icon: "✓" },
    { href: "/dashboard/teachers", label: "Connect with Teachers", icon: "◈" },
  ],
};

const roleInfo: Record<AppRole, { name: string; title: string; avatar: string; color: string }> = {
  DIRECTOR: { name: "Ateeb Fatmi", title: "Managing Director", avatar: "AF", color: "var(--brand)" },
  FACULTY: { name: "Er. Vivek Gupta", title: "Senior Physics Faculty", avatar: "VG", color: "#60a5fa" },
  STUDENT: { name: "Aarav Sharma", title: "Class 12 JEE Advanced (Titans)", avatar: "AS", color: "#4ade80" },
  PARENT: { name: "Rajesh Sharma", title: "Parent of Aarav Sharma", avatar: "RS", color: "#f87171" },
};

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
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const urlRole = (searchParams?.get("role") as AppRole) || undefined;
  const activeRole: AppRole = propRole || urlRole || "DIRECTOR";

  const navItems = roleNavItems[activeRole] || roleNavItems.DIRECTOR;
  const currentProfile = roleInfo[activeRole];

  return (
    <main className="app-shell">
      <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="brand-row">
          <Link href="/">
            <PrepziiMark theme="dark" />
          </Link>
          <span className="inst-pill">INSTITUTIONS</span>
        </div>

        {/* Profile Card */}
        <div className="org-switcher">
          <span className="org-avatar" style={{ background: currentProfile.color, color: "#0f172a" }}>
            {currentProfile.avatar}
          </span>
          <span>
            <strong>{currentProfile.name}</strong>
            <small style={{ color: "var(--brand)" }}>{currentProfile.title}</small>
          </span>
        </div>

        <nav className="side-nav">
          {navItems.map((item) => {
            const isActive =
              item.href.includes("role=")
                ? pathname === "/dashboard" && searchParams?.get("role") === activeRole
                : item.href === "/dashboard"
                ? pathname === "/dashboard" && !searchParams?.get("role")
                : pathname.startsWith(item.href);

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
