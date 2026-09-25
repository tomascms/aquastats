import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";
import { contactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termos",
  robots: { index: false, follow: false },
};

const H2 = "pt-2 text-xl font-semibold tracking-tight";

export default function TermsPage() {
  const contact = contactEmail();
  return (
    <LegalPage title="Termos de utilização" updated="25 de setembro de 2026">
      <p>
        A Aquastats é uma ferramenta gratuita para treinadores e atletas registarem treinos, tempos e resultados. Não
        substitui o arquivo oficial de uma federação.
      </p>

      <h2 className={H2}>Contas</h2>
      <p className="text-mute">
        O mesmo email é uma só conta. Qualquer pessoa pode criar uma conta de atleta. As contas de treinador são ativadas
        após pedido e podem ser recusadas ou desativadas. Não cries contas para outras pessoas sem o consentimento delas.
      </p>

      <h2 className={H2}>Dados de menores</h2>
      <p className="text-mute">
        Se um atleta for menor, o treinador é responsável por ter autorização de quem exerce as responsabilidades parentais
        antes de o convidar.
      </p>

      <h2 className={H2}>Pagamentos</h2>
      <p className="text-mute">A Aquastats não cobra nada e não pede dados de pagamento.</p>

      <h2 className={H2}>Disponibilidade</h2>
      <p className="text-mute">A app pode falhar. Fazemos o possível para estar estável, sem prometer ausência de falhas.</p>

      {contact ? (
        <>
          <h2 className={H2}>Contacto</h2>
          <p className="text-mute">
            <a href={`mailto:${contact}`}>{contact}</a>
          </p>
        </>
      ) : null}
    </LegalPage>
  );
}
