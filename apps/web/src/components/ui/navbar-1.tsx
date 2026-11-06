"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { PrepziiMark } from "@prepzii/ui";
import styles from "@/app/_landing/landing.module.css";

const navigation = [
  { label: "Features", href: "#modules" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "FAQs", href: "#faqs" },
];

export function Navbar1() {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  return (
    <header
      className={styles.navbar}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          setIsOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className={styles.navInner}>
        <Link href="/" className={styles.brand} onClick={() => setIsOpen(false)}>
          <span aria-hidden="true"><PrepziiMark compact theme="light" /></span>
          <span><strong>Prepzii</strong>{" "}<small>For Institutes</small></span>
        </Link>
        <button
          className={styles.menuButton}
          ref={toggle}
          type="button"
          aria-expanded={isOpen}
          aria-controls="landing-navigation"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={23} aria-hidden="true" /> : <Menu size={23} aria-hidden="true" />}
        </button>
        <nav id="landing-navigation" className={styles.navLinks} data-open={isOpen} aria-label="Primary navigation">
          <div className={styles.navSections}>
            {navigation.map(({ label, href }) => (
              <a key={href} href={href} onClick={() => setIsOpen(false)}>{label}</a>
            ))}
          </div>
          <div className={styles.navActions}>
            <Link href="/sign-in" onClick={() => setIsOpen(false)}>Sign In</Link>
            <Link href="/onboarding" className={styles.navCta} onClick={() => setIsOpen(false)}>
              Get Started <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
