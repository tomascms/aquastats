import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";
import { INTL_LOCALE, translate } from "@/i18n";
import { getServerLocale } from "@/i18n/server";
import { contactEmail } from "@/lib/site";

const H2 = "pt-2 text-xl font-semibold tracking-tight";
const NOTE = "rounded-lg border border-line bg-aqua-soft px-3 py-2 text-mist";
// Same date as TERMS_VERSION in apps/api/src/app/domain/privacy.py: signups store which version they accepted.
const UPDATED = new Date("2026-10-20T12:00:00");

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: translate(locale, "Termos"), robots: { index: false, follow: false } };
}

export default async function TermsPage() {
  const locale = await getServerLocale();
  const contact = contactEmail();
  const updated = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "long" }).format(UPDATED);
  const mail = contact ? <a href={`mailto:${contact}`}>{contact}</a> : "/seguranca";

  if (locale === "en") {
    return (
      <LegalPage title="Terms and conditions" updated={updated}>
        <p className={NOTE}>Draft: this text must be reviewed by a lawyer before it is final. The Portuguese version prevails.</p>
        <p>
          These terms govern the use of Aquastats (aquastats.net), provided by Tomás Sousa. Creating an account means
          accepting them, and we keep which version you accepted and when. Version 2026-10-20.
        </p>

        <h2 className={H2}>1. The service</h2>
        <p className="text-mute">
          Aquastats helps coaches and athletes plan workouts and record times, races and results. Predictions and
          indicators are estimates, not medical or sports advice, and the app does not replace a federation’s official
          records.
        </p>

        <h2 className={H2}>2. Accounts and age</h2>
        <p className="text-mute">
          One email is one account; keep your password to yourself. Anyone 13 or older can create an athlete account.
          Under 13, the account works, but health and wellbeing data (sleep, RPE, recovery, heart rate) is only stored after
          someone with parental responsibility consents through the link we send them. Coach accounts are activated on
          request and can be declined or deactivated. Don’t create accounts for other people without their consent.
        </p>

        <h2 className={H2}>3. Clubs and coaches</h2>
        <p className="text-mute">
          A club that uses Aquastats is the controller of the data it records about its athletes, and Aquastats processes
          it on the club’s behalf under the data processing agreement available on request. The coach confirms they have
          the authorisation needed to invite athletes, in particular minors, and uses the data only for training.
        </p>

        <h2 className={H2}>4. Acceptable use</h2>
        <p className="text-mute">
          Do not try to access other teams’ data, bypass limits or security, overload the service, upload malicious files
          or other people’s data without a basis to do so. We may suspend accounts that break these rules.
        </p>

        <h2 className={H2}>5. Content and licence</h2>
        <p className="text-mute">
          Your data remains yours; you let us process it only to provide the service. The Aquastats software is
          proprietary (all rights reserved, Tomás Sousa): you may use the app, but not copy, modify or redistribute its
          code.
        </p>

        <h2 className={H2}>6. Price</h2>
        <p className="text-mute">Aquastats is currently free and does not ask for payment details.</p>

        <h2 className={H2}>7. Availability and liability</h2>
        <p className="text-mute">
          We do our best to keep the app working and the data safe, but we do not promise it will never fail. Export what
          matters to you. To the extent the law allows, we are not liable for indirect losses or for interruptions;
          nothing here limits rights you have as a consumer.
        </p>

        <h2 className={H2}>8. Ending the account</h2>
        <p className="text-mute">
          You can delete your account at any time in Settings, and everything that is yours is deleted. An account inactive
          for 3 years is deleted, with an email warning 30 days before. How data is processed is explained in the privacy
          policy (/privacidade).
        </p>

        <h2 className={H2}>9. Changes</h2>
        <p className="text-mute">
          If these terms change in a way that matters, we tell you in the app or by email before the change applies, and
          ask you to accept the new version.
        </p>

        <h2 className={H2}>10. Law and disputes</h2>
        <p className="text-mute">
          Portuguese law applies. Consumers may also use an alternative dispute resolution centre and the consumer
          complaints book (livroreclamacoes.pt).
        </p>

        <h2 className={H2}>Contact</h2>
        <p className="text-mute">{mail}</p>
      </LegalPage>
    );
  }

  return (
    <LegalPage title="Termos e condições" updated={updated}>
      <p className={NOTE}>Rascunho: este texto deve ser revisto por um jurista antes de ser considerado final.</p>
      <p>
        Estes termos regem o uso da Aquastats (aquastats.net), disponibilizada por Tomás Sousa. Criar uma conta implica
        aceitá-los, e guardamos a versão aceite e a data. Versão 2026-10-20.
      </p>

      <h2 className={H2}>1. O serviço</h2>
      <p className="text-mute">
        A Aquastats ajuda treinadores e atletas a planear treinos e a registar tempos, provas e resultados. As previsões e
        os indicadores são estimativas, não são aconselhamento médico nem desportivo, e a app não substitui o arquivo
        oficial de uma federação.
      </p>

      <h2 className={H2}>2. Contas e idade</h2>
      <p className="text-mute">
        O mesmo email é uma só conta; não partilhes a palavra-passe. Qualquer pessoa com 13 anos ou mais pode criar uma conta
        de atleta. Abaixo dos 13, a conta funciona, mas os dados de saúde e bem-estar (sono, RPE, recuperação, frequência
        cardíaca) só são guardados depois de quem exerce as responsabilidades parentais autorizar, no link que lhe enviamos.
        As contas de treinador são ativadas após pedido e podem ser recusadas ou desativadas. Não cries contas para outras
        pessoas sem o consentimento delas.
      </p>

      <h2 className={H2}>3. Clubes e treinadores</h2>
      <p className="text-mute">
        O clube que usa a Aquastats é o responsável pelos dados que regista sobre os seus atletas, e a Aquastats trata-os por
        conta dele, nos termos do acordo de tratamento de dados disponível a pedido. O treinador garante ter a autorização
        necessária para convidar atletas, em especial menores, e usa os dados só para o treino.
      </p>

      <h2 className={H2}>4. Uso aceitável</h2>
      <p className="text-mute">
        Não tentes aceder a dados de outras equipas, contornar limites ou a segurança, sobrecarregar o serviço, carregar
        ficheiros maliciosos ou dados de terceiros sem fundamento para isso. Podemos suspender contas que violem estas
        regras.
      </p>

      <h2 className={H2}>5. Conteúdos e licença</h2>
      <p className="text-mute">
        Os teus dados continuam teus; autorizas-nos a tratá-los só para prestar o serviço. O software Aquastats é
        proprietário (todos os direitos reservados, Tomás Sousa): podes usar a app, mas não copiar, modificar nem
        redistribuir o código.
      </p>

      <h2 className={H2}>6. Preço</h2>
      <p className="text-mute">A Aquastats é, para já, gratuita e não pede dados de pagamento.</p>

      <h2 className={H2}>7. Disponibilidade e responsabilidade</h2>
      <p className="text-mute">
        Fazemos o possível para a app funcionar e os dados estarem seguros, sem prometer ausência de falhas. Exporta o que
        for importante para ti. Na medida em que a lei o permite, não respondemos por danos indiretos nem por interrupções;
        nada aqui limita os direitos que tens enquanto consumidor.
      </p>

      <h2 className={H2}>8. Fim da conta</h2>
      <p className="text-mute">
        Podes apagar a conta a qualquer momento nas definições, e tudo o que é teu é apagado. Uma conta inativa há 3 anos é
        apagada, com um aviso por email 30 dias antes. O tratamento dos dados está explicado na política de privacidade
        (/privacidade).
      </p>

      <h2 className={H2}>9. Alterações</h2>
      <p className="text-mute">
        Se estes termos mudarem de forma relevante, avisamos na app ou por email antes de a mudança se aplicar, e pedimos que
        aceites a nova versão.
      </p>

      <h2 className={H2}>10. Lei e litígios</h2>
      <p className="text-mute">
        Aplica-se a lei portuguesa. O consumidor pode também recorrer a um centro de resolução alternativa de litígios e ao
        livro de reclamações eletrónico (livroreclamacoes.pt).
      </p>

      <h2 className={H2}>Contacto</h2>
      <p className="text-mute">{mail}</p>
    </LegalPage>
  );
}
