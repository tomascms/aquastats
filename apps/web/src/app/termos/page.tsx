import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";
import { contactEmail, legalEntity } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termos",
  robots: { index: false, follow: false },
};

const H2 = "pt-2 text-xl font-semibold tracking-tight";

export default function TermsPage() {
  const seller = legalEntity();
  const contact = contactEmail();
  return (
    <LegalPage title="Termos de utilização" updated="25 de setembro de 2026">
      <p>
        A Aquastats é uma ferramenta para treinadores e atletas registarem treinos, tempos e resultados. Não substitui o
        arquivo oficial de uma federação.
      </p>

      <h2 className={H2}>Quem presta o serviço</h2>
      <p className="text-mute">
        {seller.name || "[nome]"} · NIF {seller.nif || "[NIF]"} · {seller.address || "[morada]"}
        {contact ? (
          <>
            {" "}
            · <a href={`mailto:${contact}`}>{contact}</a>
          </>
        ) : null}
      </p>

      <h2 className={H2}>Conta</h2>
      <p className="text-mute">
        O mesmo email é uma só conta. O treinador convida atletas por link ou código. Não cries contas para outras pessoas
        sem o consentimento delas. A conta de atleta é gratuita.
      </p>

      <h2 className={H2}>Subscrição de treinador</h2>
      <ul className="list-disc space-y-1 pl-5 text-mute">
        <li>A conta de treinador tem uma mensalidade, indicada antes do pagamento. O preço é final, com IVA incluído quando aplicável.</li>
        <li>A subscrição renova automaticamente todos os meses, na mesma data, até ser cancelada.</li>
        <li>
          Podes cancelar a qualquer momento em Definições → Gerir subscrição. O acesso mantém-se até ao fim do mês já pago e
          não há novas cobranças.
        </li>
        <li>
          O pagamento é feito no Stripe (Stripe Payments Europe, Ltd.). A Aquastats não recebe nem guarda dados de cartão.
        </li>
        <li>
          Se um pagamento falhar, o Stripe volta a tentar durante alguns dias. Se não for regularizado, o acesso da equipa fica
          suspenso. Os dados da equipa são mantidos e voltam a ficar disponíveis ao reativar.
        </li>
        <li>O preço pode mudar para renovações futuras, com aviso por email pelo menos 30 dias antes.</li>
      </ul>

      <h2 className={H2}>Direito de livre resolução</h2>
      <p className="text-mute">
        Tens 14 dias a contar da subscrição para desistir, sem indicar motivo, escrevendo para o contacto acima. Como pedes
        que o serviço comece de imediato, se desistires dentro desse prazo pagas apenas o valor proporcional ao tempo em que o
        serviço foi prestado e devolvemos o restante no prazo de 14 dias, pelo mesmo meio de pagamento.
      </p>

      <h2 className={H2}>Faturação</h2>
      <p className="text-mute">
        A fatura de cada pagamento é emitida em nome indicado no pagamento. Podes acrescentar o NIF da equipa ou clube na
        página de pagamento.
      </p>

      <h2 className={H2}>Dados de menores</h2>
      <p className="text-mute">
        Se um atleta for menor, o treinador é responsável por ter autorização de quem exerce as responsabilidades parentais
        antes de o convidar.
      </p>

      <h2 className={H2}>Disponibilidade</h2>
      <p className="text-mute">A app pode falhar. Fazemos o possível para estar estável, sem prometer ausência de falhas.</p>

      <h2 className={H2}>Reclamações e litígios</h2>
      <p className="text-mute">
        Podes apresentar reclamação no{" "}
        <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noreferrer">
          Livro de Reclamações Eletrónico
        </a>
        . Em caso de litígio de consumo podes recorrer a uma entidade de resolução alternativa de litígios, como o CNIACC –
        Centro Nacional de Informação e Arbitragem de Conflitos de Consumo (
        <a href="https://www.cniacc.pt" target="_blank" rel="noreferrer">
          www.cniacc.pt
        </a>
        ). Mais informação em{" "}
        <a href="https://www.consumidor.gov.pt" target="_blank" rel="noreferrer">
          www.consumidor.gov.pt
        </a>
        .
      </p>
    </LegalPage>
  );
}
