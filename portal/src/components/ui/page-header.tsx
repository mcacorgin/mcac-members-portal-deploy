import type { ReactNode } from "react";
import { cx } from "./cx";

export type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Optional right-aligned action (Button, StatusBadge, ...). */
  action?: ReactNode;
  className?: string;
};

/** Screen heading: title + optional description and action. */
export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cx("ui-page-header mb-5", className)}>
      {/* The title takes the free space but keeps its min-content width, so
          the action drops below it only when both cannot fit on one line
          (large reader font settings). Otherwise the layout is unchanged. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <h1 className="ui-page-title text-[1.375rem] font-semibold text-balance text-ink">
            {title}
          </h1>
          {description ? (
            <p className="ui-page-description mt-1.5 max-w-[60ch] text-pretty text-ink-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="max-w-full flex-none">{action}</div> : null}
      </div>
    </div>
  );
}
