import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <PrepziiMark />
        <span className="product-chip">for institutions</span>
        <Link className="text-link nav-login" href="/dashboard">View workspace</Link>
      </nav>
      <section className="hero">
        <div className="eyebrow">One operating system for learning</div>
        <h1>Your institute,<br /><em>beautifully organized.</em></h1>
        <p>Bring batches, teachers, tests, attendance, and student progress into one calm workspace built for Indian schools and coaching institutes.</p>
        <div className="hero-actions">
          <Link className="primary-link" href="/dashboard">Open demo workspace <span>→</span></Link>
          <a className="secondary-link" href="#foundation">Explore the foundation</a>
        </div>
        <div className="trust-row">
          <span>Multi-tenant by design</span>
          <span>Role-based access</span>
          <span>Prepzii assessment engine</span>
        </div>
      </section>
      <section id="foundation" className="foundation-grid">
        <article><span>01</span><h2>Run academics</h2><p>Structure campuses, batches, subjects, courses, and academic years without spreadsheet drift.</p></article>
        <article><span>02</span><h2>Measure learning</h2><p>Create assignments and tests, then see where every learner and batch needs attention.</p></article>
        <article><span>03</span><h2>Keep everyone aligned</h2><p>Give owners, admins, teachers, students, and parents the view designed for their role.</p></article>
      </section>
    </main>
  );
}

