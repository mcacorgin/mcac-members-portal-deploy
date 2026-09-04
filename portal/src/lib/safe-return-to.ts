export function safeSignInReturnTo(
  value: FormDataEntryValue | string | null,
): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\"))
    return "/";
  try {
    const parsed = new URL(raw, "https://mcac.invalid");
    if (parsed.origin !== "https://mcac.invalid") return "/";
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}
