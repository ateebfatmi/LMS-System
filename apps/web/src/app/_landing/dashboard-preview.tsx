import {
  BarChart3, BookOpen, CalendarCheck2, ClipboardCheck, GraduationCap,
  LayoutDashboard, School,
} from "lucide-react";
import { MetricCard, PrepziiMark } from "@prepzii/ui";
import styles from "./landing.module.css";

const workspaceSections = [
  [LayoutDashboard, "Overview"],
  [GraduationCap, "Students"],
  [School, "Batches & Courses"],
  [ClipboardCheck, "Assessments"],
  [CalendarCheck2, "Attendance"],
  [BarChart3, "Reports"],
] as const;

const upcomingTests = [
  { title: "Physics Mock Test", batch: "JEE • Batch A", day: "18" },
  { title: "Biology Unit Test", batch: "NEET • Batch B", day: "20" },
  { title: "Algebra Practice Test", batch: "Foundation • Batch A", day: "22" },
];

export function DashboardPreview() {
  return (
    <figure className={styles.preview} aria-labelledby="workspace-preview">
      <figcaption className={styles.previewBar}>
        <span id="workspace-preview"><LayoutDashboard size={15} aria-hidden="true" /> Institute workspace preview</span>
        <span className={styles.demoLabel}>Demo data</span>
      </figcaption>
      <div className={styles.previewFrame}>
        <div className={styles.previewSidebar} aria-hidden="true">
          <div className={styles.previewBrand}><PrepziiMark compact /><strong>Prepzii</strong></div>
          <div className={styles.previewWorkspace}><School size={16} /><span>Demo Institute</span></div>
          <ul>
            {workspaceSections.map(([Icon, label]) => (
              <li key={label}><Icon size={16} />{label}</li>
            ))}
          </ul>
        </div>
        <div className={styles.previewContent}>
          <div className={styles.previewHeading}>
            <div><h2>Institute overview</h2><p>Demo Institute · Academic summary</p></div>
            <BookOpen size={19} aria-hidden="true" />
          </div>
          <div className={styles.metrics}>
            <MetricCard label="Active students" value="248" />
            <MetricCard label="Active batches" value="8" />
            <MetricCard label="Attendance" value="94%" />
            <MetricCard label="Assessment average" value="78%" />
          </div>
          <div className={styles.previewPanels}>
            <section className={styles.previewPanel}>
              <h3>Attendance trend</h3>
              <p>Last five recorded days</p>
              <div className={styles.chart}>
                <svg viewBox="0 0 400 115" preserveAspectRatio="none" role="img" aria-label="Demo attendance from Monday to Friday: 84%, 89%, 87%, 95%, 94%.">
                  <path className={styles.chartGrid} d="M0 15H400 M0 46H400 M0 77H400 M0 108H400" />
                  <path className={styles.chartFill} d="M0 88 100 64 200 73 300 37 400 41 V108 H0Z" />
                  <path className={styles.chartLine} d="M0 88 100 64 200 73 300 37 400 41" />
                </svg>
                <div aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
              </div>
            </section>
            <section className={styles.previewPanel}>
              <h3>Upcoming tests</h3>
              <ul className={styles.testList}>
                {upcomingTests.map(({ title, batch, day }) => (
                  <li key={title}>
                    <span className={styles.testDate}>{day}<small>NOV</small></span>
                    <span><strong>{title}</strong><small>{batch}</small></span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </figure>
  );
}
