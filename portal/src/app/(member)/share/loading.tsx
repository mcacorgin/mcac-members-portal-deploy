import { Skeleton } from "@/components/ui";

/** SHARE-01 loading skeleton: header, type chips, first fields. */
export default function ShareLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl"
      aria-label="Loading Share"
    >
      <Skeleton className="mb-5 h-7 w-32" />
      <div className="mb-5 flex gap-2">
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-20 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-20 rounded-full" />
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-11 w-full rounded-control" />
        <Skeleton className="h-28 w-full rounded-control" />
      </div>
    </div>
  );
}
