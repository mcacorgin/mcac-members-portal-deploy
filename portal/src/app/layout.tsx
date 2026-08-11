import type { Metadata, Viewport } from "next";
import {
  resolveUiVariant,
  uiVariantBootstrap,
} from "@/components/ui/ui-variant";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCAC Members Portal",
  description:
    "Marathi Corporate Advisory Collective - private members network",
};

// viewport-fit=cover so env(safe-area-inset-bottom) is non-zero on iOS and
// the mobile tab bar clears the home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const uiVariant = resolveUiVariant(process.env.MCAC_UI_VARIANT);
  const allowUiPreview =
    process.env.NODE_ENV !== "production" ||
    process.env.MCAC_UI_PREVIEW === "1";

  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-ui={uiVariant}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: uiVariantBootstrap({
              defaultVariant: uiVariant,
              allowPreview: allowUiPreview,
            }),
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        {children}
      </body>
    </html>
  );
}
