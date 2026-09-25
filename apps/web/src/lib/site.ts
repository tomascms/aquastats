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

/** Seller identification required for online sales (DL 7/2004 and DL 24/2014); set in the Worker vars. */
export function legalEntity(): { name: string; nif: string; address: string } {
  return {
    name: process.env.LEGAL_NAME || "",
    nif: process.env.LEGAL_NIF || "",
    address: process.env.LEGAL_ADDRESS || "",
  };
}

/** SMTP transaccional: confirmação de conta e repor palavra-passe. */
export function confirmationEmail(): string {
  return mailbox("confirmation", process.env.MAIL_FROM);
}
