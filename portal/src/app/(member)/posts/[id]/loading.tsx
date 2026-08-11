import { Card, Skeleton } from "@/components/ui";

/** HOME-02 loading skeleton: meta row, title, author, body, thread. */
export default function PostDetailLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl"
      aria-label="Loading post"
    >
      <Skeleton className="mb-5 h-11 w-32 rounded-control" />
      <div className="grid gap-4">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-7 w-3/4" />
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-[38px] rounded-avatar" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="w-full" />
        <Skeleton className="w-full" />
        <Skeleton className="w-2/3" />
        <Card className="grid gap-2.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="w-1/2" />
        </Card>
      </div>
    </div>
  );
}
