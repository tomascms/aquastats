import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";

export const metadata: Metadata = {
  title: "Termos",
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <LegalPage title="Termos de utilização" updated="20 de setembro de 2026">
      <p>
        A Aquastats é uma ferramenta para treinadores e atletas registarem treinos e tempos. Não substitui o arquivo
        oficial de uma federação.
      </p>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">Conta</h2>
      <p className="text-mute">
        O mesmo email é uma só conta. O treinador convida atletas por link. Não cries contas para outras pessoas sem o
        consentimento delas.
      </p>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">Dados de menores</h2>
      <p className="text-mute">
        Se um atleta for menor, o treinador é responsável por ter autorização de quem exerce as responsabilidades
        parentais antes de o convidar.
      </p>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">Pagamentos</h2>
      <p className="text-mute">
        Este lançamento não tem pagamentos. Não aceitamos números de cartão no site. Se no futuro houver cobrança, ela
        acontece no checkout de um processador certificado — nunca num formulário nosso.
      </p>
      <h2 className="pt-2 text-xl font-semibold tracking-tight">Disponibilidade</h2>
      <p className="text-mute">
        A app pode falhar. Fazemos o possível para estar estável, sem prometer ausência de falhas.
      </p>
    </LegalPage>
  );
}
