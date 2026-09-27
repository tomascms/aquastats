import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";
import { INTL_LOCALE, translate } from "@/i18n";
import { getServerLocale } from "@/i18n/server";
import { contactEmail } from "@/lib/site";

const H2 = "pt-2 text-xl font-semibold tracking-tight";
const UPDATED = new Date("2026-09-20T12:00:00");

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: translate(locale, "Privacidade"), robots: { index: false, follow: false } };
}

export default async function PrivacyPage() {
  const locale = await getServerLocale();
  const contact = contactEmail();
  const updated = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "long" }).format(UPDATED);

  if (locale === "en") {
    return (
      <LegalPage title="Privacy policy" updated={updated}>
        <p>
          Aquastats processes data so coaches and athletes can use the app: account, team, workouts, times and meet
          results.
        </p>
        <h2 className={H2}>What we store</h2>
        <ul className="list-disc space-y-1 pl-5 text-mute">
          <li>Name, email and sign-in method (Google or password).</li>
          <li>Your role in the app (coach or athlete) and the team you belong to.</li>
          <li>Workouts, times, strokes and results recorded by the coach.</li>
        </ul>
        <h2 className={H2}>What we never store</h2>
        <ul className="list-disc space-y-1 pl-5 text-mute">
          <li>Card number, CVV, expiry date or PIN.</li>
          <li>IBAN or full bank details.</li>
          <li>Your password in plain text — only an Argon2id hash.</li>
        </ul>
        <h2 className={H2}>Payments</h2>
        <p className="text-mute">Aquastats is free and collects no payment data.</p>
        <h2 className={H2}>Coach account requests</h2>
        <p className="text-mute">
          When you request a coach account, your name, contact, team and message are emailed to Aquastats so the
          request can be decided, and stay linked to your account until then.
        </p>
        <h2 className={H2}>Cookies</h2>
        <p className="text-mute">
          We use HttpOnly session cookies to keep you signed in, plus a cookie that remembers your language. We don’t
          use advertising cookies. A password reset request creates a single-use token, valid for 30 minutes.
        </p>
        <h2 className={H2}>Your rights</h2>
        <p className="text-mute">
          You can ask for access to, correction of or deletion of your account
          {contact ? (
            <>
              {" "}
              at <a href={`mailto:${contact}`}>{contact}</a>
            </>
          ) : (
            " through the contact at /seguranca"
          )}
          .
        </p>
      </LegalPage>
    );
  }

  return (
    <LegalPage title="Política de privacidade" updated={updated}>
      <p>
        A Aquastats trata dados para o treinador e o atleta usarem a app: conta, equipa, treinos, tempos e resultados
        de competição.
      </p>
      <h2 className={H2}>O que guardamos</h2>
      <ul className="list-disc space-y-1 pl-5 text-mute">
        <li>Nome, email e o método de entrada (Google ou palavra-passe).</li>
        <li>Papel na app (treinador ou atleta) e a equipa a que pertences.</li>
        <li>Treinos, tempos, estilos e resultados que o treinador regista.</li>
      </ul>
      <h2 className={H2}>O que nunca guardamos</h2>
      <ul className="list-disc space-y-1 pl-5 text-mute">
        <li>Número de cartão, CVV, data de validade ou PIN.</li>
        <li>IBAN ou dados bancários completos.</li>
        <li>A palavra-passe em texto — só um hash Argon2id.</li>
      </ul>
      <h2 className={H2}>Pagamentos</h2>
      <p className="text-mute">A Aquastats é gratuita e não recolhe dados de pagamento.</p>
      <h2 className={H2}>Pedidos de conta de treinador</h2>
      <p className="text-mute">
        Quando pedes uma conta de treinador, o nome, o contacto, a equipa e a mensagem são enviados por email à Aquastats
        para decidir o pedido, e ficam associados à tua conta até essa decisão.
      </p>
      <h2 className={H2}>Cookies</h2>
      <p className="text-mute">
        Usamos cookies HttpOnly da sessão para te manter ligado e um cookie que guarda o idioma escolhido. Não usamos
        cookies de publicidade. Um pedido de reposição de palavra-passe cria um token de uso único, válido 30 minutos.
      </p>
      <h2 className={H2}>Os teus direitos</h2>
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
