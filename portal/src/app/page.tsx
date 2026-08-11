import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { resolveLandingPath } from "@/lib/account/routing";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata = {
  description:
    "MCAC is a private network of Marathi corporate professionals. Approved members find each other and make contact directly.",
};

/**
 * Root route. Post-auth redirects still point here and the account lifecycle
 * routing in src/lib/account/routing.ts decides where a signed-in viewer
 * belongs. A signed-out visitor gets the public landing page instead of a
 * bounce to /sign-in.
 */
export default async function Home() {
  const viewer = await requireViewer();
  if (viewer) redirect(await resolveLandingPath(viewer));
  return <LandingPage />;
}
