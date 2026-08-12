const LINKEDIN_IMAGE_SUFFIXES = [".licdn.com", ".licdn-ei.com"] as const;

/** Accept only LinkedIn-owned HTTPS profile-image hosts in production. */
export function linkedInProfilePicture(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const picture = (profile as { picture?: unknown }).picture;
  if (typeof picture !== "string" || !picture.trim()) return null;

  // The local OAuth provider uses an inline pixel so the complete browser
  // flow stays hermetic. LinkedIn production responses are always HTTPS.
  if (
    process.env.NODE_ENV !== "production" &&
    picture.startsWith("data:image/")
  ) {
    return picture;
  }

  try {
    const url = new URL(picture);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    return LINKEDIN_IMAGE_SUFFIXES.some(
      (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
    )
      ? url.href
      : null;
  } catch {
    return null;
  }
}
