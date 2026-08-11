import { z } from "zod";

// Post-type capability schema (frozen contract: BUILD-PLAN.md Wave 1).
// Opportunity / job / knowledge / event share one posts engine; a type may
// only differ in the capabilities it enables and its validated metadata.
// Changes to this file go through the orchestrator once shipped.

export const POST_TYPE_NAMES = [
  "opportunity",
  "job",
  "knowledge",
  "event",
] as const;

export type PostTypeName = (typeof POST_TYPE_NAMES)[number];

export type PostCapabilities = {
  comments: boolean;
  bookmarks: boolean;
  expiry: boolean;
  attachments: boolean;
  tagging: boolean;
};

const opportunityMetadataSchema = z.object({
  industry: z.string().min(1),
  requestedAction: z.string().min(1),
});

const jobMetadataSchema = z.object({
  industry: z.string().min(1).optional(),
  location: z.string().min(1),
});

const knowledgeMetadataSchema = z.object({
  category: z.string().min(1).optional(),
});

const eventMetadataSchema = z.object({
  startsAt: z.iso.datetime(),
  location: z.string().min(1),
  mode: z.enum(["in_person", "virtual"]),
});

export const TYPE_CONFIG = {
  opportunity: {
    capabilities: {
      comments: true,
      bookmarks: true,
      expiry: true,
      attachments: true,
      tagging: true,
    },
    metadataSchema: opportunityMetadataSchema,
  },
  job: {
    capabilities: {
      comments: true,
      bookmarks: true,
      expiry: false,
      attachments: true,
      tagging: true,
    },
    metadataSchema: jobMetadataSchema,
  },
  knowledge: {
    capabilities: {
      comments: true,
      bookmarks: true,
      expiry: false,
      attachments: true,
      tagging: true,
    },
    metadataSchema: knowledgeMetadataSchema,
  },
  event: {
    capabilities: {
      comments: true,
      bookmarks: true,
      expiry: false,
      attachments: true,
      tagging: true,
    },
    metadataSchema: eventMetadataSchema,
  },
} as const satisfies Record<
  PostTypeName,
  { capabilities: PostCapabilities; metadataSchema: z.ZodType }
>;

export type PostMetadata<T extends PostTypeName> = z.infer<
  (typeof TYPE_CONFIG)[T]["metadataSchema"]
>;

export const createPostInputSchema = z
  .object({
    type: z.enum(POST_TYPE_NAMES),
    title: z.string().min(1).max(160),
    body: z.string().min(1).max(5000),
    metadata: z.record(z.string(), z.unknown()).default({}),
    taggedUserIds: z.array(z.uuid()).max(20).default([]),
  })
  .superRefine((input, ctx) => {
    const parsed = TYPE_CONFIG[input.type].metadataSchema.safeParse(
      input.metadata,
    );
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: "custom",
          message: issue.message,
          path: ["metadata", ...issue.path],
        });
      }
    }
  });

export type CreatePostInput = z.input<typeof createPostInputSchema>;

export const updatePostBaseInputSchema = z.object({
  postId: z.uuid(),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(5000),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type UpdatePostInput = z.input<typeof updatePostBaseInputSchema>;

/** Validate edit metadata against the STORED post type (type is not editable). */
export function validateUpdatePostMetadata(
  type: PostTypeName,
  metadata: Record<string, unknown>,
):
  | { ok: true; metadata: Record<string, unknown> }
  | { ok: false; fieldErrors: Record<string, string[]> } {
  const parsed = TYPE_CONFIG[type].metadataSchema.safeParse(metadata);
  if (parsed.success) return { ok: true, metadata };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = ["metadata", ...issue.path.map(String)].join(".");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, fieldErrors };
}
