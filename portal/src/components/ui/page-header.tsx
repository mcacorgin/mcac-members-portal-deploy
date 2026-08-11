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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="ui-page-title text-[22px] font-semibold text-balance text-ink">
            {title}
          </h2>
          {description ? (
            <p className="ui-page-description mt-1.5 max-w-[60ch] text-pretty text-ink-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="flex-none">{action}</div> : null}
      </div>
    </div>
  );
}
