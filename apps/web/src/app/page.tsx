import Link from "next/link";
import {
  ArrowDown, ArrowRight, ArrowUpRight, BarChart3, BookOpen, CalendarCheck2, Check,
  ChevronDown, ClipboardCheck, FileLock2, GraduationCap, KeyRound, Megaphone,
  Play, Presentation, School, ShieldCheck, UsersRound,
} from "lucide-react";
import { PrepziiMark } from "@prepzii/ui";
import { Navbar1 } from "@/components/ui/navbar-1";
import { DashboardPreview } from "./_landing/dashboard-preview";
import { DemoForm } from "./_landing/demo-form";
import styles from "./_landing/landing.module.css";

const features = [
  [UsersRound, "Student & Faculty Management", "Invite staff and add students individually or through CSV imports."],
  [School, "Batches & Courses", "Organize batches, subjects, and course enrolments in one workspace."],
  [ClipboardCheck, "Tests & Assessments", "Build question banks and schedule computer-based tests."],
  [CalendarCheck2, "Attendance Tracking", "Mark attendance by batch and review records over time."],
  [BookOpen, "Assignments & Study Materials", "Share resources, collect submissions, and give feedback."],
  [BarChart3, "Results & Performance Reports", "Review test results, attendance, and assignment completion."],
  [Megaphone, "Announcements", "Share notices with the right batches and roles."],
  [ShieldCheck, "Secure Role-Based Access", "Give each member access to the tools their role requires."],
] as const;

const steps = [
  ["Create Your Institute", "Set up a workspace with your institute’s name and details."],
  ["Add Teachers, Students & Batches", "Invite your team and organize learners into their batches."],
  ["Start Teaching, Testing & Tracking Progress", "Share materials, run tests, and follow attendance and results."],
] as const;

const roles = [
  [School, "Institute Owners", "Manage people and batches, and track attendance and performance across your institute."],
  [Presentation, "Teachers", "Manage assigned classes, record attendance, and run assignments and assessments."],
  [GraduationCap, "Students", "Access study materials, take assigned tests, and view released results."],
] as const;

const security = [
  [School, "Separate institute workspaces"],
  [KeyRound, "Role-based access"],
  [FileLock2, "Protected academic records"],
] as const;

const faqs = [
  ["Can we import our existing student and faculty lists?", "Yes. Institute administrators can upload CSV files and validate the records before importing them."],
  ["Can teachers manage their own batches?", "Teachers can manage learning materials, assignments, assessments, and attendance for the batches they’re assigned to."],
  ["Can I try a computer-based test before signing up?", "Yes. The public CBT demo lets you answer sample questions, move between them, and review solutions without an account."],
  ["Can another institute access our records?", "Access is tied to verified membership in your institute, and permissions control what each role can see and do."],
] as const;

export default function Home() {
  return (
    <div className={styles.landing}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <Navbar1 />

      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} id="product">
          <div className={styles.container}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Learning management for coaching institutes</p>
              <h1>Manage Your Entire <span className={styles.heroSubject}>Coaching Institute</span> in <span className={styles.heroAccent}>One Place.</span></h1>
              <p className={styles.heroDescription}>Manage students, batches, classes, attendance, tests, and performance — all from one simple platform.</p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href="/onboarding">Get Started <ArrowRight size={18} aria-hidden="true" /></Link>
                <a className={styles.secondaryButton} href="#modules">Explore Features <ArrowDown size={17} aria-hidden="true" /></a>
              </div>
              <Link className={styles.cbtLink} href="/cbt-demo"><Play size={14} aria-hidden="true" /> Try the CBT demo <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </div>
            <DashboardPreview />
          </div>
        </section>

        <section className={styles.section} id="modules">
          <div className={styles.container}>
            <header className={styles.sectionHeading}>
              <p className={styles.kicker}>Features</p>
              <h2>Everything You Need to Run Your Institute</h2>
              <p>Simple tools for teachers, students, and institute administrators.</p>
            </header>
            <div className={styles.featureGrid}>
              {features.map(([Icon, title, description]) => (
                <article className={styles.featureCard} key={title}>
                  <span className={styles.iconTile}><Icon size={21} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.stepsSection} id="how-it-works">
          <div className={styles.container}>
            <header className={styles.sectionHeading}>
              <p className={styles.kicker}>How it works</p>
              <h2>Get Started in Three Simple Steps</h2>
            </header>
            <ol className={styles.steps}>
              {steps.map(([title, description], index) => (
                <li key={title}>
                  <div className={styles.stepMarker}><span aria-hidden="true">{index + 1}</span></div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.roleSection} id="roles">
          <div className={styles.container}>
            <header className={styles.sectionHeading}>
              <p className={styles.kicker}>Your institute, connected</p>
              <h2>One Platform. A Personalized Experience for Everyone.</h2>
            </header>
            <div className={styles.roleGrid}>
              {roles.map(([Icon, title, description]) => (
                <article className={styles.roleCard} key={title}>
                  <span className={styles.iconTile}><Icon size={22} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} id="security">
          <div className={styles.container}>
            <div className={styles.securityPanel}>
              <div>
                <span className={styles.iconTile}><ShieldCheck size={24} aria-hidden="true" /></span>
                <h2>Your Institute&apos;s Data, Protected.</h2>
                <p>Access is controlled by institute membership, user roles, and permissions.</p>
              </div>
              <ul className={styles.securityList}>
                {security.map(([Icon, label]) => <li key={label}><Icon size={19} aria-hidden="true" />{label}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.demoSection} id="demo-request">
          <div className={`${styles.container} ${styles.demoLayout}`}>
            <div className={styles.demoCopy}>
              <p className={styles.kicker}>Personalized walkthrough</p>
              <h2>See How Prepzii Works for Your Institute</h2>
              <p>Tell us a little about your institute. We’ll tailor the walkthrough to how your team teaches and manages classes.</p>
              <ul>
                <li><Check size={17} aria-hidden="true" /> See how to set up your batches</li>
                <li><Check size={17} aria-hidden="true" /> Explore attendance and test workflows</li>
                <li><Check size={17} aria-hidden="true" /> Ask questions about getting started</li>
              </ul>
            </div>
            <DemoForm />
          </div>
        </section>

        <section className={styles.section} id="faqs">
          <div className={`${styles.container} ${styles.faqLayout}`}>
            <header>
              <p className={styles.kicker}>FAQs</p>
              <h2>Common questions</h2>
              <a className={styles.textLink} href="#demo-request">Request a walkthrough <ArrowUpRight size={16} aria-hidden="true" /></a>
            </header>
            <div className={styles.faqList}>
              {faqs.map(([question, answer], index) => (
                <details key={question} name="landing-faq" open={index === 0}>
                  <summary>{question}<ChevronDown size={19} aria-hidden="true" /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div><Link href="/" aria-label="Prepzii home"><PrepziiMark /></Link><p>Learning management for coaching institutes.</p></div>
          <nav aria-label="Footer navigation">
            <a href="#modules">Features</a>
            <Link href="/sign-in">Sign In</Link>
            <Link href="/onboarding">Create Workspace</Link>
            <Link href="/dashboard">Open Workspace</Link>
            <a href="#demo-request">Request Demo</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
