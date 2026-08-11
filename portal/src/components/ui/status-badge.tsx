import type { ComponentPropsWithRef } from "react";
import { cx } from "./cx";

export type Status =
  | "pending"
  | "approved"
  | "rejected"
  | "needs-changes"
  | "suspended"
  | "active"
  | "old";

const statusClasses: Record<Status, string> = {
  pending: "bg-warning-bg text-warning",
  approved: "bg-success-bg text-success",
  rejected: "bg-danger-bg text-danger",
  "needs-changes": "bg-warning-bg text-warning",
  suspended: "bg-danger-bg text-danger",
  active: "bg-success-bg text-success",
  old: "bg-surface-subtle text-ink-muted",
};

const statusLabels: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  "needs-changes": "Needs changes",
  suspended: "Suspended",
  active: "Active",
  old: "Old",
};

export type StatusBadgeProps = ComponentPropsWithRef<"span"> & {
  status: Status;
};

/** Muted-tint pill communicating a lifecycle state. AA contrast on tint. */
export function StatusBadge({
  status,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        statusClasses[status],
        className,
      )}
    >
      {children ?? statusLabels[status]}
    </span>
  );
}
