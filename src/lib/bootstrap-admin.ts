const REQUIRED_BOOTSTRAP_ADMIN_EMAILS = ["moritomizu@gmail.com"];

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function bootstrapAdminEmailSet() {
  const configuredEmails = (process.env.NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  return new Set([
    ...REQUIRED_BOOTSTRAP_ADMIN_EMAILS.map((email) => normalizeEmail(email)),
    ...configuredEmails,
  ]);
}

export function isBootstrapAdminEmail(email?: string | null) {
  return bootstrapAdminEmailSet().has(normalizeEmail(email));
}
