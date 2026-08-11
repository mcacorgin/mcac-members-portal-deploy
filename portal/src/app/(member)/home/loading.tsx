import { Card, Skeleton } from "@/components/ui";

/** HOME-01 loading skeleton: header, filter row, three feed cards. */
export default function HomeLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl"
      aria-label="Loading Home feed"
    >
      <Skeleton className="mb-5 h-7 w-40" />
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-11 w-20 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
        <Skeleton className="h-11 w-16 rounded-full" />
      </div>
      <Skeleton className="mb-4 h-11 w-full rounded-control" />
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="grid gap-2.5">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="w-full" />
            <Skeleton className="w-2/3" />
          </Card>
        ))}
      </div>
    </div>
  );
}
