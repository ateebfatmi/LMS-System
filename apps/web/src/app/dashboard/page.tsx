import Link from "next/link";
import { MetricCard, Panel, PrepziiMark } from "@prepzii/ui";

const navItems = ["Overview", "Students", "Teachers", "Batches", "Courses", "Assessments", "Attendance", "Reports"];
const activity = [
  ["Physics · JEE 12A", "Weekly test published", "2 min ago", "PT"],
  ["Mathematics · JEE 11B", "Assignment submissions closed", "38 min ago", "MA"],
  ["Biology · NEET 12", "Attendance marked by Dr. Mehta", "1 hr ago", "BI"],
];

export default function DashboardPage() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row"><PrepziiMark /><span>Institutions</span></div>
        <div className="org-switcher">
          <span className="org-avatar">AN</span>
          <span><strong>Aakash North Campus</strong><small>2026–27 academic year</small></span>
          <span>⌄</span>
        </div>
        <nav className="side-nav">
          {navItems.map((item, index) => <a className={index === 0 ? "active" : ""} href="#" key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</a>)}
        </nav>
        <div className="sidebar-bottom">
          <a href="#">Settings</a><a href="#">Help & support</a>
          <div className="profile-mini"><span>AK</span><p><strong>Ateeb Khan</strong><small>Institute owner</small></p><b>•••</b></div>
        </div>
      </aside>
      <section className="workspace">
        <header className="workspace-header">
          <div><span className="mobile-brand"><PrepziiMark compact /></span><p>Friday, 10 October</p><h1>Good morning, Ateeb.</h1></div>
          <div className="header-actions"><button aria-label="Search">⌕</button><button aria-label="Notifications">◉</button><button className="create-button">＋ Create</button></div>
        </header>
        <div className="metrics-grid">
          <MetricCard label="Active students" value="1,248" detail={<><b>↑ 6.4%</b> this month</>} accent="violet" />
          <MetricCard label="Teaching staff" value="42" detail="38 active today" accent="blue" />
          <MetricCard label="Avg. attendance" value="91.6%" detail={<><b>↑ 2.1%</b> this week</>} accent="green" />
          <MetricCard label="Tests this week" value="18" detail="6 awaiting review" accent="orange" />
        </div>
        <div className="dashboard-grid">
          <Panel title="Today's classes" action={<a href="#">View timetable →</a>}>
            <div className="class-list">
              <div><time>09:00</time><span className="class-line purple"/><p><strong>Electrostatics</strong><small>JEE 12A · Room 204 · 68 students</small></p><span className="status live">Live now</span></div>
              <div><time>11:00</time><span className="class-line blue"/><p><strong>Organic Chemistry</strong><small>NEET 12 · Lab 1 · 54 students</small></p><span className="status">In 1h 42m</span></div>
              <div><time>14:30</time><span className="class-line orange"/><p><strong>Calculus — Applications</strong><small>JEE 11B · Room 102 · 61 students</small></p><span className="status">In 5h 12m</span></div>
            </div>
          </Panel>
          <Panel title="Attendance pulse" action={<a href="#">Details →</a>}>
            <div className="attendance-wrap">
              <div className="attendance-ring"><strong>91.6%</strong><span>today</span></div>
              <div className="attendance-bars">
                {[93, 89, 94, 92, 90, 96, 91].map((value, index) => <div key={index}><span style={{ height: `${value - 40}%` }} /><small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small></div>)}
              </div>
            </div>
          </Panel>
          <Panel title="Recent activity" action={<a href="#">See all →</a>}>
            <div className="activity-list">
              {activity.map(([title, detail, time, initials]) => <div key={title}><span>{initials}</span><p><strong>{title}</strong><small>{detail}</small></p><time>{time}</time></div>)}
            </div>
          </Panel>
          <Panel title="Needs attention">
            <div className="attention-list">
              <a href="#"><span className="attention-icon amber">!</span><p><strong>12 fee payments overdue</strong><small>Across 3 batches</small></p><b>→</b></a>
              <a href="#"><span className="attention-icon red">!</span><p><strong>8 students below 60%</strong><small>Weekly performance threshold</small></p><b>→</b></a>
              <a href="#"><span className="attention-icon blue">i</span><p><strong>4 tests need review</strong><small>Subjective responses pending</small></p><b>→</b></a>
            </div>
          </Panel>
        </div>
        <footer className="workspace-footer">Demo institution data · <Link href="/">Back to product overview</Link></footer>
      </section>
    </main>
  );
}

