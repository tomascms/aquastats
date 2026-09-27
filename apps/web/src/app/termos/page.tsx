import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";
import { INTL_LOCALE, translate } from "@/i18n";
import { getServerLocale } from "@/i18n/server";
import { contactEmail } from "@/lib/site";

const H2 = "pt-2 text-xl font-semibold tracking-tight";
const UPDATED = new Date("2026-09-25T12:00:00");

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: translate(locale, "Termos"), robots: { index: false, follow: false } };
}

export default async function TermsPage() {
  const locale = await getServerLocale();
  const contact = contactEmail();
  const updated = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "long" }).format(UPDATED);
  const contactBlock = contact ? (
    <>
      <h2 className={H2}>{translate(locale, "Contacto")}</h2>
      <p className="text-mute">
        <a href={`mailto:${contact}`}>{contact}</a>
      </p>
    </>
  ) : null;

  if (locale === "en") {
    return (
      <LegalPage title="Terms of use" updated={updated}>
        <p>
          Aquastats is a free tool for coaches and athletes to record workouts, times and results. It does not replace
          a federation’s official records.
        </p>

        <h2 className={H2}>Accounts</h2>
        <p className="text-mute">
          One email is one account. Anyone can create an athlete account. Coach accounts are activated on request and
          can be declined or deactivated. Don’t create accounts for other people without their consent.
        </p>

        <h2 className={H2}>Minors’ data</h2>
        <p className="text-mute">
          If an athlete is a minor, the coach is responsible for getting permission from whoever holds parental
          responsibility before inviting them.
        </p>

        <h2 className={H2}>Payments</h2>
        <p className="text-mute">Aquastats charges nothing and doesn’t ask for payment details.</p>

        <h2 className={H2}>Availability</h2>
        <p className="text-mute">The app can fail. We do our best to keep it stable, without promising it never will.</p>

        {contactBlock}
      </LegalPage>
    );
  }

  return (
    <LegalPage title="Termos de utilização" updated={updated}>
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

      {contactBlock}
    </LegalPage>
  );
}
