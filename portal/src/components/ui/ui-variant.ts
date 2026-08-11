export const UI_VARIANTS = ["approved", "polished"] as const;

export type UiVariant = (typeof UI_VARIANTS)[number];

export function resolveUiVariant(value: string | undefined): UiVariant {
  return value === "approved" ? "approved" : "polished";
}

export function uiVariantBootstrap({
  defaultVariant,
  allowPreview,
}: {
  defaultVariant: UiVariant;
  allowPreview: boolean;
}): string {
  return `
    (() => {
      const fallback = ${JSON.stringify(defaultVariant)};
      const allowPreview = ${JSON.stringify(allowPreview)};
      let variant = fallback;

      if (allowPreview) {
        const requested = new URLSearchParams(window.location.search).get("ui");
        if (requested === "approved" || requested === "polished") {
          window.sessionStorage.setItem("mcac-ui-variant", requested);
        }

        const saved = window.sessionStorage.getItem("mcac-ui-variant");
        if (saved === "approved" || saved === "polished") {
          variant = saved;
        }
      }

      document.documentElement.dataset.ui = variant;
    })();
  `;
}
