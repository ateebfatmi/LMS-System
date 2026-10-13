"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout, type AppRole } from "@/components/dashboard-layout";
import { mockCampusRooms, mockRoomSchedules } from "@/lib/mock-data";
import type { CampusRoom, RoomSchedule, RoomFacility } from "@prepzii/contracts";

const facilityLabels: Record<RoomFacility, { label: string; icon: string }> = {
  SMART_BOARD: { label: "Interactive Smart Board", icon: "🖥️" },
  PROJECTOR: { label: "HD Projector", icon: "📽️" },
  AC: { label: "Central AC", icon: "❄️" },
  LAB_BENCHES: { label: "Lab Benches & Apparatus", icon: "🔬" },
  CCTV: { label: "24/7 CCTV", icon: "📹" },
  AUDIO_MIC: { label: "Audio & PA System", icon: "🎙️" },
};

function CampusesContent() {
  const searchParams = useSearchParams();
  const currentRole = (searchParams?.get("role") as AppRole) || "DIRECTOR";

  const [rooms, setRooms] = useState<CampusRoom[]>(mockCampusRooms);
  const [schedules, setSchedules] = useState<RoomSchedule[]>(mockRoomSchedules);
  const [selectedCampus, setSelectedCampus] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"ROOMS" | "SCHEDULE_GRID" | "FACILITIES">("ROOMS");

  // Allocation Modal State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateRoomId, setAllocateRoomId] = useState<string>(rooms[0]?.id || "");
  const [allocateBatch, setAllocateBatch] = useState("JEE 12A - Titans");
  const [allocateFaculty, setAllocateFaculty] = useState("Er. Vivek Gupta");
  const [allocateSubject, setAllocateSubject] = useState("Physics (Electrodynamics)");
  const [allocateTimeSlot, setAllocateTimeSlot] = useState("02:00 PM - 04:00 PM");

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Aggregates
  const totalRooms = rooms.length;
  const inUseCount = rooms.filter((r) => r.status === "IN_USE").length;
  const availableCount = rooms.filter((r) => r.status === "AVAILABLE").length;
  const smartBoardCount = rooms.filter((r) => r.facilities.includes("SMART_BOARD")).length;
  const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);

  const filteredRooms = rooms.filter((r) => {
    if (selectedCampus !== "ALL" && r.campusName !== selectedCampus) return false;
    if (selectedStatusFilter !== "ALL" && r.status !== selectedStatusFilter) return false;
    return true;
  });

  const handleToggleRoomStatus = (roomId: string) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const newStatus = r.status === "IN_USE" ? "AVAILABLE" : r.status === "AVAILABLE" ? "IN_USE" : "AVAILABLE";
        const newBatch = newStatus === "AVAILABLE" ? undefined : r.currentBatch || "Self Study & Doubts";
        return {
          ...r,
          status: newStatus,
          currentBatch: newBatch,
        };
      })
    );
    showToast("Classroom allocation status updated!");
  };

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetRoom = rooms.find((r) => r.id === allocateRoomId);
    if (!targetRoom) return;

    // Add schedule entry
    const newSchedule: RoomSchedule = {
      id: `sch-${Date.now()}`,
      roomId: targetRoom.id,
      roomName: targetRoom.name,
      timeSlot: allocateTimeSlot,
      batchName: allocateBatch,
      facultyName: allocateFaculty,
      subject: allocateSubject,
    };

    setSchedules([newSchedule, ...schedules]);

    // Update room status to IN_USE
    setRooms((prev) =>
      prev.map((r) => (r.id === targetRoom.id ? { ...r, status: "IN_USE", currentBatch: allocateBatch } : r))
    );

    setShowAllocateModal(false);
    showToast(`Assigned ${targetRoom.name} to ${allocateBatch} (${allocateFaculty})`);
  };

  // Student batch's current room
  const studentRoom = rooms.find((r) => r.currentBatch?.includes("JEE 12A"));

  return (
    <DashboardLayout
      title={
        currentRole === "STUDENT"
          ? "My Batch Classroom & Lab Allotment"
          : currentRole === "PARENT"
          ? "Campus Infrastructure & Classroom Safety"
          : "Campus Classrooms & Smart Resource Manager"
      }
      subtitle={
        currentRole === "STUDENT"
          ? "Live classroom venue, lab allocations, and daily room transition schedule"
          : currentRole === "PARENT"
          ? "Air-conditioned smart lecture halls, lab safety compliance, and CCTV monitoring"
          : "Real-time room occupancy, smart board allocations, conflict-free batch scheduling, and campus branches"
      }
      action={
        (currentRole === "DIRECTOR" || currentRole === "FACULTY") ? (
          <Button
            className="bg-brand text-brand-foreground hover:bg-brand/90 font-semibold shadow-md flex items-center gap-2"
            onClick={() => {
              const availableRoom = rooms.find((r) => r.status === "AVAILABLE");
              if (availableRoom) setAllocateRoomId(availableRoom.id);
              setShowAllocateModal(true);
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Allocate Classroom</span>
          </Button>
        ) : undefined
      }
    >
      {/* Toast Notification */}
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

      {/* Student Banner View */}
      {currentRole === "STUDENT" && studentRoom && (
        <div className="mb-6 bg-brand/10 border border-brand/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand/20 border border-brand/40 flex items-center justify-center text-xl">
              🏫
            </div>
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-brand">Current Active Classroom</div>
              <h3 className="text-lg font-bold text-foreground">
                {studentRoom.name} · {studentRoom.campusName}
              </h3>
              <p className="text-xs text-muted-foreground">
                Batch: <strong className="text-foreground">{studentRoom.currentBatch}</strong> · Seating Capacity: {studentRoom.capacity} Students
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">LIVE SESSION IN PROGRESS</Badge>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total Lecture Rooms & Labs"
          value={totalRooms.toString()}
          detail={`${totalCapacity} combined seating capacity`}
          accent="navy"
        />
        <MetricCard
          label="Currently In Use"
          value={inUseCount.toString()}
          detail="Active batch lectures & labs"
          accent="blue"
        />
        <MetricCard
          label="Available Rooms"
          value={availableCount.toString()}
          detail="Free for doubt counters / revision"
          accent="green"
        />
        <MetricCard
          label="Smart Boards Equipped"
          value={`${smartBoardCount}/${totalRooms}`}
          detail="Interactive touchscreen display halls"
          accent="yellow"
        />
      </div>

      {/* Campus Selector & Main Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("ROOMS")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "ROOMS"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            Classroom Status & Cards ({rooms.length})
          </button>
          <button
            onClick={() => setActiveTab("SCHEDULE_GRID")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "SCHEDULE_GRID"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            Today&apos;s Time-Slot Schedule Grid
          </button>
          <button
            onClick={() => setActiveTab("FACILITIES")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "FACILITIES"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            Infrastructure & Lab Facilities
          </button>
        </div>

        {/* Campus Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Branch:</span>
          <select
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value)}
            className="bg-card/70 border border-border/80 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-brand"
          >
            <option value="ALL">All Campus Branches</option>
            <option value="North Campus">North Campus (Main Flagship)</option>
            <option value="South Delhi Branch">South Delhi Branch</option>
          </select>
        </div>
      </div>

      {/* TAB CONTENT: ROOMS CARDS */}
      {activeTab === "ROOMS" && (
        <div>
          {/* Quick Status Sub-filters */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mr-1">Status:</span>
            {["ALL", "IN_USE", "AVAILABLE", "MAINTENANCE"].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatusFilter(st)}
                className={`text-xs px-3 py-1 rounded-lg border transition-all ${
                  selectedStatusFilter === st
                    ? "border-brand bg-brand/10 text-brand font-bold"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {st === "ALL" ? "All Classrooms" : st === "IN_USE" ? "In Use" : st === "AVAILABLE" ? "Available" : "Maintenance"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRooms.map((room) => {
              const isInUse = room.status === "IN_USE";
              const isAvailable = room.status === "AVAILABLE";

              return (
                <div
                  key={room.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                    isInUse
                      ? "bg-card/80 border-border/80 shadow-sm"
                      : isAvailable
                      ? "bg-card/50 border-emerald-500/25 shadow-sm"
                      : "bg-card/30 border-amber-500/20"
                  }`}
                >
                  <div>
                    {/* Header: Campus & Status badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <span>📍</span>
                        <span>{room.campusName}</span>
                      </span>

                      {isInUse && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                          IN USE
                        </span>
                      )}
                      {isAvailable && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          AVAILABLE
                        </span>
                      )}
                      {room.status === "MAINTENANCE" && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          MAINTENANCE
                        </span>
                      )}
                    </div>

                    {/* Room Name & Seating */}
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-xl font-bold text-foreground">{room.name}</h3>
                      <span className="text-xs font-mono font-semibold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">
                        {room.capacity} Seats
                      </span>
                    </div>

                    {/* Current Batch Info */}
                    <div className="mb-4 bg-muted/20 border border-border/40 rounded-xl p-3 text-xs">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
                        Current Occupancy
                      </div>
                      {isInUse ? (
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                          <span>{room.currentBatch}</span>
                        </div>
                      ) : isAvailable ? (
                        <div className="text-emerald-400 font-medium">Free for allotment or self-study</div>
                      ) : (
                        <div className="text-amber-400 font-medium">Under scheduled maintenance</div>
                      )}
                    </div>

                    {/* Facility Tags */}
                    <div className="mb-4">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                        Smart Facilities
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {room.facilities.map((fac) => (
                          <span
                            key={fac}
                            className="px-2 py-0.5 rounded-md text-[11px] bg-card border border-border/60 text-foreground/80 flex items-center gap-1"
                            title={facilityLabels[fac]?.label}
                          >
                            <span>{facilityLabels[fac]?.icon}</span>
                            <span>{facilityLabels[fac]?.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="border-t border-border/40 pt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">ID: {room.id}</span>

                    {(currentRole === "DIRECTOR" || currentRole === "FACULTY") && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleRoomStatus(room.id)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                            isInUse
                              ? "border-border text-muted-foreground hover:text-foreground hover:bg-card"
                              : "border-brand/40 bg-brand/10 text-brand hover:bg-brand/20"
                          }`}
                        >
                          {isInUse ? "Release Room" : "Occupy Room"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: TODAY'S SCHEDULE GRID */}
      {activeTab === "SCHEDULE_GRID" && (
        <Panel
          title="Daily Classroom & Lab Time-Slot Schedule"
          subtitle="Live allocation of batches, faculty instructors, and subject modules across classrooms"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/20 border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Time Slot</th>
                  <th className="py-3 px-4">Classroom</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-4">Subject & Topic</th>
                  <th className="py-3 px-4">Faculty Instructor</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {schedules.map((sch) => (
                  <tr key={sch.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-foreground text-xs">
                      {sch.timeSlot}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-brand">
                      {sch.roomName}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      {sch.batchName}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground text-xs">
                      {sch.subject}
                    </td>
                    <td className="py-3.5 px-4 text-foreground/90 font-medium">
                      {sch.facultyName}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        SCHEDULED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* TAB CONTENT: FACILITIES & SAFETY */}
      {activeTab === "FACILITIES" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Panel
            title="Smart Classroom Technology Standards"
            subtitle="High-definition audiovisual and digital pedagogy infrastructure"
          >
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-xl bg-muted/15 border border-border/50">
                <div className="font-bold text-foreground flex items-center gap-2 mb-1">
                  <span>🖥️</span>
                  <span>4K Interactive Touch Panels</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Equipped with digital stylus pen, real-time screen annotation, and instant PDF lecture note export sent to students after class.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/15 border border-border/50">
                <div className="font-bold text-foreground flex items-center gap-2 mb-1">
                  <span>🎙️</span>
                  <span>Acoustic Microphones & Audio System</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ultra-clear wireless lapel microphones with multi-speaker ceiling distribution ensuring equal sound clarity up to row 12.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/15 border border-border/50">
                <div className="font-bold text-foreground flex items-center gap-2 mb-1">
                  <span>❄️</span>
                  <span>HVAC Climate Control</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Maintained at 22°C with high CFM air exchange filters for sustained concentration during 3-hour long marathon lecture sessions.
                </p>
              </div>
            </div>
          </Panel>

          <Panel
            title="Lab Safety & CCTV Monitoring"
            subtitle="Compliance standards for student security and laboratory safety"
          >
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-xl bg-muted/15 border border-border/50">
                <div className="font-bold text-foreground flex items-center gap-2 mb-1">
                  <span>📹</span>
                  <span>24/7 High-Definition CCTV Surveillance</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All lecture halls and corridors are under central security camera recording with 90-day video retention.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/15 border border-border/50">
                <div className="font-bold text-foreground flex items-center gap-2 mb-1">
                  <span>🔬</span>
                  <span>Chemistry & Biology Fume Hoods & First Aid</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Safety shower, eye-wash stations, fire retardant blankets, and certified first-aid cabinets in all experimental laboratories.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/15 border border-border/50">
                <div className="font-bold text-foreground flex items-center gap-2 mb-1">
                  <span>⚡</span>
                  <span>Uninterrupted Power Backup</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dual online 40kVA UPS systems with automatic diesel generator switchover ensuring zero outage during CBT mock examinations.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ALLOCATE ROOM MODAL */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand/20 border border-brand/40 flex items-center justify-center text-brand font-bold text-xs">
                  🏫
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Allocate Classroom / Lab</h3>
                  <p className="text-xs text-muted-foreground">Assign batch and faculty to lecture hall</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllocateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-lg hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAllocateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Classroom / Lab *
                </label>
                <select
                  value={allocateRoomId}
                  onChange={(e) => setAllocateRoomId(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.campusName}) — {r.capacity} Seats [{r.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Batch *
                  </label>
                  <select
                    value={allocateBatch}
                    onChange={(e) => setAllocateBatch(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                  >
                    <option value="JEE 12A - Titans">JEE 12A - Titans</option>
                    <option value="JEE 11B - Nucleus">JEE 11B - Nucleus</option>
                    <option value="NEET 12 - Medico Super 50">NEET 12 - Medico Super 50</option>
                    <option value="Foundation 10 - Olympiad">Foundation 10 - Olympiad</option>
                    <option value="All Batches (Auditorium)">All Batches (Auditorium)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Faculty Instructor *
                  </label>
                  <select
                    value={allocateFaculty}
                    onChange={(e) => setAllocateFaculty(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                  >
                    <option value="Er. Vivek Gupta">Er. Vivek Gupta (Physics)</option>
                    <option value="Dr. Ananya Ray">Dr. Ananya Ray (Chemistry)</option>
                    <option value="Prof. S. N. Mukherjee">Prof. S. N. Mukherjee (Math)</option>
                    <option value="Dr. K. S. Verma">Dr. K. S. Verma (Biology)</option>
                    <option value="Ateeb Fatmi (Director)">Ateeb Fatmi (Director)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Subject Module & Chapter
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics (Electromagnetic Induction)"
                  value={allocateSubject}
                  onChange={(e) => setAllocateSubject(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Time Slot
                </label>
                <select
                  value={allocateTimeSlot}
                  onChange={(e) => setAllocateTimeSlot(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand"
                >
                  <option value="08:00 AM - 10:00 AM">08:00 AM - 10:00 AM</option>
                  <option value="10:15 AM - 12:15 PM">10:15 AM - 12:15 PM</option>
                  <option value="12:30 PM - 02:00 PM">12:30 PM - 02:00 PM</option>
                  <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                  <option value="04:30 PM - 06:30 PM">04:30 PM - 06:30 PM</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowAllocateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand text-brand-foreground hover:bg-brand/90 font-semibold">
                  Confirm Allotment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function CampusesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
          Loading Campus Rooms...
        </div>
      }
    >
      <CampusesContent />
    </Suspense>
  );
}
