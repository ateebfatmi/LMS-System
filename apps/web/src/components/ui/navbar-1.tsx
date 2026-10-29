"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";

const navigation = [
  { label: "Live Simulator", href: "/#interactive-suite" },
  { label: "Core Modules", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQs", href: "/#faqs" },
];

const Navbar1 = ({ sticky = true }: { sticky?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className={`${sticky ? "sticky top-0 z-40 sm:top-2" : "relative z-40"} flex w-full justify-center px-4 py-4`}>
      <div className="relative z-10 flex w-full max-w-6xl items-center justify-between rounded-full border border-slate-200/80 bg-white/90 px-4 py-2.5 shadow-[0_12px_35px_-16px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <motion.img
            src="/images/branding/prepzii-official-logo.png"
            alt=""
            className="size-9 rounded-full bg-white object-contain p-px shadow-sm"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            whileHover={{ rotate: 10 }}
            transition={{ duration: 0.3 }}
          />
          <span className="hidden font-bold tracking-[0.08em] text-slate-900 sm:inline">
            PREP<span className="text-yellow-500">ZII</span>
          </span>
          <span className="hidden rounded-full border border-yellow-300/70 bg-yellow-100 px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-yellow-800 lg:inline">
            FOR INSTITUTES
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          {navigation.map((item, index) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.04 }}
              whileHover={{ scale: 1.05 }}
            >
              <a href={item.href} className="text-sm font-medium text-slate-700 transition-colors hover:text-slate-950">
                {item.label}
              </a>
            </motion.div>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/sign-in"
            className="rounded-full px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 lg:px-4"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold !text-white transition-colors hover:bg-slate-800 lg:px-5 lg:text-sm"
          >
            Open Workspace
          </Link>
        </div>

        <motion.button
          type="button"
          className="flex size-10 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-slate-100 md:hidden"
          onClick={() => setIsOpen(true)}
          whileTap={{ scale: 0.9 }}
          aria-label="Open navigation menu"
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
        >
          <Menu className="size-6" aria-hidden="true" />
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-navigation"
            className="fixed inset-0 z-[100] flex flex-col bg-white px-6 pb-8 pt-24 md:hidden"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <motion.button
              type="button"
              className="absolute right-6 top-6 flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-900"
              onClick={closeMenu}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              aria-label="Close navigation menu"
            >
              <X className="size-6" aria-hidden="true" />
            </motion.button>

            <nav className="flex flex-1 flex-col gap-2" aria-label="Mobile navigation">
              {navigation.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.08 + 0.1 }}
                >
                  <a
                    href={item.href}
                    className="block border-b border-slate-100 py-4 text-2xl font-semibold text-slate-900"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </a>
                </motion.div>
              ))}
            </nav>

            <motion.div
              className="grid gap-3 pt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.45 }}
            >
              <Link
                href="/sign-in"
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-base font-semibold text-slate-900"
                onClick={closeMenu}
              >
                Institute Sign In
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-base font-semibold text-white"
                style={{ color: "#ffffff" }}
                onClick={closeMenu}
              >
                Open Workspace
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export { Navbar1 };
