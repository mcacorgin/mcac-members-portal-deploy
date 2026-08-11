import { BrandLockup } from "@/components/ui";

/**
 * Shell for the public / lifecycle screens (AUTH-01..06, recovery).
 * Mobile-first single column at 390px; a centered narrow card column on
 * larger screens. No member navigation and no member data ever renders here.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="ui-auth-shell mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-14 pt-8">
      <div className="mb-7">
        <BrandLockup href="/" />
      </div>
      {children}
    </main>
  );
}
