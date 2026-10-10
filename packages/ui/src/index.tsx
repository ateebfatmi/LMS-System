"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export function PrepziiLogoIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <img
      src="/images/branding/prepzii-official-logo.png"
      alt="PrepZii Logo"
      className={className}
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        objectFit: "contain",
        backgroundColor: "#ffffff",
        padding: "1px",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
      }}
    />
  );
}

export function PrepziiMark({
  compact = false,
  theme = "dark",
}: {
  compact?: boolean;
  theme?: "dark" | "light";
}) {
  return (
    <span className={`pz-mark pz-mark-${theme}`} aria-label="PrepZii">
      <span className="pz-mark-symbol" style={{ display: "flex", alignItems: "center" }}>
        {/* eslint-disable-next-html-element-for-img */}
        <img
          src="/images/branding/prepzii-official-logo.png"
          alt="PrepZii Logo"
          style={{
            height: compact ? "30px" : "36px",
            width: compact ? "30px" : "36px",
            borderRadius: "50%",
            objectFit: "contain",
            backgroundColor: "#ffffff",
            padding: "1px",
            boxShadow: theme === "dark" ? "0 2px 8px rgba(250, 204, 21, 0.25)" : "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
        />
      </span>
      {!compact && (
        <span className="pz-mark-word font-prepzii-display" style={{ fontWeight: 800, fontSize: "22px", letterSpacing: "0.06em" }}>
          PREP<span className="pz-accent-yellow" style={{ color: "#FACC15" }}>ZII</span>
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
