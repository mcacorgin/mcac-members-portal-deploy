"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

export function PersonRow({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function openPerson(event: MouseEvent<HTMLTableRowElement>) {
    const { currentTarget: row, target } = event;
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !(target instanceof Element) ||
      !row.contains(target)
    ) return;

    const control = target.closest("a, button, input, select, textarea, label, form");
    if (control && row.contains(control)) return;

    const selection = row.ownerDocument.getSelection();
    if (selection && !selection.isCollapsed && row.contains(selection.anchorNode)) {
      return;
    }

    router.push(href);
  }

  // The link inside the row handles keyboard navigation. Keep table semantics
  // and avoid absolute overlays on table rows, which misroute clicks in Safari.
  return (
    <tr className={`cursor-pointer ${className}`} onClick={openPerson}>
      {children}
    </tr>
  );
}
