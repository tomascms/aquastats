import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";
import { SecurityGuardrails } from "@/components/ui/security-guardrails";
import { contactEmail, securityEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Segurança",
  robots: { index: false, follow: false },
};

export default function SecurityPage() {
  const security = securityEmail();
  const contact = contactEmail();
  return (
    <LegalPage title="Segurança" updated="20 de setembro de 2026">
      <p>
        A Aquastats lança-se sem pagamentos. Não há formulário de cartão nem cobrança nesta versão.
      </p>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">O que já está feito</h2>
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

      <h2 className="pt-2 text-xl font-semibold tracking-tight">Reportar um problema</h2>
      <p className="text-mute">
        {security ? (
          <>
            Relatórios de segurança: <a href={`mailto:${security}`}>{security}</a>. Consulta também{" "}
            <code className="text-aqua">/.well-known/security.txt</code>.
            {contact ? (
              <>
                {" "}
                Para o resto, <a href={`mailto:${contact}`}>{contact}</a>.
              </>
            ) : null}
          </>
        ) : (
          <>
            O contacto oficial fica em <code className="text-aqua">/.well-known/security.txt</code> quando o domínio
            estiver no ar.
          </>
        )}
      </p>
    </LegalPage>
  );
}
