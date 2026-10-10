"use client";

import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockBatches } from "@/lib/mock-data";

export default function ReportsPage() {
  return (
    <DashboardLayout
      title="Reports & Academic Analytics"
      subtitle="Comprehensive performance indicators, batch benchmark comparisons, and subject strength heatmaps"
      action={
        <Button variant="primary">
          📥 Generate PTM Report Cards
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Institute Average" value="74.6%" detail={<><b>↑ 3.2%</b> vs last mock test</>} accent="yellow" />
        <MetricCard label="Top 1% Rankers" value="28 Students" detail="Projected <1000 AIR" accent="green" />
        <MetricCard label="Need Academic Focus" value="46 Students" detail="Below 55% aggregate" accent="orange" />
        <MetricCard label="DPP Completion Rate" value="86.4%" detail="Consistent homework pace" accent="blue" />
      </div>

      <div className="card-grid-2">
        <Panel title="Subject Strength & Weakness Analysis">
          <div style={{ display: "grid", gap: "14px", marginTop: "6px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span><strong>Physics:</strong> Modern Physics & Optics</span>
                <span style={{ color: "#1f8d61", fontWeight: 700 }}>88.4% Mastery</span>
              </div>
              <ProgressBar value={88} variant="success" />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span><strong>Mathematics:</strong> Calculus & Vectors</span>
                <span style={{ color: "#7759e8", fontWeight: 700 }}>76.2% Mastery</span>
              </div>
              <ProgressBar value={76} variant="default" />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span><strong>Chemistry:</strong> Organic Reaction Mechanisms</span>
                <span style={{ color: "#d67b32", fontWeight: 700 }}>58.5% (Needs Focus)</span>
              </div>
              <ProgressBar value={58} variant="warning" />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span><strong>Biology:</strong> Human Physiology & Genetics</span>
                <span style={{ color: "#1f8d61", fontWeight: 700 }}>91.0% Mastery</span>
              </div>
              <ProgressBar value={91} variant="success" />
            </div>
          </div>
        </Panel>

        <Panel title="Batch Benchmark Comparison (Average Score)">
          <div style={{ display: "grid", gap: "14px", marginTop: "6px" }}>
            {mockBatches.map((batch) => (
              <div key={batch.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span><strong>{batch.name}</strong> ({batch.studentCount} students)</span>
                  <Badge variant="purple" size="sm">{batch.attendanceRate}% Attd</Badge>
                </div>
                <ProgressBar value={batch.syllabusProgress} variant="default" />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: "16px" }}>
        <Panel
          title="Students Recommended for Academic Intervention"
          subtitle="Identified automatically by Prepzii's score and attendance trend algorithm"
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Batch</th>
                  <th>Recent Test Score</th>
                  <th>Attendance</th>
                  <th>Identified Weakness</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>APX-2026-1101</code></td>
                  <td><strong>Rohan Verma</strong></td>
                  <td>JEE 11B - Nucleus</td>
                  <td><strong style={{ color: "#d67b32" }}>54%</strong> (68 / 180)</td>
                  <td><span style={{ color: "#d67b32" }}>86.2%</span></td>
                  <td>Organic Reaction Mechanisms, Complex Numbers</td>
                  <td><Button variant="outline" style={{ padding: "4px 8px", fontSize: "11px" }}>Assign Revision DPP</Button></td>
                </tr>
                <tr>
                  <td><code>APX-2026-1001</code></td>
                  <td><strong>Kabir Sengupta</strong></td>
                  <td>Foundation 10 - Olympiad</td>
                  <td><strong style={{ color: "#d67b32" }}>58%</strong> (74 / 180)</td>
                  <td><span style={{ color: "#d67b32" }}>89.0%</span></td>
                  <td>Trigonometric Identities, Newton&apos;s Laws</td>
                  <td><Button variant="outline" style={{ padding: "4px 8px", fontSize: "11px" }}>Assign Revision DPP</Button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </DashboardLayout>
  );
}
