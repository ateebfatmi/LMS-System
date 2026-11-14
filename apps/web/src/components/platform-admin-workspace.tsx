"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  ContactRound,
  Download,
  Gem,
  LayoutDashboard,
  Lock,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  School,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Mail,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, MetricCard, PrepziiMark, Select } from "@prepzii/ui";

type Row = Record<string, unknown>;

type Data = {
  institutes: Row[];
  subscriptions: Row[];
  plans: Row[];
  flags: Row[];
  overrides: Row[];
  audits: Row[];
  ownerInvitations: Row[];
  counts: Row[];
  brandings: Row[];
  demoRequests: Row[];
  supportRequests: Row[];
};

type AdminSection =
  | "overview"
  | "institutes"
  | "invitations"
  | "plans"
  | "demos"
  | "flags"
  | "broadcasts"
  | "support"
  | "audits";

const empty: Data = {
  institutes: [],
  subscriptions: [],
  plans: [],
  flags: [],
  overrides: [],
  audits: [],
  ownerInvitations: [],
  counts: [],
  brandings: [],
  demoRequests: [],
  supportRequests: [],
};

const INSTITUTE_TYPES = [
  { value: "COACHING", label: "Coaching Institute" },
  { value: "TUITION", label: "Tuition Centre" },
  { value: "SCHOOL", label: "School" },
  { value: "ONLINE_ACADEMY", label: "Online Academy" },
  { value: "INDIVIDUAL_TUTOR", label: "Individual Tutor" },
  { value: "OTHER", label: "Other" },
] as const;

const ENTITLEMENT_KEYS = [
  { key: "assessments", label: "CBT Assessments" },
  { key: "assignments", label: "Assignments & Submissions" },
  { key: "attendance", label: "Session Attendance" },
] as const;

const SECTION_META: Record<AdminSection, { title: string; subtitle: string; icon: LucideIcon }> = {
  overview: {
    title: "Overview",
    subtitle: "Institute access and subscription activity",
    icon: LayoutDashboard,
  },
  institutes: {
    title: "Institutes",
    subtitle: "Institute details, invitations, and access",
    icon: School,
  },
  invitations: {
    title: "Owner invitations",
    subtitle: "Track and manage institute owner access.",
    icon: Mail,
  },
  plans: {
    title: "Subscriptions",
    subtitle: "SaaS subscription tiers, pricing, limits & module entitlements",
    icon: Gem,
  },
  demos: {
    title: "Demo Leads & B2B Sales",
    subtitle: "Inbound institute inquiries",
    icon: ContactRound,
  },
  flags: {
    title: "Platform Settings",
    subtitle: "Platform-wide rollout switches, beta capabilities & emergency killswitches",
    icon: SlidersHorizontal,
  },
  broadcasts: {
    title: "System Broadcasts",
    subtitle: "Dispatch official platform announcements across active institute portals",
    icon: Megaphone,
  },
  support: {
    title: "Support Access",
    subtitle: "Time-bounded, audited support windows for tenant troubleshooting",
    icon: ShieldCheck,
  },
  audits: {
    title: "Audit Logs",
    subtitle: "Recent administrative and provisioning activity",
    icon: ScrollText,
  },
};

const money = (paise: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(paise ?? 0) / 100);

export function PlatformAdminWorkspace() {
  const router = useRouter();
  const { signOut } = useClerk();
  const [data, setData] = useState<Data>(empty);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminSection>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fleet filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");



  // Demo Leads filter
  const [demoStatusFilter, setDemoStatusFilter] = useState("ALL");

  // Audit filter
  const [auditSearch, setAuditSearch] = useState("");

  // Feedback state
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Create Institute Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstName, setNewInstName] = useState("");
  const [newInstSlug, setNewInstSlug] = useState("");
  const [newInstPlan, setNewInstPlan] = useState("basic");
  const [newInstType, setNewInstType] = useState("COACHING");
  const [newInstEmail, setNewInstEmail] = useState("");
  const [newInstPhone, setNewInstPhone] = useState("");
  const [newInstOwnerEmail, setNewInstOwnerEmail] = useState("");
  const [newInstSubStatus, setNewInstSubStatus] = useState<"ACTIVE" | "TRIAL">("ACTIVE");

  // Create Commercial Plan Modal
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [newPlanId, setNewPlanId] = useState("");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanMonthly, setNewPlanMonthly] = useState("4999");
  const [newPlanAnnual, setNewPlanAnnual] = useState("49990");
  const [newPlanStudents, setNewPlanStudents] = useState("1000");
  const [newPlanBranches, setNewPlanBranches] = useState("5");
  const [newPlanStorage, setNewPlanStorage] = useState("100");

  // Provision User Modal

  // Create Demo Lead Modal
  const [showCreateDemoModal, setShowCreateDemoModal] = useState(false);
  const [demoName, setDemoName] = useState("");
  const [demoInst, setDemoInst] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPhone, setDemoPhone] = useState("");
  const [demoCity, setDemoCity] = useState("");
  const [demoCount, setDemoCount] = useState("100-500");
  const [demoPlan, setDemoPlan] = useState("growth");
  const [demoNotes, setDemoNotes] = useState("");

  // Quick Plan Assignment Modal
  const [selectedInstForPlan, setSelectedInstForPlan] = useState<Row | null>(null);

  // Deep Institute Governance Modal
  const [inspectedInstituteId, setInspectedInstituteId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"profile" | "billing" | "overrides" | "members">("profile");

  // Broadcast Form state
  const [broadcastOrgId, setBroadcastOrgId] = useState("ALL");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState("HIGH");
  const [broadcastAudience, setBroadcastAudience] = useState("ALL");

  // Support Access Form state
  const [supportOrgId, setSupportOrgId] = useState("");
  const [supportReason, setSupportReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/platform", { cache: "no-store" });
      const result = await response.json();
      if (response.ok) {
        setData({
          ...empty,
          ...result,
        });
        setLoaded(true);
        setError("");
      } else {
        setError(result.error ?? "Unable to load platform administration.");
      }
    } catch {
      setError("Unable to load platform administration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function mutate(action: string, payload: Row, customSuccessMessage?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/platform", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to save platform operation.");
      } else {
        setMessage(result.result?.emailSent === false && action !== "REVOKE_INITIAL_OWNER"
          ? "The workspace or invitation was saved. Email delivery failed. Retry from the institute directory."
          : result.result?.previousRevoked === false
            ? "LMS access was revoked. Review the old Clerk invitation in the Clerk Dashboard."
            : customSuccessMessage ?? "Platform operation saved and audited.");
        await load();
      }
      setBusy(false);
      return response.ok;
    } catch {
      setError("Failed to execute platform mutation.");
      setBusy(false);
      return false;
    }
  }

  async function handleLockSession() {
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  async function handleEnterInstituteWorkspace(inst: Row) {
    try {
      const response = await fetch("/api/organizations/active", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: inst.slug }),
      });
      if (response.ok) router.push("/dashboard/workspace");
      else setError("This account has no active membership in that institute.");
    } catch {
      setError("Unable to open this institute.");
    }
  }

  async function handleCreateInstitute(e: FormEvent) {
    e.preventDefault();
    if (!newInstName.trim() || !newInstSlug.trim()) return;

    const ok = await mutate(
      "CREATE_INSTITUTE",
      {
        name: newInstName.trim(),
        slug: newInstSlug.trim(),
        planId: newInstPlan,
        instituteType: newInstType,
        contactEmail: newInstEmail.trim() || undefined,
        contactPhone: newInstPhone.trim() || undefined,
        ownerEmail: newInstOwnerEmail.trim(),
        subscriptionStatus: newInstSubStatus,
      },
      "Institute created and owner invitation issued."
    );

    if (ok) {
      setShowCreateModal(false);
      setNewInstName("");
      setNewInstSlug("");
      setNewInstEmail("");
      setNewInstPhone("");
      setNewInstOwnerEmail("");
    }
  }

  async function handleCreatePlan(e: FormEvent) {
    e.preventDefault();
    if (!newPlanId.trim() || !newPlanName.trim()) return;

    const ok = await mutate(
      "CREATE_PLAN",
      {
        planId: newPlanId.trim().toLowerCase(),
        name: newPlanName.trim(),
        monthlyPricePaise: Math.round(Number(newPlanMonthly) * 100),
        annualPricePaise: Math.round(Number(newPlanAnnual) * 100),
        studentLimit: Number(newPlanStudents),
        branchLimit: Number(newPlanBranches),
        storageGb: Number(newPlanStorage),
        aiCreditsPerMonth: 0,
        entitlements: {
          assessments: true,
          assignments: true,
          attendance: true,
        },
      },
      `Commercial plan "${newPlanName.trim()}" created.`
    );

    if (ok) {
      setShowCreatePlanModal(false);
      setNewPlanId("");
      setNewPlanName("");
    }
  }

  async function handleCreateDemoLead(e: FormEvent) {
    e.preventDefault();
    const ok = await mutate(
      "CREATE_DEMO_REQUEST",
      {
        fullName: demoName.trim(),
        instituteName: demoInst.trim(),
        email: demoEmail.trim(),
        phone: demoPhone.trim(),
        city: demoCity.trim(),
        studentCount: demoCount,
        interestedPlan: demoPlan,
        notes: demoNotes.trim() || undefined,
      },
      "Inbound B2B demo lead logged."
    );
    if (ok) {
      setShowCreateDemoModal(false);
      setDemoName("");
      setDemoInst("");
      setDemoEmail("");
      setDemoPhone("");
      setDemoCity("");
      setDemoNotes("");
    }
  }

  async function handleBroadcast(e: FormEvent) {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastContent.trim()) return;
    const ok = await mutate(
      "BROADCAST_ANNOUNCEMENT",
      {
        targetOrganizationId: broadcastOrgId === "ALL" ? null : broadcastOrgId,
        title: broadcastTitle.trim(),
        content: broadcastContent.trim(),
        priority: broadcastPriority,
        targetAudience: broadcastAudience,
      },
      "System broadcast dispatched across target institute portals."
    );
    if (ok) {
      setBroadcastTitle("");
      setBroadcastContent("");
    }
  }

  async function handleGrantSupportAccess(e: FormEvent) {
    e.preventDefault();
    if (!supportOrgId || supportReason.trim().length < 10) return;
    const ok = await mutate(
      "REQUEST_SUPPORT_ACCESS",
      {
        organizationId: supportOrgId,
        reason: supportReason.trim(),
      },
      "Support request recorded for owner review."
    );
    if (ok) {
      setSupportReason("");
    }
  }

  async function handleAssignPlan(instId: string, planId: string, status?: string, extendDays?: number) {
    await mutate(
      "ASSIGN_ORGANIZATION_PLAN",
      {
        organizationId: instId,
        planId,
        ...(status ? { status } : {}),
        ...(extendDays ? { extendDays } : {}),
      },
      `Subscription updated to ${planId.toUpperCase()}.`
    );
    setSelectedInstForPlan(null);
  }

  async function updatePlan(event: FormEvent<HTMLFormElement>, plan: Row) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existingEntitlements = (plan.entitlements as Record<string, unknown>) ?? {};
    const updatedEntitlements: Record<string, unknown> = { ...existingEntitlements };

    for (const item of ENTITLEMENT_KEYS) {
      updatedEntitlements[item.key] = form.get(`ent_${item.key}`) === "on";
    }

    await mutate(
      "UPDATE_PLAN",
      {
        planId: plan.id,
        name: form.get("name"),
        monthlyPricePaise: Math.round(Number(form.get("monthly")) * 100),
        annualPricePaise: Math.round(Number(form.get("annual")) * 100),
        studentLimit: Number(form.get("students")),
        branchLimit: Number(form.get("branches")),
        storageGb: Number(form.get("storage")),
        aiCreditsPerMonth: 0,
        entitlements: updatedEntitlements,
        isActive: form.get("active") === "on",
      },
      `Plan "${String(form.get("name"))}" updated.`
    );
  }

  async function saveFlag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (
      await mutate("SET_FEATURE_FLAG", {
        key: form.get("key"),
        description: form.get("description"),
        enabled: form.get("enabled") === "on",
      })
    ) {
      formElement.reset();
    }
  }

  function exportAuditCsv() {
    const headers = ["Timestamp", "Action", "ActorUserId", "ActorRole", "TargetOrganizationId", "Details"];
    const rows = data.audits.map((a) => [
      String(a.created_at ?? ""),
      String(a.action ?? ""),
      String(a.actor_user_id ?? ""),
      String(a.actor_role ?? ""),
      String(a.target_organization_id ?? ""),
      JSON.stringify(a.details ?? {}).replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prepzii-security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Derived Fleet Stats
  const activeInstitutes = data.institutes.filter((item) => item.status === "ACTIVE").length;
  const suspendedInstitutes = data.institutes.filter((item) => item.status === "SUSPENDED").length;
  const pendingOwners = data.ownerInvitations.filter((invite) => invite.status === "PENDING").length;
  const activeSubscriptions = data.subscriptions.filter((subscription) => subscription.status === "ACTIVE").length;
  const trials = data.subscriptions.filter((subscription) => subscription.status === "TRIAL").length;
  const provisioning = data.audits.filter(({ action }) => action === "create_organization" ||
    action === "set_organization_status" || String(action).startsWith("owner_invitation_")).slice(0, 5);

  const pendingUpgrades = data.subscriptions.filter((sub) => Boolean(sub.requested_plan_id));
  const pendingDemos = data.demoRequests.filter((d) => d.status === "PENDING");

  // Filtered Institutes
  const filteredInstitutes = data.institutes.filter((item) => {
    const matchesSearch = `${item.name} ${item.slug} ${item.owner_user_id} ${item.contact_email ?? ""} ${item.contact_phone ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchesType = typeFilter === "ALL" || (item.institute_type ?? "COACHING") === typeFilter;

    const sub = data.subscriptions.find((s) => s.organization_id === item.id);
    const instPlan = (sub?.plan_id as string) || "none";
    const matchesPlan =
      planFilter === "ALL" || instPlan.toLowerCase() === planFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesPlan && matchesType;
  });

  // Filtered Demo Requests
  const filteredDemos = data.demoRequests.filter(
    (d) => demoStatusFilter === "ALL" || d.status === demoStatusFilter
  );

  // Filtered Audits
  const filteredAudits = data.audits.filter((a) =>
    `${a.action} ${a.actor_user_id} ${a.target_organization_id ?? ""} ${JSON.stringify(a.details ?? {})}`
      .toLowerCase()
      .includes(auditSearch.toLowerCase())
  );

  // Currently Inspected Institute
  const inspectedInstitute = inspectedInstituteId
    ? data.institutes.find((i) => String(i.id) === inspectedInstituteId) ?? null
    : null;

  const navItems: { id: AdminSection; label: string; icon: LucideIcon; count?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "institutes", label: "Institutes", icon: School, count: data.institutes.length },
    { id: "invitations", label: "Invitations", icon: Mail, count: pendingOwners },
    {
      id: "plans",
      label: "Subscriptions",
      icon: Gem,
      count: pendingUpgrades.length || undefined,
    },
    {
      id: "demos",
      label: "Demo Leads & Sales",
      icon: ContactRound,
      count: pendingDemos.length || data.demoRequests.length || undefined,
    },
    { id: "flags", label: "Platform Settings", icon: SlidersHorizontal, count: data.flags.length },
    { id: "broadcasts", label: "System Broadcasts", icon: Megaphone },
    {
      id: "support",
      label: "Support Access",
      icon: ShieldCheck,
      count: data.supportRequests.filter((r) => r.status === "APPROVED").length || undefined,
    },
    { id: "audits", label: "Audit Logs", icon: ScrollText, count: data.audits.length },
  ];

  const activeMeta = SECTION_META[activeTab];

  return (
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* =========================================================
          LEFT FLOATING SIDEBAR NAVIGATION DOCK (MATCHING LMS UI)
         ========================================================= */}
      <aside
        className={`sidebar dashboard-navbar ${sidebarCollapsed ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}
      >
        <div className="brand-row">
          <motion.div whileHover={{ rotate: 1.5, scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Link href="/super-admin" aria-label="PrepZii Super Admin">
              <PrepziiMark compact={sidebarCollapsed} theme="light" />
            </Link>
          </motion.div>
          <span className="inst-pill">SUPER ADMIN</span>
          <motion.button
            type="button"
            className="sidebar-collapse"
            onClick={() => setSidebarCollapsed((c) => !c)}
            whileTap={{ scale: 0.9 }}
            aria-label={sidebarCollapsed ? "Expand navigation" : "Minimize navigation"}
            title={sidebarCollapsed ? "Expand navigation" : "Minimize navigation"}
          >
            {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </motion.button>
          <motion.button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileMenuOpen(false)}
            whileTap={{ scale: 0.9 }}
            aria-label="Close navigation"
          >
            <X aria-hidden="true" />
          </motion.button>
        </div>

        {/* Super Admin Identity Card (matching OrganizationSwitcher style) */}
        <div className="org-switcher" style={{ cursor: "default" }}>
          <span className="org-avatar">SA</span>
          <span className="org-switcher-copy">
            <strong>Platform Root</strong>
            <small>Super Admin Terminal</small>
          </span>
          {!sidebarCollapsed && (
            <span
              title="Authenticated Root Session"
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "999px",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 8px rgba(34, 197, 94, 0.7)",
                flexShrink: 0,
              }}
            />
          )}
        </div>

        <div className="side-nav-heading">
          <span>Governance</span>
          <span>ROOT</span>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="side-nav" aria-label="Super Admin navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <motion.div key={item.id} whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }}>
                <a
                  href={`#${item.id}`}
                  className={isActive ? "active" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="side-nav-icon">
                    <Icon aria-hidden="true" strokeWidth={1.8} />
                  </span>
                  <span className="side-nav-label">{item.label}</span>
                  {!sidebarCollapsed && item.count !== undefined && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: "999px",
                        backgroundColor: isActive ? "rgba(250, 204, 21, 0.2)" : "#f1f5f9",
                        color: isActive ? "#facc15" : "#64748b",
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                  {isActive && (
                    <motion.span
                      className="side-nav-active-dot"
                      layoutId="active-superadmin-item"
                      style={{ marginLeft: item.count !== undefined ? "6px" : "auto" }}
                    />
                  )}
                </a>
              </motion.div>
            );
          })}
        </nav>

        {/* Sidebar Footer: Jump to Institute Portal & Lock Session */}
        <div className="sidebar-footer" style={{ display: "grid", gap: "8px" }}>
          <Link
            href="/dashboard/workspace"
            title={sidebarCollapsed ? "Institute Portal" : undefined}
            style={{
              display: "flex",
              width: "100%",
              minHeight: "42px",
              padding: "8px 10px",
              alignItems: "center",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: "11px",
              color: "#0f172a",
              background: "#fef9c3",
              border: "1px solid #fde047",
              borderRadius: "13px",
              fontSize: "13px",
              fontWeight: 650,
              textDecoration: "none",
            }}
          >
            <span
              className="side-nav-icon"
              style={{ background: "#ffffff", color: "#854d0e", borderColor: "#fde047" }}
            >
              <ArrowUpRight aria-hidden="true" strokeWidth={2} />
            </span>
            {!sidebarCollapsed && <span className="side-nav-label">Institute Portal</span>}
          </Link>

          <button
            type="button"
            className="sidebar-sign-out"
            onClick={() => void handleLockSession()}
            title={sidebarCollapsed ? "Lock Session" : undefined}
          >
            <span className="side-nav-icon">
              <Lock aria-hidden="true" strokeWidth={1.8} />
            </span>
            <span className="side-nav-label">Lock Session</span>
          </button>
        </div>
      </aside>

      {/* =========================================================
          RIGHT WORKSPACE AREA & FLOATING GLASS HEADER BAR
         ========================================================= */}
      <section className="workspace">
        <header className="workspace-header" style={{ flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div className="mobile-nav-row">
              <motion.button
                type="button"
                className="dashboard-menu-button"
                onClick={() => setMobileMenuOpen(true)}
                whileTap={{ scale: 0.9 }}
                aria-label="Open navigation"
              >
                <Menu aria-hidden="true" />
              </motion.button>
              <span className="mobile-brand">
                <PrepziiMark compact theme="light" />
              </span>
            </div>
            <p className="header-subtitle">{activeMeta.subtitle}</p>
            <h1>{activeMeta.title}</h1>
          </div>

          <div className="header-actions" style={{ flexWrap: "wrap" }}>
            {/* Live Telemetry Pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                backgroundColor: "#f8fafc",
                padding: "7px 14px",
                borderRadius: "999px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ color: "#16a34a" }}>●</span>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                height: "38px",
                padding: "0 13px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={13} />
              <span>Sync</span>
            </button>

            {(activeTab === "overview" || activeTab === "institutes") && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus size={15} style={{ marginRight: "4px" }} />
                Register Institute
              </Button>
            )}

            {activeTab === "plans" && (
              <Button onClick={() => setShowCreatePlanModal(true)}>
                <Plus size={15} style={{ marginRight: "4px" }} />
                Create Plan Tier
              </Button>
            )}

            {activeTab === "demos" && (
              <Button onClick={() => setShowCreateDemoModal(true)}>
                <Plus size={15} style={{ marginRight: "4px" }} />
                Log Demo Lead
              </Button>
            )}

            {activeTab === "audits" && (
              <Button onClick={exportAuditCsv}>
                <Download size={14} style={{ marginRight: "5px" }} />
                Export Audit CSV
              </Button>
            )}
          </div>
        </header>

        {/* Global Feedback Banners */}
        {error && (
          <div
            className="form-error"
            role="alert"
            style={{
              padding: "12px 16px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              color: "#991b1b",
              fontSize: "13.5px",
              marginBottom: "20px",
            }}
          >
            ⚠️ {error}
          </div>
        )}
        {message && (
          <div
            className="success-banner"
            role="status"
            style={{
              padding: "12px 16px",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "12px",
              color: "#166534",
              fontSize: "13.5px",
              marginBottom: "20px",
            }}
          >
            ✓ {message}
          </div>
        )}

        {/* =========================================================
            SECTION 1: COMMAND CENTER OVERVIEW
           ========================================================= */}
        {loading && <p role="status">Loading platform records…</p>}
        {loaded && <>
        {activeTab === "overview" && (
          <div style={{ display: "grid", gap: "24px" }}>
            <div className="metrics-grid">
              <MetricCard
                label="Registered Institutes"
                value={String(data.institutes.length)}
                detail={`${activeInstitutes} active · ${suspendedInstitutes} suspended`}
                accent="yellow"
              />
              <MetricCard label="Pending owner invitations" value={String(pendingOwners)}
                detail="Awaiting activation" accent="blue" />
              <MetricCard label="Active subscriptions" value={String(activeSubscriptions)}
                detail={`${trials} trials`} accent="green" />
            </div>
            <section className="panel">
              <h2>Recent provisioning activity</h2>
              {provisioning.length ? <ul>{provisioning.map((event) => <li key={String(event.id)}>
                {String(event.action).replaceAll("_", " ")} · {data.institutes.find(({ id }) => id === event.target_organization_id)?.name as string ?? "Institute"} · {new Date(String(event.created_at)).toLocaleString()}
              </li>)}</ul> : <p>No provisioning activity yet.</p>}
            </section>

            {/* Actionable Priority Queue */}
            {(pendingUpgrades.length > 0 || pendingDemos.length > 0) && (
              <div
                style={{
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "16px",
                  padding: "20px 24px",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <strong style={{ fontSize: "15px", color: "#92400e" }}>
                  ⚡ Priority Governance Queue ({pendingUpgrades.length + pendingDemos.length} items)
                </strong>

                {pendingUpgrades.map((sub) => {
                  const inst = data.institutes.find((i) => i.id === sub.organization_id);
                  return (
                    <div
                      key={String(sub.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: "#ffffff",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: "1px solid #fde68a",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                          Plan Upgrade Request: {String(inst?.name ?? sub.organization_id)}
                        </strong>
                        <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                          Current: <strong>{String(sub.plan_id).toUpperCase()}</strong> → Requested:{" "}
                          <strong style={{ color: "#ca8a04" }}>
                            {String(sub.requested_plan_id).toUpperCase()}
                          </strong>{" "}
                          ({String(sub.requested_billing_interval ?? "monthly")})
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void mutate("RESOLVE_PLAN_UPGRADE_REQUEST", {
                              organizationId: sub.organization_id,
                              decision: "APPROVE",
                            })
                          }
                        >
                          Approve Upgrade
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void mutate("RESOLVE_PLAN_UPGRADE_REQUEST", {
                              organizationId: sub.organization_id,
                              decision: "REJECT",
                            })
                          }
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {pendingDemos.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#ffffff",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: "1px solid #fde68a",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                        {pendingDemos.length} Inbound B2B Demo Request(s) Awaiting Review
                      </strong>
                      <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                        Provision a trial workspace in 1 click from Demo Leads & Sales.
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => setActiveTab("demos")}>
                      Review Leads →
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Active Institute Fleet Overview */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "18px",
                padding: "24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                    Active Institute Fleet Overview
                  </h2>
                  <small style={{ color: "#64748b" }}>
                    Direct governance and workspace jump for onboarded coaching academies
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("institutes")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ca8a04",
                    fontSize: "13px",
                    fontWeight: 750,
                    cursor: "pointer",
                  }}
                >
                  View All Institutes →
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data.institutes.slice(0, 6).map((inst) => {
                  const sub = data.subscriptions.find((s) => s.organization_id === inst.id);
                  const count = data.counts.find((c) => c.organizationId === inst.id);

                  return (
                    <div
                      key={String(inst.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>{String(inst.name)}</strong>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          <code>{String(inst.slug)}</code> · {String(inst.institute_type ?? "COACHING")} · Owner{" "}
                          {String(inst.owner_user_id).slice(0, 18)}…
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: "#e2e8f0",
                            color: "#334155",
                            textTransform: "uppercase",
                          }}
                        >
                          {String(sub?.plan_id ?? "No plan")}
                        </span>
                        <span style={{ fontSize: "13px", color: "#475569", fontWeight: 600 }}>
                          {Number(count?.activeStudents ?? 0)} Students · {Number(count?.activeStaff ?? 0)} Staff
                        </span>
                        <Badge variant={inst.status === "ACTIVE" ? "success" : "danger"}>
                          {String(inst.status)}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedInstituteId(String(inst.id));
                            setInspectorTab("profile");
                          }}
                          style={{
                            padding: "6px 11px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            backgroundColor: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#0f172a",
                            cursor: "pointer",
                          }}
                        >
                          Manage ⚙️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEnterInstituteWorkspace(inst)}
                          style={{
                            padding: "6px 11px",
                            borderRadius: "8px",
                            border: "1px solid #fde68a",
                            backgroundColor: "#fef9c3",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#854d0e",
                            cursor: "pointer",
                          }}
                        >
                          Enter Workspace ↗
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 2: INSTITUTES FLEET COMMAND
           ========================================================= */}
        {activeTab === "institutes" && (
          <div style={{ display: "grid", gap: "18px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 170px 170px 190px",
                gap: "12px",
                backgroundColor: "#ffffff",
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
              }}
            >
              <input
                type="text"
                placeholder="Search by institute name, workspace slug, email, or owner ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  height: "44px",
                  padding: "0 14px",
                  borderRadius: "10px",
                  border: "1px solid #dce2de",
                  outline: "none",
                  fontSize: "13.5px",
                }}
              />

              <Select value={statusFilter} onChange={(val) => setStatusFilter(val)}>
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended Only</option>
              </Select>

              <Select value={planFilter} onChange={(val) => setPlanFilter(val)}>
                <option value="ALL">All Plans</option>
                {data.plans.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.name)}
                  </option>
                ))}
                <option value="none">No Plan</option>
              </Select>

              <Select value={typeFilter} onChange={(val) => setTypeFilter(val)}>
                <option value="ALL">All Types</option>
                {INSTITUTE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              {filteredInstitutes.map((inst) => {
                const sub = data.subscriptions.find((s) => s.organization_id === inst.id);
                const count = data.counts.find((c) => c.organizationId === inst.id);
                const plan = data.plans.find((p) => p.id === sub?.plan_id);
                const branding = data.brandings.find((b) => b.organization_id === inst.id);
                const studentLimit = Number(plan?.student_limit ?? 100);
                const activeStus = Number(count?.activeStudents ?? 0);
                const quotaPercent = Math.min(100, Math.round((activeStus / studentLimit) * 100));

                return (
                  <div
                    key={String(inst.id)}
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "14px",
                      padding: "18px 20px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "20px",
                      flexWrap: "wrap",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    <div style={{ minWidth: "270px", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "15.5px", color: "#0f172a" }}>{String(inst.name)}</strong>
                        <Badge variant={inst.status === "ACTIVE" ? "success" : "danger"}>
                          {String(inst.status)}
                        </Badge>
                        <Badge variant="neutral">{String(inst.institute_type ?? "COACHING")}</Badge>
                        {Boolean(sub?.status && sub.status !== "ACTIVE") && (
                          <Badge variant="warning">SUB: {String(sub?.status)}</Badge>
                        )}
                      </div>

                      <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "4px" }}>
                        <span>
                          institutes.prepzii.com/<strong>{String(inst.slug)}</strong>
                        </span>
                        {branding?.subdomain ? (
                          <span style={{ marginLeft: "8px", color: "#0284c7", fontWeight: 600 }}>
                            · Custom: {String(branding.subdomain)}.prepzii.com{" "}
                            {branding.subdomain_verified_at ? "✓" : "(unverified)"}
                          </span>
                        ) : null}
                      </div>

                      <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "3px" }}>
                        Owner: <code>{String(inst.owner_user_id)}</code>
                        {inst.contact_email ? ` · ${String(inst.contact_email)}` : ""}
                        {inst.contact_phone ? ` · ${String(inst.contact_phone)}` : ""}
                      </div>
                    </div>

                    <div style={{ minWidth: "230px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          marginBottom: "4px",
                        }}
                      >
                        <span style={{ color: "#64748b" }}>Student Quota</span>
                        <strong style={{ color: "#0f172a" }}>
                          {activeStus} / {studentLimit} ({quotaPercent}%)
                        </strong>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "6px",
                          backgroundColor: "#f1f5f9",
                          borderRadius: "999px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${quotaPercent}%`,
                            height: "100%",
                            backgroundColor: quotaPercent > 90 ? "#ef4444" : "#ca8a04",
                            borderRadius: "999px",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "5px" }}>
                        {Number(count?.activeStaff ?? 0)} Staff · {Number(count?.activeBatches ?? 0)} Batches
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedInstituteId(String(inst.id));
                          setInspectorTab("profile");
                        }}
                        style={{
                          padding: "7px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#ffffff",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#0f172a",
                          cursor: "pointer",
                        }}
                      >
                        Manage ⚙️
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEnterInstituteWorkspace(inst)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: "8px",
                          border: "1px solid #fde68a",
                          backgroundColor: "#fef9c3",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#854d0e",
                          cursor: "pointer",
                        }}
                      >
                        Enter Portal ↗
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedInstForPlan(inst)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: "8px",
                          border: "1px solid #dce2de",
                          backgroundColor: "#f8fafc",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#334155",
                          cursor: "pointer",
                        }}
                      >
                        Plan: {String(sub?.plan_id ?? "none").toUpperCase()} ▾
                      </button>

                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          const suspending = inst.status === "ACTIVE";
                          if (window.confirm(`${suspending ? "Suspend access to" : "Reactivate"} ${String(inst.name)}?`)) {
                            void mutate("SET_ORGANIZATION_STATUS", {
                              organizationId: inst.id,
                              status: suspending ? "SUSPENDED" : "ACTIVE",
                            });
                          }
                        }}
                        style={{
                          color: inst.status === "ACTIVE" ? "#ef4444" : "#166534",
                          borderColor: inst.status === "ACTIVE" ? "#fecaca" : "#bbf7d0",
                          backgroundColor: inst.status === "ACTIVE" ? "#fef2f2" : "#f0fdf4",
                          fontSize: "12.5px",
                        }}
                      >
                        {inst.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                      </Button>
                    </div>
                    <OwnerInvitationControls institute={inst} invitations={data.ownerInvitations ?? []} busy={busy} mutate={mutate} />
                  </div>
                );
              })}

              {filteredInstitutes.length === 0 && (
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    padding: "40px",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  No institutes match the active search criteria.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 3: GLOBAL USERS & ACCESS DIRECTORY
           ========================================================= */}
        {activeTab === "invitations" && (
          <section className="panel">
            {data.ownerInvitations.length === 0 ? <p>No owner invitations yet.</p> : data.institutes
              .filter((institute) => data.ownerInvitations.some((invite) => invite.organization_id === institute.id))
              .map((institute) => <article className="invitation-row" key={String(institute.id)}>
                <strong>{String(institute.name)}</strong>
                <OwnerInvitationControls institute={institute} invitations={data.ownerInvitations} busy={busy} mutate={mutate} />
              </article>)}
          </section>
        )}

        {activeTab === "plans" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {data.plans.map((plan) => {
                const entitlements = (plan.entitlements as Record<string, unknown>) ?? {};
                return (
                  <form
                    key={String(plan.id)}
                    className="admin-plan-card"
                    onSubmit={(event) => void updatePlan(event, plan)}
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "14px",
                      padding: "20px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    <div className="plan-card-header">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                        <span className="plan-id-tag">{String(plan.id).toUpperCase()}</span>
                        <input
                          name="name"
                          defaultValue={String(plan.name)}
                          placeholder="Plan name"
                          className="plan-name-input"
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <label
                          className="check-row"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "13px",
                            cursor: "pointer",
                            margin: 0,
                          }}
                        >
                          <input name="active" type="checkbox" defaultChecked={Boolean(plan.is_active)} />
                          <span>Active for New Signups</span>
                        </label>
                        <Button disabled={busy} type="submit">
                          Save Plan Changes
                        </Button>
                      </div>
                    </div>

                    <div className="plan-card-fields">
                      <label>
                        <span>Monthly Price (₹)</span>
                        <input
                          name="monthly"
                          type="number"
                          min="0"
                          defaultValue={Number(plan.monthly_price_paise) / 100}
                        />
                      </label>
                      <label>
                        <span>Annual Price (₹)</span>
                        <input
                          name="annual"
                          type="number"
                          min="0"
                          defaultValue={Number(plan.annual_price_paise) / 100}
                        />
                      </label>
                      <label>
                        <span>Student Limit</span>
                        <input
                          name="students"
                          type="number"
                          min="1"
                          defaultValue={Number(plan.student_limit)}
                        />
                      </label>
                      <label>
                        <span>Branch/Campus Limit</span>
                        <input
                          name="branches"
                          type="number"
                          min="1"
                          defaultValue={Number(plan.branch_limit)}
                        />
                      </label>
                      <label>
                        <span>Storage (GB)</span>
                        <input
                          name="storage"
                          type="number"
                          min="1"
                          defaultValue={Number(plan.storage_gb)}
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid #f1f5f9",
                        paddingTop: "12px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "14px",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        Included Modules:
                      </span>
                      {ENTITLEMENT_KEYS.map((item) => {
                        const checked =
                          entitlements[item.key] !== undefined
                            ? Boolean(entitlements[item.key])
                            : true;
                        return (
                          <label
                            key={item.key}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "12.5px",
                              color: "#334155",
                              cursor: "pointer",
                              backgroundColor: "#f8fafc",
                              padding: "4px 10px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <input
                              type="checkbox"
                              name={`ent_${item.key}`}
                              defaultChecked={checked}
                            />
                            <span>{item.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </form>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 5: DEMO LEADS & B2B ONBOARDING PIPELINE
           ========================================================= */}
        {activeTab === "demos" && (
          <div style={{ display: "grid", gap: "18px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#ffffff",
                padding: "16px 20px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                  Inbound B2B Institute Inquiries
                </h2>
                <small style={{ color: "#64748b" }}>
                  Convert inbound coaching institute requests into live workspaces with a single click
                </small>
              </div>
              <div style={{ width: "220px" }}>
                <Select value={demoStatusFilter} onChange={(val) => setDemoStatusFilter(val)}>
                  <option value="ALL">All Lead Statuses</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="DEMO_GIVEN">Demo Given</option>
                  <option value="ONBOARDED">Onboarded</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
              </div>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              {filteredDemos.map((demo) => (
                <div
                  key={String(demo.id)}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                        {String(demo.institute_name)}
                      </strong>
                      <Badge
                        variant={
                          demo.status === "ONBOARDED"
                            ? "success"
                            : demo.status === "PENDING"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {String(demo.status)}
                      </Badge>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          backgroundColor: "#fef9c3",
                          color: "#854d0e",
                          textTransform: "uppercase",
                        }}
                      >
                        Interested: {String(demo.interested_plan ?? "growth")}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", marginTop: "4px" }}>
                      Contact: <strong>{String(demo.full_name)}</strong> · {String(demo.email)} ·{" "}
                      {String(demo.phone)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      City: {String(demo.city)} · Est. Students: {String(demo.student_count)}
                      {demo.notes ? ` · Notes: "${String(demo.notes)}"` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ width: "170px" }}>
                      <Select
                        value={String(demo.status)}
                        onChange={(newStatus) =>
                          void mutate("UPDATE_DEMO_REQUEST", {
                            requestId: demo.id,
                            status: newStatus,
                          })
                        }
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="CONTACTED">CONTACTED</option>
                        <option value="DEMO_GIVEN">DEMO_GIVEN</option>
                        <option value="ONBOARDED">ONBOARDED</option>
                        <option value="REJECTED">REJECTED</option>
                      </Select>
                    </div>

                  </div>
                </div>
              ))}

              {filteredDemos.length === 0 && (
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    padding: "40px",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  No demo requests found. Click &ldquo;+ Log Demo Lead&rdquo; in the top bar to record a new B2B inquiry.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 6: FEATURE SWITCHES
           ========================================================= */}
        {activeTab === "flags" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: "20px", alignItems: "start" }}>
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "20px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h2 style={{ fontSize: "17px", fontWeight: 800, margin: "0 0 16px 0", color: "#0f172a" }}>
                Platform Feature Flags & Killswitches
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data.flags.map((flag) => (
                  <div
                    key={String(flag.key)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: "1px solid #f1f5f9",
                      backgroundColor: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize: "14px",
                          color: "#0f172a",
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {String(flag.key)}
                      </strong>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        {String(flag.description)}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Badge variant={flag.enabled_by_default ? "success" : "neutral"}>
                        {flag.enabled_by_default ? "ENABLED" : "DISABLED"}
                      </Badge>
                      <button
                        type="button"
                        onClick={() =>
                          void mutate("SET_FEATURE_FLAG", {
                            key: flag.key,
                            description: flag.description,
                            enabled: !flag.enabled_by_default,
                          })
                        }
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          backgroundColor: "#ffffff",
                          border: "1px solid #cbd5e1",
                          color: "#334155",
                        }}
                      >
                        Toggle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => void saveFlag(e)}
              style={{
                backgroundColor: "#ffffff",
                padding: "20px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                display: "grid",
                gap: "12px",
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Register New Feature Switch
              </h2>
              <input
                name="key"
                required
                placeholder="e.g. feature.ai_exam_generator"
                style={{
                  height: "40px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #dce2de",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
              <textarea
                name="description"
                required
                rows={3}
                placeholder="Rollout context and target capability description…"
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #dce2de",
                  fontSize: "13px",
                }}
              />
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <input name="enabled" type="checkbox" />
                <span>Enabled by default for all institutes</span>
              </label>
              <Button disabled={busy}>Register Switch</Button>
            </form>
          </div>
        )}

        {/* =========================================================
            SECTION 7: SYSTEM BROADCASTS
           ========================================================= */}
        {activeTab === "broadcasts" && (
          <form
            onSubmit={handleBroadcast}
            style={{
              backgroundColor: "#ffffff",
              padding: "26px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              display: "grid",
              gap: "16px",
              maxWidth: "820px",
            }}
          >
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                📢 Dispatch Platform-Wide Announcement
              </h2>
              <small style={{ color: "#64748b" }}>
                Publish an official notice to all active institutes simultaneously or target a single institute portal
              </small>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Target Scope
                </label>
                <Select value={broadcastOrgId} onChange={(val) => setBroadcastOrgId(val)}>
                  <option value="ALL">All Active Institutes ({activeInstitutes})</option>
                  {data.institutes.map((i) => (
                    <option key={String(i.id)} value={String(i.id)}>
                      {String(i.name)}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Priority Level
                </label>
                <Select value={broadcastPriority} onChange={(val) => setBroadcastPriority(val)}>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent Alert</option>
                </Select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Audience
                </label>
                <Select value={broadcastAudience} onChange={(val) => setBroadcastAudience(val)}>
                  <option value="ALL">Everyone</option>
                  <option value="TEACHERS">Faculty Only</option>
                  <option value="STUDENTS">Students Only</option>
                </Select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                Announcement Headline *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Scheduled NTA Mock Engine Maintenance Window"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 14px",
                  borderRadius: "10px",
                  border: "1px solid #dce2de",
                  fontSize: "13.5px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                Message Body *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Enter the official message that will appear in the notice boards of the target institutes…"
                value={broadcastContent}
                onChange={(e) => setBroadcastContent(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #dce2de",
                  fontSize: "13.5px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button disabled={busy || !broadcastTitle.trim() || !broadcastContent.trim()}>
                Dispatch Broadcast Now
              </Button>
            </div>
          </form>
        )}

        {/* =========================================================
            SECTION 8: TIME-BOUNDED SUPPORT ACCESS
           ========================================================= */}
        {activeTab === "support" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "20px", alignItems: "start" }}>
            <form
              onSubmit={handleGrantSupportAccess}
              style={{
                backgroundColor: "#ffffff",
                padding: "22px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                display: "grid",
                gap: "14px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "16.5px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                  🛡️ Authorize Support Access Window
                </h2>
                <small style={{ color: "#64748b" }}>
                  Request institute owner approval for troubleshooting. Tenant permissions stay tied to active membership.
                </small>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Target Institute *
                </label>
                <Select value={supportOrgId} onChange={(val) => setSupportOrgId(val)}>
                  <option value="">Select Institute…</option>
                  {data.institutes.map((i) => (
                    <option key={String(i.id)} value={String(i.id)}>
                      {String(i.name)}
                    </option>
                  ))}
                </Select>
              </div>



              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Audited Reason (min 10 chars) *
                </label>
                <input
                  type="text"
                  required
                  minLength={10}
                  placeholder="e.g. Investigating batch fee ledger sync"
                  value={supportReason}
                  onChange={(e) => setSupportReason(e.target.value)}
                  style={{
                    width: "100%",
                    height: "42px",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid #dce2de",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <Button disabled={busy || !supportOrgId || supportReason.trim().length < 10}>
                Authorize Support Window
              </Button>
            </form>

            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "22px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                display: "grid",
                gap: "12px",
              }}
            >
              <h2 style={{ fontSize: "16.5px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Active & Historical Support Grants
              </h2>

              {data.supportRequests.map((req) => {
                const inst = data.institutes.find((i) => i.id === req.organization_id);
                return (
                  <div
                    key={String(req.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      fontSize: "13px",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{String(inst?.name ?? req.organization_id)}</strong>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{String(req.reason)}</div>
                      {req.expires_at ? (
                        <small style={{ color: "#94a3b8", fontSize: "11px" }}>
                          Expires: {new Date(String(req.expires_at)).toLocaleString("en-IN")}
                        </small>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Badge variant={req.status === "APPROVED" ? "success" : "neutral"}>
                        {String(req.status)}
                      </Badge>
                      {req.status === "APPROVED" && (
                        <button
                          type="button"
                          onClick={() => void mutate("REVOKE_SUPPORT_ACCESS", { requestId: req.id })}
                          style={{
                            border: "1px solid #fecaca",
                            backgroundColor: "#fef2f2",
                            color: "#dc2626",
                            borderRadius: "6px",
                            padding: "4px 10px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {data.supportRequests.length === 0 && (
                <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                  No support access windows recorded yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 9: SECURITY AUDIT TRAIL
           ========================================================= */}
        {activeTab === "audits" && (
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              display: "grid",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                  Immutable Platform Audit Ledger
                </h2>
                <small style={{ color: "#64748b" }}>
                  Every super admin login, plan modification, quota adjustment, and status change is recorded
                </small>
              </div>
              <input
                type="text"
                placeholder="Filter by action, actor ID, or payload…"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                style={{
                  height: "40px",
                  width: "300px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #dce2de",
                  fontSize: "13px",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredAudits.map((audit) => {
                const targetInst = data.institutes.find((i) => i.id === audit.target_organization_id);
                return (
                  <div
                    key={String(audit.id)}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "10px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "14px",
                      fontSize: "13px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: "#0B1528",
                            color: "#FACC15",
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {String(audit.action).toUpperCase()}
                        </span>
                        <span style={{ color: "#334155" }}>
                          Actor: <strong>{String(audit.actor_user_id)}</strong>
                        </span>
                        {audit.target_organization_id ? (
                          <span style={{ color: "#ca8a04", fontWeight: 700, fontSize: "12px" }}>
                            → {targetInst ? String(targetInst.name) : String(audit.target_organization_id).slice(0, 8)}
                          </span>
                        ) : null}
                      </div>
                      {Boolean(audit.details && Object.keys(audit.details as object).length > 0) && (
                        <code style={{ fontSize: "11.5px", color: "#64748b" }}>
                          {JSON.stringify(audit.details)}
                        </code>
                      )}
                    </div>

                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {new Date(String(audit.created_at)).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}{" "}
                      IST
                    </div>
                  </div>
                );
              })}

              {filteredAudits.length === 0 && (
                <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                  No platform audit events match the filter.
                </div>
              )}
            </div>
          </div>
        )}
        </>}
      </section>

      {/* =========================================================
          DEEP INSTITUTE GOVERNANCE MODAL (INSPECT & MANAGE)
         ========================================================= */}
      {inspectedInstitute && (
        <InstituteGovernanceModal
          institute={inspectedInstitute}
          subscription={data.subscriptions.find((s) => s.organization_id === inspectedInstitute.id)}
          branding={data.brandings.find((b) => b.organization_id === inspectedInstitute.id)}
          counts={data.counts.find((c) => c.organizationId === inspectedInstitute.id)}
          plans={data.plans}
          flags={data.flags}
          overrides={data.overrides.filter((o) => o.organization_id === inspectedInstitute.id)}
          ownerInvitations={data.ownerInvitations}
          activeSubTab={inspectorTab}
          setActiveSubTab={setInspectorTab}
          busy={busy}
          onClose={() => setInspectedInstituteId(null)}
          onMutate={mutate}
          onEnterWorkspace={() => handleEnterInstituteWorkspace(inspectedInstitute)}
        />
      )}

      {/* =========================================================
          MODAL: REGISTER NEW INSTITUTE DIRECTLY
         ========================================================= */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            backdropFilter: "blur(6px)",
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              padding: "28px",
              width: "100%",
              maxWidth: "540px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Register New Coaching Institute
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInstitute} style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Institute Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Allen Career Institute"
                    value={newInstName}
                    onChange={(e) => {
                      setNewInstName(e.target.value);
                      if (!newInstSlug) {
                        setNewInstSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-+|-+$/g, "")
                        );
                      }
                    }}
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #dce2de",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Workspace Slug *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. allen-kota"
                    value={newInstSlug}
                    onChange={(e) =>
                      setNewInstSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "")
                      )
                    }
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #dce2de",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Institute Type
                  </label>
                  <Select value={newInstType} onChange={(val) => setNewInstType(val)}>
                    {INSTITUTE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Initial Commercial Plan
                  </label>
                  <Select value={newInstPlan} onChange={(val) => setNewInstPlan(val)}>
                    {data.plans.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.name)} ({String(p.student_limit)} Students)
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Owner Email
                  </label>
                  <input
                    type="email"
                    placeholder="director@institute.in"
                    value={newInstEmail}
                    onChange={(e) => setNewInstEmail(e.target.value)}
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #dce2de",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={newInstPhone}
                    onChange={(e) => setNewInstPhone(e.target.value)}
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #dce2de",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Initial owner email
                  </label>
                  <input
                    type="email"
                    required
                    aria-label="Initial owner email"
                    value={newInstOwnerEmail}
                    onChange={(e) => setNewInstOwnerEmail(e.target.value)}
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #dce2de",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Billing Status
                  </label>
                  <Select
                    value={newInstSubStatus}
                    onChange={(val) => setNewInstSubStatus(val as "ACTIVE" | "TRIAL")}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="TRIAL">14-Day TRIAL</option>
                  </Select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <Button disabled={busy || !newInstName.trim() || !newInstSlug.trim()}>
                  {busy ? "Registering…" : "Create Institute Workspace"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: CREATE COMMERCIAL PLAN
         ========================================================= */}
      {showCreatePlanModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            backdropFilter: "blur(6px)",
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              padding: "28px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Create New Commercial Plan Tier
              </h3>
              <button
                type="button"
                onClick={() => setShowCreatePlanModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Plan ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="enterprise"
                    value={newPlanId}
                    onChange={(e) => setNewPlanId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #dce2de",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enterprise Unlimited Plan"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #dce2de",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Monthly Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={newPlanMonthly}
                    onChange={(e) => setNewPlanMonthly(e.target.value)}
                    style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Annual Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={newPlanAnnual}
                    onChange={(e) => setNewPlanAnnual(e.target.value)}
                    style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Students
                  </label>
                  <input
                    type="number"
                    required
                    value={newPlanStudents}
                    onChange={(e) => setNewPlanStudents(e.target.value)}
                    style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Branches
                  </label>
                  <input
                    type="number"
                    required
                    value={newPlanBranches}
                    onChange={(e) => setNewPlanBranches(e.target.value)}
                    style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, marginBottom: "4px" }}>
                    Storage GB
                  </label>
                  <input
                    type="number"
                    required
                    value={newPlanStorage}
                    onChange={(e) => setNewPlanStorage(e.target.value)}
                    style={{ width: "100%", height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreatePlanModal(false)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "none", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <Button disabled={busy || !newPlanId.trim() || !newPlanName.trim()}>
                  Create Plan Tier
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: CREATE DEMO REQUEST LEAD
         ========================================================= */}
      {showCreateDemoModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            backdropFilter: "blur(6px)",
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              padding: "28px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Log Inbound B2B Demo Request
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateDemoModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDemoLead} style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <input
                  type="text"
                  required
                  placeholder="Contact Person Name *"
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                  style={{ height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de" }}
                />
                <input
                  type="text"
                  required
                  placeholder="Institute Name *"
                  value={demoInst}
                  onChange={(e) => setDemoInst(e.target.value)}
                  style={{ height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <input
                  type="email"
                  required
                  placeholder="Email Address *"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  style={{ height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de" }}
                />
                <input
                  type="text"
                  required
                  placeholder="Phone Number *"
                  value={demoPhone}
                  onChange={(e) => setDemoPhone(e.target.value)}
                  style={{ height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <input
                  type="text"
                  required
                  placeholder="City *"
                  value={demoCity}
                  onChange={(e) => setDemoCity(e.target.value)}
                  style={{ height: "44px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de" }}
                />
                <Select value={demoCount} onChange={(val) => setDemoCount(val)}>
                  <option value="Under 100">Under 100</option>
                  <option value="100-500">100–500</option>
                  <option value="500-1500">500–1,500</option>
                  <option value="1500+">1,500+</option>
                </Select>
                <Select value={demoPlan} onChange={(val) => setDemoPlan(val)}>
                  <option value="basic">Basic Plan</option>
                  <option value="growth">Growth Plan</option>
                  <option value="scale">Scale Plan</option>
                </Select>
              </div>

              <textarea
                rows={2}
                placeholder="Notes or requirements…"
                value={demoNotes}
                onChange={(e) => setDemoNotes(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid #dce2de" }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateDemoModal(false)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "none", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <Button disabled={busy}>Save Demo Lead</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: ASSIGN PLAN TO INSTITUTE
         ========================================================= */}
      {selectedInstForPlan && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              padding: "28px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <h3 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Assign Plan: {String(selectedInstForPlan.name)}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedInstForPlan(null)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
              Change the commercial tier for this institute. This updates student limits, storage quotas, and feature entitlements immediately.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.plans.map((p) => (
                <button
                  key={String(p.id)}
                  type="button"
                  onClick={() => void handleAssignPlan(String(selectedInstForPlan.id), String(p.id))}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#f8fafc",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef9c3")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                >
                  <div>
                    <div style={{ textTransform: "uppercase" }}>{String(p.name)}</div>
                    <small style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 500 }}>
                      {String(p.student_limit)} Students · {money(p.monthly_price_paise)}/mo
                    </small>
                  </div>
                  <span style={{ fontSize: "12px", color: "#854d0e" }}>Apply →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* =========================================================================
   DEEP INSTITUTE GOVERNANCE MODAL COMPONENT
   ========================================================================= */
function InstituteGovernanceModal({
  institute,
  subscription,
  branding,
  counts,
  plans,
  flags,
  overrides,
  ownerInvitations,
  activeSubTab,
  setActiveSubTab,
  busy,
  onClose,
  onMutate,
  onEnterWorkspace,
}: {
  institute: Row;
  subscription?: Row;
  branding?: Row;
  counts?: Row;
  plans: Row[];
  flags: Row[];
  overrides: Row[];
  ownerInvitations: Row[];
  activeSubTab: "profile" | "billing" | "overrides" | "members";
  setActiveSubTab: (t: "profile" | "billing" | "overrides" | "members") => void;
  busy: boolean;
  onClose: () => void;
  onMutate: (action: string, payload: Row, msg?: string) => Promise<boolean>;
  onEnterWorkspace: () => void;
}) {
  const [name, setName] = useState(String(institute.name ?? ""));
  const [slug, setSlug] = useState(String(institute.slug ?? ""));
  const [instType, setInstType] = useState(String(institute.institute_type ?? "COACHING"));
  const [email, setEmail] = useState(String(institute.contact_email ?? ""));
  const [phone, setPhone] = useState(String(institute.contact_phone ?? ""));
  const [color, setColor] = useState(String(branding?.primary_color ?? institute.primary_color ?? "#0B132B"));
  const [subdomain, setSubdomain] = useState(String(branding?.subdomain ?? ""));
  const [verifySubdomain, setVerifySubdomain] = useState(Boolean(branding?.subdomain_verified_at));

  // Billing controls
  const [subPlanId, setSubPlanId] = useState(String(subscription?.plan_id ?? "basic"));
  const [subStatus, setSubStatus] = useState(String(subscription?.status ?? "ACTIVE"));
  const [extendDays, setExtendDays] = useState("30");

  // Add Member inside Inspector

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    await onMutate(
      "UPDATE_INSTITUTE_DETAILS",
      {
        organizationId: institute.id,
        name: name.trim(),
        slug: slug.trim(),
        instituteType: instType,
        contactEmail: email.trim() || null,
        contactPhone: phone.trim() || null,
        primaryColor: color,
        subdomain: subdomain.trim() || null,
        verifySubdomain,
      },
      "Institute details and branding saved."
    );
  }

  async function saveBilling(e: FormEvent) {
    e.preventDefault();
    await onMutate(
      "ASSIGN_ORGANIZATION_PLAN",
      {
        organizationId: institute.id,
        planId: subPlanId,
        status: subStatus,
        extendDays: Number(extendDays) || 30,
      },
      "Subscription tier, status, and billing period updated."
    );
  }



  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(11, 21, 40, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2100,
        backdropFilter: "blur(6px)",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "820px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.4)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px 26px",
            backgroundColor: "#0B1528",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderRadius: "20px 20px 0 0",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>
                🏫 {String(institute.name)}
              </h3>
              <Badge variant={institute.status === "ACTIVE" ? "success" : "danger"}>
                {String(institute.status)}
              </Badge>
            </div>
            <small style={{ color: "#94a3b8", fontSize: "12px" }}>
              ID: {String(institute.id)} · Slug: {String(institute.slug)}
            </small>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={onEnterWorkspace}
              style={{
                padding: "7px 14px",
                borderRadius: "8px",
                backgroundColor: "#FACC15",
                color: "#0B1528",
                border: "none",
                fontSize: "12.5px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Enter Institute Portal ↗
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#ffffff",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "12px 26px 0",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
          }}
        >
          {[
            { id: "profile", label: "Profile & Branding" },
            { id: "billing", label: "Subscription & Quotas" },
            { id: "overrides", label: `Feature Overrides (${overrides.length})` },
            { id: "members", label: "Access summary" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSubTab(t.id as typeof activeSubTab)}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: activeSubTab === t.id ? "3px solid #ca8a04" : "3px solid transparent",
                backgroundColor: activeSubTab === t.id ? "#ffffff" : "transparent",
                color: activeSubTab === t.id ? "#0f172a" : "#64748b",
                fontWeight: activeSubTab === t.id ? 750 : 600,
                fontSize: "13px",
                cursor: "pointer",
                borderRadius: "8px 8px 0 0",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "24px 26px" }}>
          {activeSubTab === "profile" && (
            <form onSubmit={saveProfile} style={{ display: "grid", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Institute Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Workspace Slug
                  </label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Institute Category
                  </label>
                  <Select value={instType} onChange={(val) => setInstType(val)}>
                    {INSTITUTE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: "14px", alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Brand Hex Color
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Custom White-Label Subdomain
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. allen"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid #dce2de", boxSizing: "border-box" }}
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", height: "42px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={verifySubdomain}
                    onChange={(e) => setVerifySubdomain(e.target.checked)}
                  />
                  <span>Subdomain Verified</span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                <Button disabled={busy} type="submit">
                  Save Profile & Branding
                </Button>
              </div>
            </form>
          )}

          {activeSubTab === "billing" && (
            <div style={{ display: "grid", gap: "20px" }}>
              <form
                onSubmit={saveBilling}
                style={{
                  padding: "18px",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "grid",
                  gap: "14px",
                }}
              >
                <strong style={{ fontSize: "14.5px", color: "#0f172a" }}>
                  Subscription Tier & Billing Lifecycle
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                      Assigned Plan
                    </label>
                    <Select value={subPlanId} onChange={(val) => setSubPlanId(val)}>
                      {plans.map((p) => (
                        <option key={String(p.id)} value={String(p.id)}>
                          {String(p.name)}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                      Subscription Status
                    </label>
                    <Select value={subStatus} onChange={(val) => setSubStatus(val)}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="TRIAL">TRIAL</option>
                      <option value="PAST_DUE">PAST_DUE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </Select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                      Extend / Renew Period
                    </label>
                    <Select value={extendDays} onChange={(val) => setExtendDays(val)}>
                      <option value="14">+14 Days (Trial)</option>
                      <option value="30">+30 Days (Monthly)</option>
                      <option value="90">+90 Days (Quarterly)</option>
                      <option value="365">+365 Days (Annual)</option>
                    </Select>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <small style={{ color: "#64748b" }}>
                    Current Period Ends:{" "}
                    {subscription?.current_period_end
                      ? new Date(String(subscription.current_period_end)).toLocaleDateString("en-IN")
                      : "Not set"}
                  </small>
                  <Button disabled={busy} type="submit">
                    Update Subscription & Extend Period
                  </Button>
                </div>
              </form>

              <div
                style={{
                  padding: "18px",
                  borderRadius: "12px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <strong style={{ fontSize: "14.5px", color: "#0f172a" }}>
                  Current institute usage
                </strong>
                <div style={{ display: "grid", gap: "12px" }}>
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>Active Students / Staff</div>
                      <strong style={{ fontSize: "18px", color: "#0f172a" }}>
                        {Number(counts?.activeStudents ?? 0)} Students · {Number(counts?.activeStaff ?? 0)} Staff
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "overrides" && (
            <div style={{ display: "grid", gap: "12px" }}>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 6px 0" }}>
                Override global platform feature flags specifically for{" "}
                <strong>{String(institute.name)}</strong>.
              </p>
              {flags.map((flag) => {
                const ovr = overrides.find((o) => o.feature_key === flag.key);
                const effective = ovr ? Boolean(ovr.enabled) : Boolean(flag.enabled_by_default);

                return (
                  <div
                    key={String(flag.key)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "13.5px", fontFamily: "monospace", color: "#0f172a" }}>
                        {String(flag.key)}
                      </strong>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{String(flag.description)}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {ovr ? (
                        <Badge variant={effective ? "success" : "danger"}>
                          OVERRIDE: {effective ? "ON" : "OFF"}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">
                          DEFAULT ({flag.enabled_by_default ? "ON" : "OFF"})
                        </Badge>
                      )}

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void onMutate("SET_ORG_FEATURE_OVERRIDE", {
                            organizationId: institute.id,
                            featureKey: flag.key,
                            enabled: !effective,
                            reason: "Toggled in Super Admin Institute Inspector",
                          })
                        }
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Force {effective ? "OFF" : "ON"}
                      </button>

                      {ovr && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void onMutate("REMOVE_ORG_FEATURE_OVERRIDE", {
                              organizationId: institute.id,
                              featureKey: flag.key,
                            })
                          }
                          style={{
                            padding: "5px 10px",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                            backgroundColor: "transparent",
                            fontSize: "12px",
                            color: "#64748b",
                            cursor: "pointer",
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeSubTab === "members" && (
            <section>
              <p>Owner: {String(institute.owner_user_id).startsWith("pending_owner:") ? "Awaiting activation" : String(institute.owner_user_id)}</p>
              <p>Created {new Date(String(institute.created_at)).toLocaleDateString()}</p>
              <OwnerInvitationControls institute={institute} invitations={ownerInvitations} busy={busy} mutate={onMutate} />
              <h4>Active memberships by role</h4>
              <ul>{Object.entries((counts?.byRole ?? {}) as Record<string, number>).map(([role, count]) => (
                <li key={role}>{role.replaceAll("_", " ")} · {count}</li>
              ))}</ul>
              {!Object.keys((counts?.byRole ?? {}) as object).length && <p>No active memberships.</p>}
            </section>
          )}

        </div>
      </div>
    </div>
  );
}


function OwnerInvitationControls({ institute, invitations, busy, mutate }: {
  institute: Row;
  invitations: Row[];
  busy: boolean;
  mutate: (action: string, payload: Row, message?: string) => Promise<boolean>;
}) {
  const recent = invitations.find((invite) => invite.organization_id === institute.id);
  const awaitingOwner = String(institute.owner_user_id).startsWith("pending_owner:");
  if (!awaitingOwner && !recent) return null;
  const canReplace = recent?.status === "PENDING" || recent?.status === "EXPIRED";
  return (
    <section aria-label="Initial owner invitation">
      {recent && <p>Owner invitation · {String(recent.email)} · {String(recent.status)}
        {recent.status === "PENDING" && !recent.delivered ? " · Email delivery pending" : ""}</p>}
      {awaitingOwner && canReplace && (
        <>
          <Button disabled={busy || institute.status !== "ACTIVE"} onClick={() => void mutate("INVITE_INITIAL_OWNER", {
            organizationId: institute.id, email: recent.email, replaceId: recent.id,
          }, "Replacement owner invitation issued.")}>Resend owner invitation</Button>
          {recent.status === "PENDING" && <Button disabled={busy} onClick={() => {
            if (window.confirm("Revoke this owner invitation?")) void mutate("REVOKE_INITIAL_OWNER", {
              organizationId: institute.id, invitationId: recent.id,
            });
          }}>Revoke owner invitation</Button>}
        </>
      )}
      {awaitingOwner && !canReplace && institute.status === "ACTIVE" && (
        <form onSubmit={(event) => {
          event.preventDefault();
          void mutate("INVITE_INITIAL_OWNER", {
            organizationId: institute.id, email: new FormData(event.currentTarget).get("email"),
          });
        }}>
          <label>Owner email <input type="email" name="email" required /></label>
          <Button disabled={busy} type="submit">Invite initial owner</Button>
        </form>
      )}
    </section>
  );
}
