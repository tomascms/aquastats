import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";
import { INTL_LOCALE, translate } from "@/i18n";
import { getServerLocale } from "@/i18n/server";
import { contactEmail } from "@/lib/site";

const H2 = "pt-2 text-xl font-semibold tracking-tight";
const LIST = "list-disc space-y-1 pl-5 text-mute";
const NOTE = "rounded-lg border border-line bg-aqua-soft px-3 py-2 text-mist";
// Same date as TERMS_VERSION in apps/api/src/app/domain/privacy.py.
const UPDATED = new Date("2026-10-20T12:00:00");
const CNPD = "https://www.cnpd.pt";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: translate(locale, "Privacidade"), robots: { index: false, follow: false } };
}

export default async function PrivacyPage() {
  const locale = await getServerLocale();
  const contact = contactEmail();
  const updated = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "long" }).format(UPDATED);
  const mail = contact ? <a href={`mailto:${contact}`}>{contact}</a> : "/seguranca";

  if (locale === "en") {
    return (
      <LegalPage title="Privacy policy" updated={updated}>
        <p className={NOTE}>Draft: this text must be reviewed by a lawyer before it is final. The Portuguese version prevails.</p>
        <p>
          This policy explains which personal data Aquastats processes, why, on what legal basis, for how long and
          how to exercise your rights. Version 2026-10-20.
        </p>

        <h2 className={H2}>Who is responsible</h2>
        <p className="text-mute">
          The controller for the accounts and for the data each user enters is Tomás Sousa, author of Aquastats.
          Contact: {mail}. For the data a club records about its athletes (workouts, times, results, attendance), the
          club is the controller and Aquastats processes it on the club’s behalf, under a data processing agreement.
        </p>

        <h2 className={H2}>What we process</h2>
        <ul className={LIST}>
          <li>Account: name, email, sign-in method (Google or password, stored only as an Argon2id hash), role and team.</li>
          <li>Date of birth, to know whether a parent’s or guardian’s consent is needed, and that person’s email.</li>
          <li>Training: workouts, times, splits, strokes, attendance, races, results, personal bests and goals.</li>
          <li>
            Health and wellbeing (special category data): sleep, perceived effort (RPE), recovery and heart rate, entered
            by the athlete or imported from a watch (file or Polar).
          </li>
          <li>Accepted terms (version and date), sign-in records, IP address and security logs.</li>
          <li>Coach account requests: name, contact, team and message.</li>
        </ul>

        <h2 className={H2}>Purposes and legal bases</h2>
        <ul className={LIST}>
          <li>Providing the app (account, team, training, results): performance of the contract — the terms (GDPR art. 6(1)(b)).</li>
          <li>Health and wellbeing data: explicit consent (art. 9(2)(a)), which you can withdraw at any time.</li>
          <li>Security, abuse prevention and keeping logs: legitimate interest in protecting the service and its users (art. 6(1)(f)).</li>
          <li>Account emails (confirmation, password reset, inactivity warning): performance of the contract.</li>
          <li>
            Time predictions and training indicators are estimates to help the coach; they produce no decision with legal
            or similarly significant effects (art. 22).
          </li>
        </ul>

        <h2 className={H2}>Children under 13</h2>
        <p className="text-mute">
          In Portugal, consent for online services is valid from 13 (Lei 58/2019, art. 16). For an athlete under 13 we
          ask for the date of birth and the email of someone with parental responsibility, and send them a link to consent.
          Until they consent, the account works but stores no sleep, RPE, recovery or heart rate. They can withdraw
          consent at any time with the link in the confirmation email; when they do, we delete that data. The club that
          invites minors confirms it has the authorisation needed for the remaining training data.
        </p>

        <h2 className={H2}>Who sees the data</h2>
        <p className="text-mute">
          The coaches of your team see the team’s data, including athletes’ wellbeing and heart rate. An athlete sees
          only their own data. We do not sell data or use it for advertising. Processors:
        </p>
        <ul className={LIST}>
          <li>Neon (database, EU — Frankfurt).</li>
          <li>Cloudflare (website hosting, bot protection with Turnstile, reading PDF files with Workers AI).</li>
          <li>Google Cloud (API servers in the EU — Frankfurt, logs, Google sign-in, reading meet documents with Gemini).</li>
          <li>Resend (sending emails).</li>
          <li>Polar (only if the athlete connects their Polar account, to import heart rate).</li>
        </ul>
        <p className="text-mute">
          Some of these companies are based in the United States. Transfers then rely on the EU–US Data Privacy
          Framework or on standard contractual clauses.
        </p>

        <h2 className={H2}>How long we keep it</h2>
        <ul className={LIST}>
          <li>While the account is in use. An account inactive for 3 years is deleted, with an email warning 30 days before.</li>
          <li>When you delete the account, all your data is deleted at once, with no anonymised copies.</li>
          <li>Health and wellbeing data of a child under 13: until consent is withdrawn.</li>
          <li>Single-use links: 30 minutes (password), 24 hours (email confirmation), 7 days (consent request).</li>
          <li>Server logs: up to 30 days. Database recovery history: up to 7 days.</li>
          <li>Coach account requests: until they are decided.</li>
        </ul>

        <h2 className={H2}>Your rights</h2>
        <p className="text-mute">
          You can access, correct, delete, restrict, object to and port your data, and withdraw consent. In Settings you
          can export everything as JSON and delete the account yourself; for anything else write to {mail}. We reply
          within one month. You can also complain to the Portuguese data protection authority, the CNPD (
          <a href={CNPD}>www.cnpd.pt</a>).
        </p>

        <h2 className={H2}>Cookies</h2>
        <p className="text-mute">
          Only what the app needs: HttpOnly session cookies, a cookie with the chosen language and, during an invite or
          a Google or Polar sign-in, short-lived cookies for that step. No advertising or analytics cookies.
        </p>

        <h2 className={H2}>Security</h2>
        <p className="text-mute">
          Encryption in transit, row-level isolation between teams in the database, passwords as Argon2id hashes and
          watch tokens encrypted at rest. Details at /seguranca.
        </p>

        <h2 className={H2}>Changes</h2>
        <p className="text-mute">
          When this policy changes in a way that matters, the date and version above change and we let you know in the app
          or by email.
        </p>
      </LegalPage>
    );
  }

  return (
    <LegalPage title="Política de privacidade" updated={updated}>
      <p className={NOTE}>Rascunho: este texto deve ser revisto por um jurista antes de ser considerado final.</p>
      <p>
        Esta política explica que dados pessoais a Aquastats trata, para quê, com que fundamento, durante quanto tempo e
        como exerces os teus direitos. Versão 2026-10-20.
      </p>

      <h2 className={H2}>Quem é o responsável</h2>
      <p className="text-mute">
        O responsável pelo tratamento das contas e dos dados que cada utilizador introduz é Tomás Sousa, autor da
        Aquastats. Contacto: {mail}. Nos dados que um clube regista sobre os seus atletas (treinos, tempos, resultados,
        presenças), o responsável é o clube e a Aquastats trata-os por conta dele, ao abrigo de um acordo de tratamento de
        dados.
      </p>

      <h2 className={H2}>Que dados tratamos</h2>
      <ul className={LIST}>
        <li>Conta: nome, email, método de entrada (Google ou palavra-passe, guardada só como hash Argon2id), papel e equipa.</li>
        <li>Data de nascimento, para saber se é precisa a autorização de um responsável parental, e o email dessa pessoa.</li>
        <li>Treino: treinos, tempos, parciais, estilos, presenças, provas, resultados, recordes pessoais e objetivos.</li>
        <li>
          Saúde e bem-estar (categoria especial): sono, esforço percebido (RPE), recuperação e frequência cardíaca,
          introduzidos pelo atleta ou importados de um relógio (ficheiro ou Polar).
        </li>
        <li>Aceitação dos termos (versão e data), registos de entrada, endereço IP e registos de segurança.</li>
        <li>Pedidos de conta de treinador: nome, contacto, equipa e mensagem.</li>
      </ul>

      <h2 className={H2}>Finalidades e fundamentos</h2>
      <ul className={LIST}>
        <li>Prestar o serviço (conta, equipa, treino, resultados): execução do contrato — os termos (RGPD, art. 6.º, n.º 1, al. b).</li>
        <li>Dados de saúde e bem-estar: consentimento explícito (art. 9.º, n.º 2, al. a), que podes retirar a qualquer momento.</li>
        <li>Segurança, prevenção de abusos e registos: interesse legítimo em proteger o serviço e quem o usa (art. 6.º, n.º 1, al. f).</li>
        <li>Emails da conta (confirmação, repor palavra-passe, aviso de inatividade): execução do contrato.</li>
        <li>
          As previsões de tempos e os indicadores de treino são estimativas para ajudar o treinador; não produzem decisões
          com efeitos jurídicos ou semelhantes (art. 22.º).
        </li>
      </ul>

      <h2 className={H2}>Menores de 13 anos</h2>
      <p className="text-mute">
        Em Portugal, o consentimento para serviços online vale a partir dos 13 anos (Lei 58/2019, art. 16.º). Para um
        atleta com menos de 13 anos pedimos a data de nascimento e o email de quem exerce as responsabilidades parentais, e
        enviamos-lhe um link para autorizar. Até à autorização, a conta funciona, mas não guarda sono, RPE, recuperação nem
        frequência cardíaca. O responsável pode retirar a autorização a qualquer momento, no link do email de confirmação;
        nesse caso apagamos esses dados. O clube que convida menores garante ter a autorização necessária para os restantes
        dados de treino.
      </p>

      <h2 className={H2}>Quem vê os dados</h2>
      <p className="text-mute">
        Os treinadores da tua equipa veem os dados da equipa, incluindo o bem-estar e a frequência cardíaca dos atletas. Um
        atleta vê só os seus. Não vendemos dados nem os usamos para publicidade. Subcontratantes:
      </p>
      <ul className={LIST}>
        <li>Neon (base de dados, UE — Frankfurt).</li>
        <li>Cloudflare (alojamento do site, proteção contra robôs com Turnstile, leitura de PDFs com Workers AI).</li>
        <li>Google Cloud (servidores da API na UE — Frankfurt, registos, entrada com Google, leitura de regulamentos com Gemini).</li>
        <li>Resend (envio de emails).</li>
        <li>Polar (só se o atleta ligar a conta Polar, para importar a frequência cardíaca).</li>
      </ul>
      <p className="text-mute">
        Algumas destas empresas têm sede nos Estados Unidos. Nesses casos, a transferência apoia-se no Quadro de Privacidade
        de Dados UE-EUA ou em cláusulas contratuais-tipo.
      </p>

      <h2 className={H2}>Durante quanto tempo</h2>
      <ul className={LIST}>
        <li>Enquanto a conta estiver em uso. Uma conta inativa há 3 anos é apagada, com um aviso por email 30 dias antes.</li>
        <li>Quando apagas a conta, todos os teus dados são apagados logo, sem cópias anonimizadas.</li>
        <li>Dados de saúde e bem-estar de um menor de 13 anos: até a autorização ser retirada.</li>
        <li>Links de uso único: 30 minutos (palavra-passe), 24 horas (confirmar email), 7 dias (pedido de autorização).</li>
        <li>Registos do servidor: até 30 dias. Histórico de recuperação da base de dados: até 7 dias.</li>
        <li>Pedidos de conta de treinador: até serem decididos.</li>
      </ul>

      <h2 className={H2}>Os teus direitos</h2>
      <p className="text-mute">
        Tens direito de acesso, retificação, apagamento, limitação, oposição e portabilidade, e de retirar o consentimento.
        Nas definições podes exportar tudo em JSON e apagar a conta tu mesmo; para o resto, escreve para {mail}.
        Respondemos no prazo de um mês. Podes também apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD,{" "}
        <a href={CNPD}>www.cnpd.pt</a>).
      </p>

      <h2 className={H2}>Cookies</h2>
      <p className="text-mute">
        Só os necessários: cookies HttpOnly da sessão, um cookie com o idioma escolhido e, durante um convite ou uma entrada
        com Google ou Polar, cookies de curta duração para esse passo. Sem cookies de publicidade nem de análise.
      </p>

      <h2 className={H2}>Segurança</h2>
      <p className="text-mute">
        Cifra em trânsito, isolamento entre equipas na própria base de dados, palavras-passe em hash Argon2id e tokens de
        relógios cifrados. Detalhes em /seguranca.
      </p>

      <h2 className={H2}>Alterações</h2>
      <p className="text-mute">
        Quando esta política mudar de forma relevante, a data e a versão acima mudam e avisamos na app ou por email.
      </p>
    </LegalPage>
  );
}
