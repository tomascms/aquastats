import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";
import { contactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacidade",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  const contact = contactEmail();
  return (
    <LegalPage title="Política de privacidade" updated="20 de setembro de 2026">
      <p>
        A Aquastats trata dados para o treinador e o atleta usarem a app: conta, equipa, treinos, tempos e resultados
        de competição.
      </p>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">O que guardamos</h2>
      <ul className="list-disc space-y-1 pl-5 text-mute">
        <li>Nome, email e o método de entrada (Google ou palavra-passe).</li>
        <li>Papel na app (treinador ou atleta) e a equipa a que pertences.</li>
        <li>Treinos, tempos, estilos e resultados que o treinador regista.</li>
      </ul>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">O que nunca guardamos</h2>
      <ul className="list-disc space-y-1 pl-5 text-mute">
        <li>Número de cartão, CVV, data de validade ou PIN.</li>
        <li>IBAN ou dados bancários completos.</li>
        <li>A palavra-passe em texto — só um hash Argon2id.</li>
      </ul>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">Pagamentos</h2>
      <p className="text-mute">A Aquastats é gratuita e não recolhe dados de pagamento.</p>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">Pedidos de conta de treinador</h2>
      <p className="text-mute">
        Quando pedes uma conta de treinador, o nome, o contacto, a equipa e a mensagem são enviados por email à Aquastats
        para decidir o pedido, e ficam associados à tua conta até essa decisão.
      </p>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">Cookies</h2>
      <p className="text-mute">
        Usamos cookies HttpOnly da sessão para te manter ligado. Não usamos cookies de publicidade. Um pedido de
        reposição de palavra-passe cria um token de uso único, válido 30 minutos.
      </p>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">Os teus direitos</h2>
      <p className="text-mute">
        Podes pedir acesso, correção ou apagamento da conta
        {contact ? (
          <>
            {" "}
            para <a href={`mailto:${contact}`}>{contact}</a>
          </>
        ) : (
          " pelo contacto em /seguranca"
        )}
        .
      </p>
    </LegalPage>
  );
}
