import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  label?: string;
  className?: string;
}

export function SectionCard({ title, subtitle, actions, children, label, className }: SectionCardProps) {
  return (
    <section aria-label={label} className={className ? `section-card ${className}` : "section-card"}>
      <header className="section-card__header">
        <div>
          <p className="section-card__eyebrow">{title}</p>
          {subtitle ? <h2 className="section-card__title">{subtitle}</h2> : null}
        </div>
        {actions ? <div className="section-card__actions">{actions}</div> : null}
      </header>
      <div className="section-card__body">{children}</div>
    </section>
  );
}
