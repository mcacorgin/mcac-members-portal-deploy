import Image from "next/image";
import type { PostTypeName } from "@/lib/posts/types";
import { cx } from "@/components/ui";

type PostVisualProps = {
  type: PostTypeName;
  title: string;
  className?: string;
};

type DemoVisual = {
  src: string;
  alt: string;
};

const TYPE_VISUALS: Record<PostTypeName, DemoVisual> = {
  opportunity: {
    src: "/demo/posts/manufacturing.jpg",
    alt: "Precision components on a modern manufacturing floor",
  },
  job: {
    src: "/demo/posts/finance-team.jpg",
    alt: "An advisory team reviews financial work together",
  },
  knowledge: {
    src: "/demo/posts/compliance-desk.jpg",
    alt: "An adviser reviews compliance documents at a desk",
  },
  event: {
    src: "/demo/posts/ai-workshop.jpg",
    alt: "Advisory professionals take part in a practical workshop",
  },
};

function visualFor(type: PostTypeName, title: string): DemoVisual | null {
  const normalizedTitle = title.toLowerCase();

  if (type === "job" && normalizedTitle.includes("analyst / associate")) {
    return TYPE_VISUALS.job;
  }

  if (
    type === "opportunity" &&
    normalizedTitle.includes("precision components")
  ) {
    return TYPE_VISUALS.opportunity;
  }

  if (type === "knowledge" && normalizedTitle.includes("gst notice")) {
    return TYPE_VISUALS.knowledge;
  }

  if (type === "event" && normalizedTitle.includes("practical ai")) {
    return TYPE_VISUALS.event;
  }

  return null;
}

/** Fictional demo media. Production must enable it explicitly. */
export function PostVisual({ type, title, className }: PostVisualProps) {
  const demoMediaEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.MCAC_DEMO_MEDIA === "1";
  if (!demoMediaEnabled) return null;

  const visual = visualFor(type, title);
  if (!visual) return null;

  return (
    <figure
      className={cx(
        "ui-post-visual overflow-hidden border-border bg-surface-sunken",
        className,
      )}
    >
      <Image
        src={visual.src}
        alt={visual.alt}
        width={1280}
        height={853}
        sizes="(min-width: 1024px) 736px, calc(100vw - 32px)"
        className="h-full w-full object-cover"
      />
    </figure>
  );
}
