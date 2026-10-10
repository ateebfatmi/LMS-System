import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <PrepziiMark theme="light" />
        <span className="product-chip">for institutions</span>
        <Link className="text-link nav-login" href="/dashboard">
          View Workspace
        </Link>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          <span>❖</span> JEE & NEET Preparation & Institute OS
        </div>
        <h1>
          The structured way to crack <em>JEE & NEET</em>
        </h1>
        <p>
          Practice verified PYQs, deliver real-time CBT mock tests, analyze weak chapters, track attendance, and run your entire coaching institute in one focused workspace.
        </p>

        <div className="hero-actions">
          <Link className="primary-link" href="/dashboard">
            Open Demo Workspace →
          </Link>
          <a className="secondary-link" href="#foundation">
            Explore Features
          </a>
        </div>

        <div className="trust-row">
          <span>Verified 2017–2026 PYQs</span>
          <span>Authentic CBT Exam Interface</span>
          <span>Granular Weak Chapter Analytics</span>
          <span>Multi-tenant RLS Protected</span>
        </div>

        {/* Real CBT Exam Interface Preview Card */}
        <div className="cbt-preview-card">
          <div className="cbt-header">
            <div className="cbt-header-title">
              <span style={{ color: "#FACC15" }}>●</span> JEE Advanced Mock Series · Physics Paper 1
            </div>
            <div className="cbt-header-badge">Real CBT Interface · Q 12 / 30</div>
          </div>
          <div className="cbt-body">
            <div className="cbt-question-text font-prepzii-body">
              A particle of mass <strong>m</strong> moves in a circular orbit of radius <strong>r</strong> in a central force potential{" "}
              <code className="font-prepzii-mono" style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: "4px" }}>
                V(r) = k·r²
              </code>
              . The time period of the orbit is proportional to:
            </div>
            <div className="cbt-options-grid">
              <div className="cbt-option">
                <span className="cbt-option-marker">A</span> r¹/²
              </div>
              <div className="cbt-option selected">
                <span className="cbt-option-marker">B</span> Independent of r
              </div>
              <div className="cbt-option">
                <span className="cbt-option-marker">C</span> r
              </div>
              <div className="cbt-option">
                <span className="cbt-option-marker">D</span> r³/²
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="foundation" className="foundation-grid">
        <article>
          <span>01 · PRACTICE & TESTS</span>
          <h2>Authentic CBT Mocks</h2>
          <p>Deliver full-length exam condition test series with question paper timer, section navigation, and instant scorecards.</p>
        </article>
        <article>
          <span>02 · ANALYTICS & REVISION</span>
          <h2>Weak Chapter Detection</h2>
          <p>Surface speed, accuracy, and subject-wise chapter bottlenecks for every student and batch automatically.</p>
        </article>
        <article>
          <span>03 · INSTITUTE WORKFLOW</span>
          <h2>Complete Academics OS</h2>
          <p>Manage batches, faculty schedules, daily attendance, DPP assignments, and parent reports in one place.</p>
        </article>
      </section>
    </main>
  );
}
