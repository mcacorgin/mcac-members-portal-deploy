import { PageHeader, ScreenId, Skeleton } from "@/components/ui";

/** HOME-03 loading state: notification row skeletons. */
export default function NotificationsLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl" aria-busy="true">
      <ScreenId id="HOME-03" className="mb-2" />
      <PageHeader title="Notifications" description="Loading your latest notifications." />
      <div className="grid gap-px overflow-hidden rounded-container border border-border bg-surface">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-h-[64px] items-center gap-3 px-3.5 py-3">
            <Skeleton className="size-[7px] flex-none rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
