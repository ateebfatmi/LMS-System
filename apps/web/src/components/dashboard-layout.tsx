"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type PropsWithChildren, useState, Suspense } from "react";
import { PrepziiMark } from "@prepzii/ui";

export type AppRole = "DIRECTOR" | "FACULTY" | "STUDENT" | "PARENT";

const roleNavItems: Record<AppRole, { href: string; label: string; icon: string }[]> = {
  DIRECTOR: [
    { href: "/dashboard", label: "Overview", icon: "01" },
    { href: "/dashboard/batches", label: "Batches", icon: "02" },
    { href: "/dashboard/students", label: "Students", icon: "03" },
    { href: "/dashboard/teachers", label: "Faculty", icon: "04" },
    { href: "/dashboard/courses", label: "Courses & DPPs", icon: "05" },
    { href: "/dashboard/assessments", label: "Assessments & PYQs", icon: "06" },
    { href: "/dashboard/attendance", label: "Attendance", icon: "07" },
    { href: "/dashboard/reports", label: "Reports & Analytics", icon: "08" },
  ],
  FACULTY: [
    { href: "/dashboard?role=FACULTY", label: "My Classes & Schedule", icon: "01" },
    { href: "/dashboard/batches", label: "My Batches", icon: "02" },
    { href: "/dashboard/attendance", label: "Mark Attendance", icon: "03" },
    { href: "/dashboard/courses", label: "Upload DPPs & Notes", icon: "04" },
    { href: "/dashboard/assessments", label: "Create & Evaluate Tests", icon: "05" },
    { href: "/dashboard/reports", label: "Batch Performance", icon: "06" },
  ],
  STUDENT: [
    { href: "/dashboard?role=STUDENT", label: "My Learning Dashboard", icon: "01" },
    { href: "/dashboard/assessments", label: "CBT Mock Tests & PYQs", icon: "02" },
    { href: "/dashboard/courses", label: "My Courses & DPPs", icon: "03" },
    { href: "/dashboard/reports", label: "Weak Chapter Analytics", icon: "04" },
    { href: "/dashboard/attendance", label: "My Attendance Log", icon: "05" },
  ],
  PARENT: [
    { href: "/dashboard?role=PARENT", label: "Child Progress Overview", icon: "01" },
    { href: "/dashboard/reports", label: "Test Rank Cards", icon: "02" },
    { href: "/dashboard/attendance", label: "Attendance Calendar", icon: "03" },
    { href: "/dashboard/teachers", label: "Connect with Teachers", icon: "04" },
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
  onRoleChange,
}: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  currentRole?: AppRole;
  onRoleChange?: (role: AppRole) => void;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const urlRole = (searchParams?.get("role") as AppRole) || undefined;
  const activeRole: AppRole = propRole || urlRole || "DIRECTOR";

  const handleRoleSelect = (role: AppRole) => {
    if (onRoleChange) {
      onRoleChange(role);
    } else {
      router.push(`/dashboard?role=${role}`);
    }
  };

  const navItems = roleNavItems[activeRole] || roleNavItems.DIRECTOR;
  const currentProfile = roleInfo[activeRole];

  return (
    <main className="app-shell">
      <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="brand-row">
          <Link href="/">
            <PrepziiMark theme="dark" />
          </Link>
          <span>Institutions</span>
        </div>

        {/* Role Switcher Pill */}
        <div className="org-switcher" style={{ background: "rgba(250, 204, 21, 0.08)", borderColor: "rgba(250, 204, 21, 0.25)" }}>
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
          <div className="profile-mini">
            <span>{currentProfile.avatar}</span>
            <p>
              <strong>{currentProfile.name}</strong>
              <small>{currentProfile.title}</small>
            </p>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <span className="mobile-brand">
              <PrepziiMark compact theme="light" />
            </span>
            <p>{subtitle || "Saturday, 10 October 2026"}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <h1>{title || "Institute Overview"}</h1>
            </div>
          </div>

          <div className="header-actions" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* Role Switcher Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#ffffff", border: "1px solid var(--line)", padding: "4px 6px", borderRadius: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", paddingLeft: "6px" }}>View as:</span>
              <button
                onClick={() => handleRoleSelect("DIRECTOR")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: activeRole === "DIRECTOR" ? "var(--brand)" : "transparent",
                  color: activeRole === "DIRECTOR" ? "#0f172a" : "var(--muted)",
                }}
              >
                🏢 Director
              </button>
              <button
                onClick={() => handleRoleSelect("FACULTY")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: activeRole === "FACULTY" ? "var(--brand)" : "transparent",
                  color: activeRole === "FACULTY" ? "#0f172a" : "var(--muted)",
                }}
              >
                👨‍🏫 Faculty
              </button>
              <button
                onClick={() => handleRoleSelect("STUDENT")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: activeRole === "STUDENT" ? "var(--brand)" : "transparent",
                  color: activeRole === "STUDENT" ? "#0f172a" : "var(--muted)",
                }}
              >
                👨‍🎓 Student
              </button>
              <button
                onClick={() => handleRoleSelect("PARENT")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: activeRole === "PARENT" ? "var(--brand)" : "transparent",
                  color: activeRole === "PARENT" ? "#0f172a" : "var(--muted)",
                }}
              >
                👨‍👩‍👧 Parent
              </button>
            </div>

            {action || (
              <Link href="/dashboard/assessments" className="create-button pz-button pz-button-primary">
                ＋ Create Assessment
              </Link>
            )}
          </div>
        </header>

        {children}

        <footer className="workspace-footer">
          PrepZii JEE & NEET Coaching LMS · Role View: <strong>{activeRole}</strong> · Multi-Tenant Platform
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
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading workspace...</div>}>
      <LayoutContent {...props} />
    </Suspense>
  );
}
