"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

// Collapsing app header (issue #75). On narrow screens the sticky header
// slides out of view while scrolling down and slides back in on scroll up,
// so page content gets the full viewport. Desktop keeps the always-visible
// header. The header is inert while hidden so keyboard focus cannot land on
// off-screen controls.
export function CollapsibleMobileHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023.5px)");
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      if (!mq.matches || y < 120) {
        setHidden(false);
        return;
      }
      if (delta > 8) setHidden(true);
      else if (delta < -4) setHidden(false);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cx(
        "ui-app-header sticky top-0 z-20 transition-transform duration-200 ease-out-strong",
        hidden && "-translate-y-full",
        className,
      )}
      inert={hidden}
    >
      {children}
    </header>
  );
}
