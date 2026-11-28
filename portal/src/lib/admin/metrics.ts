import { count, eq, sql } from "drizzle-orm";
import { db, tables } from "@/db";
import { adminAccessError, type Viewer } from "@/lib/authz";
import { err, ok } from "@/lib/contracts/result";

type Week = {
  week: string;
  applications: number;
  paid: number;
  opportunity: number;
  job: number;
  knowledge: number;
  event: number;
  comments: number;
};

type Contributor = {
  id: string;
  name: string;
  posts: number;
  comments: number;
};

export async function getAdminMetrics(viewer: Viewer | null) {
  const denied = adminAccessError(viewer);
  if (denied) return err(denied, "Administrator access is required.");

  const { auditLog, comments, outboxEvents, posts, users } = tables;

  // Each source stores UTC without a zone. Convert to India time before
  // choosing the Monday bucket. Keep empty weeks so the trend has no gaps.
  const [statuses, weeks, contributors] = await Promise.all([
    db.select({ status: users.status, total: count() })
      .from(users)
      .where(eq(users.role, "member"))
      .groupBy(users.status),
    db.execute<Week>(sql`
      with calendar as (
        select date_trunc('week', now() at time zone 'Asia/Kolkata')::date
          - (7 * n) as week
        from generate_series(0, 11) as n
      ), period as (
        select (min(week)::timestamp at time zone 'Asia/Kolkata')
          at time zone 'UTC' as start_at
        from calendar
      ), first_submissions as (
        select min(created_at) as occurred
        from ${outboxEvents}
        where name = 'account.application_submitted'
          and payload ->> 'applicantId' is not null
          and payload ->> 'resubmitted' = 'false'
        group by payload ->> 'applicantId'
      ), activity as (
        select occurred, 'application' as kind from first_submissions
        union all
        select created_at, 'paid' from ${auditLog}
        where action = 'account.approved' and subject_type = 'user'
          and detail ->> 'from' = 'awaiting_payment'
          and created_at >= (select start_at from period)
        union all
        select created_at, type::text from ${posts}
        where status <> 'removed' and created_at >= (select start_at from period)
        union all
        select c.created_at, 'comment' from ${comments} c
        join ${posts} p on p.id = c.post_id
        where c.deleted_at is null and p.status <> 'removed'
          and c.created_at >= (select start_at from period)
      ), bucketed as (
        select date_trunc('week', occurred at time zone 'UTC' at time zone 'Asia/Kolkata')::date
          as week, kind
        from activity
      )
      select to_char(calendar.week, 'YYYY-MM-DD') as week,
        count(*) filter (where kind = 'application')::int as applications,
        count(*) filter (where kind = 'paid')::int as paid,
        count(*) filter (where kind = 'opportunity')::int as opportunity,
        count(*) filter (where kind = 'job')::int as job,
        count(*) filter (where kind = 'knowledge')::int as knowledge,
        count(*) filter (where kind = 'event')::int as event,
        count(*) filter (where kind = 'comment')::int as comments
      from calendar
      left join bucketed using (week)
      group by calendar.week
      order by calendar.week
    `),
    db.execute<Contributor>(sql`
      with activity as (
        select author_id, 'post' as kind from ${posts}
        where status <> 'removed'
          and created_at >= timezone('utc', now()) - interval '30 days'
        union all
        select c.author_id, 'comment' from ${comments} c
        join ${posts} p on p.id = c.post_id
        where c.deleted_at is null and p.status <> 'removed'
          and c.created_at >= timezone('utc', now()) - interval '30 days'
      )
      select u.id, u.name,
        count(*) filter (where kind = 'post')::int as posts,
        count(*) filter (where kind = 'comment')::int as comments
      from activity
      join ${users} u on u.id = activity.author_id
      where u.role = 'member' and u.status = 'approved'
      group by u.id, u.name
      order by count(*) desc, u.name, u.id
      limit 10
    `),
  ]);

  return ok({ statuses, weeks, contributors });
}
