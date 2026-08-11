import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireViewer } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/admin/queries";
import { getEvidenceStatus } from "@/lib/account/registration";
import { getDirectoryFilters } from "@/lib/directory/queries";
import { getConfig } from "@/lib/config";
import type { Section } from "@/lib/authz";
import {
  Avatar,
  Card,
  ErrorState,
  ScreenId,
  StatusBadge,
  type Status,
} from "@/components/ui";
import { formatDate, formatDateTime } from "../../../format";
import { DecisionPanel } from "./decision-panel";
import { ProfileForm } from "./profile-form";
import { SectionOverrides } from "./section-overrides";

export const metadata = { title: "Application review - MCAC Members Portal" };

const BADGE: Record<string, Status> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  needs_changes: "needs-changes",
  suspended: "suspended",
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();

  const detail = await getApplicationDetail(viewer, id);
  if (!detail.ok) {
    if (detail.code === "not_found") notFound();
    return (
      <div>
        <ScreenId id="ADMIN-02" />
        <ErrorState
          className="mt-3"
          title="Could not load this application"
          body={detail.message}
        />
      </div>
    );
  }
  const record = detail.data;
  // Only emit an outbound href when the stored value can form a sane http(s)
  // URL - mirrors the People profile's same guard (people/[id]/page.tsx).
  // Legacy/imported data may not have passed the applicant-facing schema's
  // linkedin.com check, so this stays defensive rather than trusting it.
  const linkedinHref = (() => {
    if (!record.profile?.linkedinUrl) return undefined;
    try {
      const url = new URL(record.profile.linkedinUrl);
      return url.protocol === "https:" || url.protocol === "http:"
        ? url.href
        : undefined;
    } catch {
      return undefined;
    }
  })();

  const [filters, overrideRows, evidence, ...globalFlags] = await Promise.all([
    getDirectoryFilters(viewer),
    db.query.memberSectionOverrides.findMany({
      where: eq(tables.memberSectionOverrides.userId, id),
    }),
    getEvidenceStatus(record.id),
    getConfig("sections.opportunity"),
    getConfig("sections.job"),
    getConfig("sections.knowledge"),
    getConfig("sections.event"),
  ]);
  const allTags = filters.ok ? filters.data.tags : record.tags;
  const overrides: Partial<Record<Section, boolean>> = {};
  for (const row of overrideRows)
    overrides[row.section as Section] = row.enabled;
  const globals: Record<Section, boolean> = {
    opportunity: globalFlags[0],
    job: globalFlags[1],
    knowledge: globalFlags[2],
    event: globalFlags[3],
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link
          href="/admin"
          className="inline-flex min-h-tap items-center text-sm font-medium text-navy-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          &larr; Back to queue
        </Link>
        <ScreenId id="ADMIN-02" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="grid min-w-0 gap-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={record.name || record.email} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-ink">
                  {record.name || "Unnamed applicant"}
                </h2>
                <p className="truncate text-sm text-ink-secondary">
                  {record.email}
                </p>
              </div>
              <StatusBadge status={BADGE[record.status]} />
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-muted">Joined</dt>
                <dd className="text-ink">{formatDate(record.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Role</dt>
                <dd className="text-ink">
                  {record.role === "admin" ? "Administrator" : "Member"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Application evidence</dt>
                <dd className="text-ink">
                  {evidence.complete ? "Complete" : "Incomplete"}
                  {record.profile?.onboardingCompletedAt
                    ? ` (submitted ${formatDate(record.profile.onboardingCompletedAt)})`
                    : ""}
                </dd>
              </div>
            </dl>
            {record.statusReason ? (
              <p className="mt-3 rounded-control bg-surface-subtle px-3 py-2 text-sm text-ink-secondary">
                <span className="font-medium text-ink">
                  Last decision reason:
                </span>{" "}
                {record.statusReason}
                {record.statusChangedAt
                  ? ` (${formatDateTime(record.statusChangedAt)})`
                  : ""}
              </p>
            ) : null}
          </Card>

          <Card data-testid="privacy-audit">
            <h3 className="mb-1 text-base font-semibold text-ink">
              Privacy audit
            </h3>
            <p className="mb-3 text-sm text-ink-secondary">
              Current notice version:{" "}
              <span className="font-medium text-ink">
                {record.consent.currentVersion ?? "none published"}
              </span>
              {" - "}
              {record.consent.acceptedCurrent ? (
                <span className="font-medium text-success">
                  accepted by this applicant
                </span>
              ) : (
                <span className="font-medium text-warning">
                  not yet accepted by this applicant
                </span>
              )}
            </p>
            {record.consent.records.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No acceptance records exist for this account.
              </p>
            ) : (
              <ul className="grid gap-1 text-sm text-ink-secondary">
                {record.consent.records.map((r, index) => (
                  <li
                    key={`${r.noticeVersion}-${index}`}
                    className="flex flex-wrap justify-between gap-x-4 border-b border-border py-1.5 last:border-b-0"
                  >
                    <span>Notice version {r.noticeVersion}</span>
                    <span>Accepted {formatDateTime(r.acceptedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card data-testid="evidence-audit">
            <h3 className="mb-1 text-base font-semibold text-ink">
              Application evidence
            </h3>
            <p className="mb-3 text-sm text-ink-secondary">
              {evidence.complete ? (
                <span className="font-medium text-success">
                  complete - all required evidence fields are on file.
                </span>
              ) : (
                <span className="font-medium text-warning">
                  incomplete - missing: {evidence.missing.join(", ")}.
                </span>
              )}
            </p>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">Phone</dt>
                <dd className="text-ink">{record.profile?.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">City</dt>
                <dd className="text-ink">{record.profile?.city || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">
                  Company or practice
                </dt>
                <dd className="text-ink">{record.profile?.company || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Title</dt>
                <dd className="text-ink">{record.profile?.title || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">LinkedIn URL</dt>
                <dd className="truncate text-ink">
                  {linkedinHref ? (
                    <a
                      href={linkedinHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-navy-text underline"
                    >
                      {record.profile?.linkedinUrl}
                    </a>
                  ) : (
                    record.profile?.linkedinUrl || "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Expertise</dt>
                <dd className="text-ink">
                  {record.tags.length
                    ? record.tags.map((t) => t.label).join(", ")
                    : "—"}
                </dd>
              </div>
            </dl>
          </Card>

          {record.profile ? (
            <ProfileForm
              userId={record.id}
              name={record.name}
              profile={record.profile}
              allTags={allTags}
              memberTagIds={record.tags.map((t) => t.id)}
            />
          ) : (
            <Card>
              <h3 className="mb-1 text-base font-semibold text-ink">Profile</h3>
              <p className="text-sm text-ink-secondary">
                This account has no profile row yet, so there is nothing to
                edit. A profile is created automatically during registration.
              </p>
            </Card>
          )}

          <SectionOverrides
            userId={record.id}
            overrides={overrides}
            globals={globals}
          />
        </div>

        <div className="grid gap-4 lg:sticky lg:top-4">
          <DecisionPanel
            userId={record.id}
            status={record.status}
            acceptedCurrent={record.consent.acceptedCurrent}
            evidence={evidence}
          />
        </div>
      </div>
    </div>
  );
}
