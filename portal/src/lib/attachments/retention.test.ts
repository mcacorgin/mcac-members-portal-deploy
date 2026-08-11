import assert from "node:assert/strict";
import test from "node:test";
import {
  processRetentionCandidates,
  resolveRetentionMode,
  type RetentionCandidate,
} from "./retention";

const NOW = new Date("2026-08-11T12:00:00Z");

function candidate(
  overrides: Partial<RetentionCandidate> = {},
): RetentionCandidate {
  return {
    id: "attachment-1",
    postId: "post-1",
    objectKey: "posts/post-1/attachment-1",
    sizeBytes: 1024,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    retentionExempt: false,
    purgedAt: null,
    ...overrides,
  };
}

test("retention defaults to dry-run unless deletion is explicitly enabled", () => {
  assert.equal(resolveRetentionMode(undefined), "dry-run");
  assert.equal(resolveRetentionMode("anything-else"), "dry-run");
  assert.equal(resolveRetentionMode("delete"), "delete");
});

test("dry-run reports due files without deleting or marking them", async () => {
  let deletes = 0;
  let marks = 0;
  const result = await processRetentionCandidates([candidate()], {
    now: NOW,
    mode: "dry-run",
    deleteObject: async () => void (deletes += 1),
    markPurgedAndAudit: async () => {
      marks += 1;
      return true;
    },
  });
  assert.deepEqual(
    { eligible: result.eligible, purged: result.purged, deletes, marks },
    { eligible: 1, purged: 0, deletes: 0, marks: 0 },
  );
});

test("not-due, exempt, and already-purged files are skipped", async () => {
  const rows = [
    candidate({ id: "recent", createdAt: new Date("2026-08-01T00:00:00Z") }),
    candidate({ id: "exempt", retentionExempt: true }),
    candidate({ id: "purged", purgedAt: new Date("2026-07-01T00:00:00Z") }),
  ];
  const result = await processRetentionCandidates(rows, {
    now: NOW,
    mode: "delete",
    deleteObject: async () => assert.fail("must not delete"),
    markPurgedAndAudit: async () => assert.fail("must not mark"),
  });
  assert.equal(result.eligible, 0);
  assert.equal(result.skipped, 3);
});

test("a successful deletion is marked and counted once", async () => {
  const steps: string[] = [];
  const result = await processRetentionCandidates([candidate()], {
    now: NOW,
    mode: "delete",
    deleteObject: async () => void steps.push("delete"),
    markPurgedAndAudit: async () => {
      steps.push("mark-and-audit");
      return true;
    },
  });
  assert.deepEqual(steps, ["delete", "mark-and-audit"]);
  assert.equal(result.purged, 1);
  assert.equal(result.purgedBytes, 1024);
});

test("a storage failure is not marked as a successful purge", async () => {
  let marked = false;
  const result = await processRetentionCandidates([candidate()], {
    now: NOW,
    mode: "delete",
    deleteObject: async () => {
      throw new Error("storage unavailable");
    },
    markPurgedAndAudit: async () => {
      marked = true;
      return true;
    },
  });
  assert.equal(marked, false);
  assert.equal(result.failed, 1);
  assert.equal(result.purged, 0);
});

test("retry can finish the database marker after an earlier partial failure", async () => {
  let attempts = 0;
  const run = () =>
    processRetentionCandidates([candidate()], {
      now: NOW,
      mode: "delete" as const,
      deleteObject: async () => void (attempts += 1),
      markPurgedAndAudit: async () => {
        if (attempts === 1) throw new Error("database unavailable");
        return true;
      },
    });
  const first = await run();
  const second = await run();
  assert.equal(first.failed, 1);
  assert.equal(second.purged, 1);
  assert.equal(attempts, 2);
});
