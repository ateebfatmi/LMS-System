"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode } from "react";


export function PrepziiLogoIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="#FACC15" />
      <path
        d="M11 10H24C27.866 10 31 13.134 31 17C31 20.866 27.866 24 24 24H18V30H11V10Z"
        fill="#0F172A"
      />
      <circle cx="23.5" cy="17" r="3.5" fill="#FACC15" />
    </svg>
  );
}

export function PrepziiMark({
  compact = false,
  theme = "dark",
  useImage = true,
}: {
  compact?: boolean;
  theme?: "dark" | "light";
  useImage?: boolean;
}) {
  if (useImage) {
    // In dark headers/sidebars, use light logo; in light backgrounds, use dark logo
    const logoSrc =
      theme === "dark"
        ? "/images/branding/prepzii-logo-light.png"
        : "/images/branding/prepzii-logo-dark.png";
    return (
      <span className={`pz-mark pz-mark-${theme} pz-mark-img`} aria-label="PrepZii">
        {/* eslint-disable-next-html-element-for-img */}
        <img
          src={logoSrc}
          alt="PrepZii"
          style={{ height: compact ? "26px" : "32px", width: "auto", objectFit: "contain" }}
        />
      </span>
    );
  }

  return (
    <span className={`pz-mark pz-mark-${theme}`} aria-label="PrepZii">
      <span className="pz-mark-symbol">
        <PrepziiLogoIcon className="pz-mark-svg" />
      </span>
      {!compact && (
        <span className="pz-mark-word font-prepzii-display">
          PREP<span className="pz-accent-yellow">ZII</span>
        </span>
      )}
    </span>
  );
}

export function ZiAssistantBadge({
  text = "Ask Zi AI",
  onClick,
}: {
  text?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="zi-ai-badge"
      title="Zi — AI Academic & Question Assistant"
    >
      <span className="zi-sparkle">✨</span>
      <span>{text}</span>
      <span className="zi-pill">AI</span>
    </button>
  );
}


export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "navy" | "outline" | "danger" | "brand";
}) {
  return <button className={`pz-button pz-button-${variant} ${className}`.trim()} {...props} />;
}

export function Badge({
  children,
  variant = "neutral",
  size = "md",
}: PropsWithChildren<{
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "yellow" | "brand";
  size?: "sm" | "md";
}>) {
  return <span className={`pz-badge pz-badge-${variant} pz-badge-${size}`}>{children}</span>;
}

export function MetricCard({
  label,
  value,
  detail,
  accent = "yellow",
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  accent?: "yellow" | "brand" | "navy" | "violet" | "blue" | "green" | "orange";
}) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="metric-detail">{detail}</span>}
    </article>
  );
}

export function Panel({
  title,
  action,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode }>) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="panel-subtitle">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function ProgressBar({
  value,
  max = 100,
  variant = "default",
}: {
  value: number;
  max?: number;
  variant?: "default" | "brand" | "success" | "warning";
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`pz-progress pz-progress-${variant}`}>
      <div className="pz-progress-bar" style={{ width: `${percentage}%` }} />
    </div>
  );
}

export function StatusDot({ status }: { status: "live" | "online" | "idle" | "offline" }) {
  return <span className={`status-dot status-${status}`} />;
}
