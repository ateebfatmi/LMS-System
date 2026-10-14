"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout, type AppRole } from "@/components/dashboard-layout";
import { mockAnnouncements } from "@/lib/mock-data";
import type { Announcement } from "@prepzii/contracts";

interface BroadcastLogItem {
  id: string;
  circularTitle: string;
  audience: string;
  channels: string[];
  sentAt: string;
  recipientsCount: number;
  deliveryRate: string;
  status: "DELIVERED" | "QUEUED";
}

const mockBroadcastLogs: BroadcastLogItem[] = [
  {
    id: "log-1",
    circularTitle: "Diwali Break & All-India Revision Series Schedule",
    audience: "All Students, Faculty & Parents",
    channels: ["PORTAL", "WHATSAPP", "SMS"],
    sentAt: "2026-10-09 08:00 AM",
    recipientsCount: 420,
    deliveryRate: "99.5%",
    status: "DELIVERED",
  },
  {
    id: "log-2",
    circularTitle: "All-India PrepZii Mock 05 (JEE Advanced Paper 1 & 2) Timings",
    audience: "JEE 12A - Titans",
    channels: ["PORTAL", "WHATSAPP"],
    sentAt: "2026-10-08 11:30 AM",
    recipientsCount: 42,
    deliveryRate: "100%",
    status: "DELIVERED",
  },
  {
    id: "log-3",
    circularTitle: "Mandatory Parent-Teacher Meeting (PTM) for Term 1 Rank Card Review",
    audience: "All Parents (Class 11 & 12)",
    channels: ["PORTAL", "WHATSAPP", "SMS"],
    sentAt: "2026-10-07 09:45 AM",
    recipientsCount: 165,
    deliveryRate: "98.8%",
    status: "DELIVERED",
  },
  {
    id: "log-4",
    circularTitle: "Term 2 Tuition Installment Due Reminder",
    audience: "Class 11 Parents (With Pending Dues)",
    channels: ["PORTAL", "SMS"],
    sentAt: "2026-10-06 02:10 PM",
    recipientsCount: 28,
    deliveryRate: "100%",
    status: "DELIVERED",
  },
];

function AnnouncementsContent() {
  const searchParams = useSearchParams();
  const currentRole = (searchParams?.get("role") as AppRole) || "DIRECTOR";

  const [announcements, setAnnouncements] = useState<Announcement[]>(mockAnnouncements);
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLogItem[]>(mockBroadcastLogs);
  const [activeTab, setActiveTab] = useState<"ALL" | "BATCHES" | "PARENTS" | "FACULTY" | "LOGS">("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [acknowledgedIds, setAcknowledgedIds] = useState<Record<string, boolean>>({
    "ann-1": true,
  });

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Circular Form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<"ACADEMIC" | "EXAM" | "HOLIDAY" | "FEE" | "GENERAL">("ACADEMIC");
  const [newPriority, setNewPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("HIGH");
  const [newAudience, setNewAudience] = useState<"ALL" | "BATCH" | "FACULTY" | "PARENTS">("ALL");
  const [newBatchName, setNewBatchName] = useState("JEE 12A - Titans");
  const [channelPortal, setChannelPortal] = useState(true);
  const [channelWhatsApp, setChannelWhatsApp] = useState(true);
  const [channelSMS, setChannelSMS] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const channels: ("PORTAL" | "WHATSAPP" | "SMS")[] = [];
    if (channelPortal) channels.push("PORTAL");
    if (channelWhatsApp) channels.push("WHATSAPP");
    if (channelSMS) channels.push("SMS");

    const newNotice: Announcement = {
      id: `ann-${Date.now()}`,
      organizationId: "org-1",
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      priority: newPriority,
      targetAudience: newAudience,
      batchName: newAudience === "BATCH" ? newBatchName : undefined,
      broadcastChannels: channels,
      createdAt: new Date().toISOString(),
    };

    setAnnouncements([newNotice, ...announcements]);

    // Also add to broadcast logs if external channels selected
    if (channelWhatsApp || channelSMS) {
      const newLog: BroadcastLogItem = {
        id: `log-${Date.now()}`,
        circularTitle: newTitle.trim(),
        audience:
          newAudience === "ALL"
            ? "All Campuses & Batches"
            : newAudience === "BATCH"
            ? newBatchName
            : newAudience === "PARENTS"
            ? "All Parents"
            : "All Faculty",
        channels,
        sentAt: "Just now",
        recipientsCount: newAudience === "BATCH" ? 42 : newAudience === "FACULTY" ? 18 : 340,
        deliveryRate: "100%",
        status: "DELIVERED",
      };
      setBroadcastLogs([newLog, ...broadcastLogs]);
    }

    setShowCreateModal(false);
    setNewTitle("");
    setNewContent("");
    showToast(`Circular "${newTitle.slice(0, 30)}..." published and broadcast successfully!`);
  };

  const handleResendWhatsApp = (notice: Announcement) => {
    showToast(`WhatsApp broadcast re-triggered for "${notice.title.slice(0, 32)}..." to ${notice.targetAudience === "BATCH" ? notice.batchName : "all registered recipients"}`);
  };

  const toggleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Filter logic based on audience tabs & search
  const filteredAnnouncements = announcements.filter((item) => {
    // Role filter
    if (currentRole === "STUDENT") {
      if (item.targetAudience === "FACULTY") return false;
      if (item.targetAudience === "PARENTS" && item.category === "FEE") return false;
    }
    if (currentRole === "PARENT") {
      if (item.targetAudience === "FACULTY") return false;
    }
    if (currentRole === "FACULTY") {
      if (item.targetAudience === "PARENTS" && item.category === "FEE") return false;
    }

    // Tab filter
    if (activeTab === "BATCHES" && item.targetAudience !== "BATCH") return false;
    if (activeTab === "PARENTS" && item.targetAudience !== "PARENTS") return false;
    if (activeTab === "FACULTY" && item.targetAudience !== "FACULTY") return false;

    // Category filter
    if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchContent = item.content.toLowerCase().includes(q);
      const matchBatch = item.batchName?.toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchBatch) return false;
    }

    return true;
  });

  const urgentCount = announcements.filter((a) => a.priority === "URGENT" || a.priority === "HIGH").length;
  const examCount = announcements.filter((a) => a.category === "EXAM").length;

  return (
    <DashboardLayout
      title={
        currentRole === "STUDENT"
          ? "Institute Notice Board & Timetable Updates"
          : currentRole === "PARENT"
          ? "Official Circulars & PTM Notices"
          : "Institute Notice Board & Circular Broadcaster"
      }
      subtitle={
        currentRole === "STUDENT"
          ? "Official notifications, mock exam schedules, holiday breaks, and syllabus pacing notes"
          : currentRole === "PARENT"
          ? "Direct institute communications, PTM schedules, holiday announcements, and academic updates"
          : "Publish institutional notices, manage parent circulars, and broadcast updates across Portal, WhatsApp & SMS"
      }
      action={
        (currentRole === "DIRECTOR" || currentRole === "FACULTY") ? (
          <div className="flex items-center gap-3">
            <Button
              className="bg-brand text-brand-foreground hover:bg-brand/90 font-semibold shadow-md flex items-center gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Publish Circular</span>
            </Button>
          </div>
        ) : undefined
      }
    >
      {/* Toast Banner */}
      {toastMessage && (
        <div className="mb-6 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400/80 hover:text-emerald-200 text-xs uppercase font-bold tracking-wider">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Active Circulars"
          value={announcements.length.toString()}
          detail="Institutional announcements in circulation"
          accent="yellow"
        />
        <MetricCard
          label="Urgent & High Priority"
          value={urgentCount.toString()}
          detail="Immediate attention notices"
          accent="orange"
        />
        <MetricCard
          label="Upcoming Exam Notices"
          value={examCount.toString()}
          detail="CBT Mock tests & PYQ series"
          accent="violet"
        />
        <MetricCard
          label="Omnichannel Delivery"
          value="99.4%"
          detail="Portal, WhatsApp & SMS receipt rate"
          accent="green"
        />
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "ALL"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            All Circulars ({announcements.length})
          </button>
          <button
            onClick={() => setActiveTab("BATCHES")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "BATCHES"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            Student & Batches
          </button>
          <button
            onClick={() => setActiveTab("PARENTS")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "PARENTS"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            Parent Communications & PTMs
          </button>
          {(currentRole === "DIRECTOR" || currentRole === "FACULTY") && (
            <button
              onClick={() => setActiveTab("FACULTY")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === "FACULTY"
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              Faculty Notices
            </button>
          )}
          {currentRole === "DIRECTOR" && (
            <button
              onClick={() => setActiveTab("LOGS")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === "LOGS"
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              Broadcast Delivery Logs
            </button>
          )}
        </div>

        {/* Search Input */}
        {activeTab !== "LOGS" && (
          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="Search circulars or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card/60 border border-border/80 rounded-xl px-3.5 py-1.5 pl-9 text-sm text-foreground focus:outline-none focus:border-brand/70"
            />
            <svg
              className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Category Pills (Visible when not in Logs tab) */}
      {activeTab !== "LOGS" && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mr-1">Category:</span>
          {["ALL", "ACADEMIC", "EXAM", "HOLIDAY", "FEE", "GENERAL"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                selectedCategory === cat
                  ? "border-brand bg-brand/10 text-brand font-bold"
                  : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}
        </div>
      )}

      {/* TAB CONTENT: LOGS */}
      {activeTab === "LOGS" && currentRole === "DIRECTOR" ? (
        <Panel
          title="Institutional Omnichannel Broadcast Logs"
          subtitle="Detailed delivery reports for notices dispatched via Web Portal, WhatsApp Gateway, and SMS"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/20 border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Circular Title</th>
                  <th className="py-3 px-4">Audience</th>
                  <th className="py-3 px-4">Channels</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Recipients</th>
                  <th className="py-3 px-4">Delivery Rate</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {broadcastLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      {log.circularTitle}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{log.audience}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {log.channels.includes("PORTAL") && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            PORTAL
                          </span>
                        )}
                        {log.channels.includes("WHATSAPP") && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            WA
                          </span>
                        )}
                        {log.channels.includes("SMS") && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                            SMS
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground text-xs">{log.sentAt}</td>
                    <td className="py-3.5 px-4 font-mono font-medium">{log.recipientsCount}</td>
                    <td className="py-3.5 px-4">
                      <span className="text-emerald-400 font-semibold font-mono">{log.deliveryRate}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Badge variant="success">DELIVERED</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        /* CIRCULAR CARDS GRID */
        <div className="grid grid-cols-1 gap-5">
          {filteredAnnouncements.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card/40">
              <p className="text-muted-foreground text-sm">No circulars match your current filter or search criteria.</p>
              <Button
                variant="outline"
                className="mt-3 text-xs"
                onClick={() => {
                  setSelectedCategory("ALL");
                  setSearchQuery("");
                  setActiveTab("ALL");
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            filteredAnnouncements.map((notice) => {
              const isAcknowledged = !!acknowledgedIds[notice.id];

              return (
                <div
                  key={notice.id}
                  className={`rounded-2xl border p-5 sm:p-6 transition-all ${
                    notice.priority === "URGENT"
                      ? "bg-red-500/5 border-red-500/30 shadow-md shadow-red-500/5"
                      : notice.priority === "HIGH"
                      ? "bg-amber-500/5 border-amber-500/25"
                      : "bg-card/70 border-border/70 hover:border-border"
                  }`}
                >
                  {/* Top Bar: Official Letterhead Info & Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border/60 flex items-center justify-center font-bold text-xs text-brand">
                        PZ
                      </div>
                      <div>
                        <div className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <span>PrepZii Academic Directorate</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-foreground/80">CIR-{notice.id.toUpperCase()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(notice.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Priority Badge */}
                      {notice.priority === "URGENT" && (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                          URGENT
                        </span>
                      )}
                      {notice.priority === "HIGH" && (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          HIGH PRIORITY
                        </span>
                      )}
                      {notice.priority === "NORMAL" && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/40 text-muted-foreground border border-border/50">
                          NORMAL
                        </span>
                      )}

                      {/* Category Badge */}
                      {notice.category && (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-brand/15 text-brand border border-brand/30">
                          {notice.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Circular Title */}
                  <h3 className="text-lg font-bold text-foreground mb-2.5 flex items-center gap-2">
                    <span>{notice.title}</span>
                  </h3>

                  {/* Circular Content */}
                  <p className="text-sm text-foreground/85 leading-relaxed mb-4 whitespace-pre-line bg-muted/10 p-3.5 rounded-xl border border-border/30">
                    {notice.content}
                  </p>

                  {/* Footer Bar: Audience, Channels, Signatory, Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Target Audience Pill */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-card px-2.5 py-1 rounded-lg border border-border/60">
                        <span className="font-semibold text-foreground/80">Audience:</span>
                        {notice.targetAudience === "ALL" && <span>All Campuses & Batches</span>}
                        {notice.targetAudience === "BATCH" && (
                          <span className="text-brand font-semibold">{notice.batchName || "Batch Specific"}</span>
                        )}
                        {notice.targetAudience === "PARENTS" && <span className="text-amber-300 font-medium">All Parents</span>}
                        {notice.targetAudience === "FACULTY" && <span className="text-sky-300 font-medium">Faculty & Academic Team</span>}
                      </div>

                      {/* Dispatched Channels */}
                      {notice.broadcastChannels && notice.broadcastChannels.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="text-[11px] uppercase tracking-wider">Channels:</span>
                          {notice.broadcastChannels.map((ch) => (
                            <span
                              key={ch}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted/30 border border-border/50 text-foreground/80"
                            >
                              {ch === "PORTAL" ? "🌐 Portal" : ch === "WHATSAPP" ? "📱 WhatsApp" : "✉️ SMS"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Role Actions */}
                      {currentRole === "DIRECTOR" && (
                        <Button
                          variant="outline"
                          className="text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5"
                          onClick={() => handleResendWhatsApp(notice)}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span>Resend WA Alert</span>
                        </Button>
                      )}

                      {(currentRole === "STUDENT" || currentRole === "PARENT") && (
                        <button
                          onClick={() => toggleAcknowledge(notice.id)}
                          className={`text-xs px-3.5 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all ${
                            isAcknowledged
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                              : "bg-brand/10 border-brand/30 text-brand hover:bg-brand/20"
                          }`}
                        >
                          {isAcknowledged ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Acknowledged</span>
                            </>
                          ) : (
                            <span>Mark Acknowledged</span>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText?.(`${notice.title}\n\n${notice.content}`);
                          showToast("Notice text copied to clipboard!");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-card border border-border/50"
                        title="Copy notice text"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CREATE NEW CIRCULAR MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand/20 border border-brand/40 flex items-center justify-center text-brand font-bold text-xs">
                  PZ
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Draft & Broadcast Circular</h3>
                  <p className="text-xs text-muted-foreground">Publish to LMS notice board and dispatch instant alerts</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-lg hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Circular Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. All-India Mock 06 Syllabus & Reporting Timings"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as "ACADEMIC" | "EXAM" | "HOLIDAY" | "FEE" | "GENERAL")}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                  >
                    <option value="ACADEMIC">Academic</option>
                    <option value="EXAM">Exam / Mock Test</option>
                    <option value="HOLIDAY">Holiday & Schedule</option>
                    <option value="FEE">Fee Dues Notice</option>
                    <option value="GENERAL">General Notice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as "NORMAL" | "HIGH" | "URGENT")}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent (Emergency Alert)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Target Audience
                  </label>
                  <select
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value as "ALL" | "BATCH" | "FACULTY" | "PARENTS")}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                  >
                    <option value="ALL">All Institute (Everyone)</option>
                    <option value="BATCH">Specific Batch</option>
                    <option value="PARENTS">All Parents</option>
                    <option value="FACULTY">Faculty & Staff</option>
                  </select>
                </div>

                {newAudience === "BATCH" ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Select Batch
                    </label>
                    <select
                      value={newBatchName}
                      onChange={(e) => setNewBatchName(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                    >
                      <option value="JEE 12A - Titans">JEE 12A - Titans</option>
                      <option value="JEE 11B - Nucleus">JEE 11B - Nucleus</option>
                      <option value="NEET 12 - Medico Super 50">NEET 12 - Medico Super 50</option>
                      <option value="Foundation 10 - Olympiad">Foundation 10 - Olympiad</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Author / Signatory
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Ateeb Fatmi (Managing Director)"
                      className="w-full bg-muted/40 border border-border/50 rounded-xl px-3 py-2 text-sm text-muted-foreground"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Circular Content & Instructions *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type the official notification text clearly..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                />
              </div>

              {/* Omnichannel Dispatch Options */}
              <div className="bg-muted/20 border border-border/60 rounded-xl p-3.5 space-y-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                  Broadcast Channels
                </span>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channelPortal}
                      onChange={(e) => setChannelPortal(e.target.checked)}
                      className="rounded accent-brand"
                    />
                    <span>🌐 Student/Parent Portal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channelWhatsApp}
                      onChange={(e) => setChannelWhatsApp(e.target.checked)}
                      className="rounded accent-brand"
                    />
                    <span className="text-emerald-400 font-medium">📱 WhatsApp Broadcast</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channelSMS}
                      onChange={(e) => setChannelSMS(e.target.checked)}
                      className="rounded accent-brand"
                    />
                    <span>✉️ SMS Gateway</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand text-brand-foreground hover:bg-brand/90 font-semibold">
                  Publish & Broadcast
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function AnnouncementsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
          Loading Notice Board...
        </div>
      }
    >
      <AnnouncementsContent />
    </Suspense>
  );
}
