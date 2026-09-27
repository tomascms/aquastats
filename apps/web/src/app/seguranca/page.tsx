import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";
import { SecurityGuardrails } from "@/components/ui/security-guardrails";
import { INTL_LOCALE, translate } from "@/i18n";
import { getServerLocale } from "@/i18n/server";
import { contactEmail, securityEmail } from "@/lib/site";

const H2 = "pt-2 text-xl font-semibold tracking-tight";
const UPDATED = new Date("2026-09-20T12:00:00");

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: translate(locale, "Segurança"), robots: { index: false, follow: false } };
}

export default async function SecurityPage() {
  const locale = await getServerLocale();
  const security = securityEmail();
  const contact = contactEmail();
  const updated = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "long" }).format(UPDATED);
  const securityTxt = <code className="text-aqua">/.well-known/security.txt</code>;

  if (locale === "en") {
    return (
      <LegalPage title="Security" updated={updated}>
        <p>Aquastats launches without payments. There is no card form and no billing in this version.</p>
        <h2 className={H2}>What’s already in place</h2>
        <ul className="list-disc space-y-1 pl-5 text-mute">
          <li>Sessions in HttpOnly cookies, with origin-based CSRF protection and SameSite.</li>
          <li>Passwords hashed with Argon2id. Google sign-in only with a token verified against Google’s certificates.</li>
          <li>Request size and rate limits in production. Headers against clickjacking and MIME sniffing.</li>
          <li>Roles (coach / athlete) and data separated per team.</li>
          <li>Domain behind Cloudflare (Free plan): HTTPS, DDoS protection and a Universal certificate.</li>
        </ul>

        <div className="pt-3">
          <h2 className="pb-2 text-xl font-semibold tracking-tight">Operational guardrails</h2>
          <SecurityGuardrails />
        </div>

        <h2 className={H2}>Report a problem</h2>
        <p className="text-mute">
          {security ? (
            <>
              Security reports: <a href={`mailto:${security}`}>{security}</a>. See also {securityTxt}.
              {contact ? (
                <>
                  {" "}
                  For everything else, <a href={`mailto:${contact}`}>{contact}</a>.
                </>
              ) : null}
            </>
          ) : (
            <>The official contact will be published at {securityTxt} once the domain is live.</>
          )}
        </p>
      </LegalPage>
    );
  }

  return (
    <LegalPage title="Segurança" updated={updated}>
      <p>A Aquastats lança-se sem pagamentos. Não há formulário de cartão nem cobrança nesta versão.</p>
      <h2 className={H2}>O que já está feito</h2>
      <ul className="list-disc space-y-1 pl-5 text-mute">
        <li>Sessões em cookies HttpOnly, com CSRF por origem e SameSite.</li>
        <li>Palavras-passe com Argon2id. Google entra só com token verificado nos certificados do Google.</li>
        <li>Limite de tamanho e de ritmo nos pedidos em produção. Cabeçalhos contra clickjacking e MIME sniffing.</li>
        <li>Papéis (treinador / atleta) e dados separados por equipa.</li>
        <li>Domínio atrás da Cloudflare (plano Free): HTTPS, DDoS e certificado Universal.</li>
      </ul>

      <div className="pt-3">
        <h2 className="pb-2 text-xl font-semibold tracking-tight">Guardrails operacionais</h2>
        <SecurityGuardrails />
      </div>

      <h2 className={H2}>Reportar um problema</h2>
      <p className="text-mute">
        {security ? (
          <>
            Relatórios de segurança: <a href={`mailto:${security}`}>{security}</a>. Consulta também {securityTxt}.
            {contact ? (
              <>
                {" "}
                Para o resto, <a href={`mailto:${contact}`}>{contact}</a>.
              </>
            ) : null}
          </>
        ) : (
          <>O contacto oficial fica em {securityTxt} quando o domínio estiver no ar.</>
        )}
      </p>
    </LegalPage>
  );
}
