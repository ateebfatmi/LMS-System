import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export function PrepziiMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="pz-mark" aria-label="Prepzii">
      <span className="pz-mark-symbol">P</span>
      {!compact && <span className="pz-mark-word">prepzii</span>}
    </span>
  );
}

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`pz-button ${className}`.trim()} {...props} />;
}

export function MetricCard({
  label,
  value,
  detail,
  accent = "violet",
}: {
  label: string;
  value: string;
  detail: ReactNode;
  accent?: "violet" | "blue" | "green" | "orange";
}) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

export function Panel({ title, action, children }: PropsWithChildren<{ title: string; action?: ReactNode }>) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

