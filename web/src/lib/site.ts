export function publicOrigin(): string {
  return (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

function hostFromOrigin(): string {
  try {
    return new URL(publicOrigin()).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function mailbox(local: string, env?: string): string {
  if (env) return env;
  const host = hostFromOrigin();
  if (!host || host === "127.0.0.1" || host === "localhost") return "";
  return `${local}@${host}`;
}

/** Caixa pública: pessoas escrevem-te para aqui. */
export function contactEmail(): string {
  return mailbox("contact", process.env.CONTACT_EMAIL);
}

/** Relatórios de segurança (security.txt). */
export function securityEmail(): string {
  return mailbox("security", process.env.SECURITY_EMAIL);
}

/** SMTP transaccional: confirmação de conta e repor palavra-passe. */
export function confirmationEmail(): string {
  return mailbox("confirmation", process.env.MAIL_FROM);
}
