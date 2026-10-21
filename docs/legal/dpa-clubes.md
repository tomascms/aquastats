# Acordo de tratamento de dados (modelo para clubes)

> **Rascunho: este texto deve ser revisto por um jurista antes de ser assinado.** Modelo ao abrigo do art. 28.º do
> RGPD. Versão 2026-10-20. English version: [dpa-clubs.en.md](dpa-clubs.en.md).

Entre:

- **Responsável pelo tratamento:** [nome do clube], NIPC [___], com sede em [___], representado por [___] (o
  "Clube");
- **Subcontratante:** Tomás Sousa, autor da Aquastats (aquastats.net), contacto [email de contacto] (a "Aquastats").

## 1. Objeto

A Aquastats trata dados pessoais por conta do Clube para lhe prestar a app de treino de natação: planear treinos,
registar tempos, presenças, provas e resultados, e mostrar indicadores aos treinadores do Clube.

## 2. Dados e titulares

| Titulares | Dados |
|---|---|
| Atletas do Clube, incluindo menores | Nome, data de nascimento, género, grupo de treino, treinos, tempos, parciais, presenças, provas, resultados, recordes, objetivos |
| Atletas que o autorizam (ou, abaixo dos 13 anos, o responsável parental) | Sono, esforço percebido (RPE), recuperação, frequência cardíaca (categoria especial, art. 9.º) |
| Treinadores do Clube | Nome, email, papel |

Os dados de saúde e bem-estar assentam no consentimento do atleta (ou do responsável parental, abaixo dos 13 anos, Lei
58/2019, art. 16.º), recolhido pela própria app. A conta do atleta e esse consentimento são tratados pela Aquastats como
responsável, nos termos da [política de privacidade](https://aquastats.net/privacidade).

## 3. Obrigações da Aquastats

1. Tratar os dados só segundo instruções documentadas do Clube (este acordo e o uso da app), salvo obrigação legal,
   caso em que avisa o Clube antes, se a lei o permitir.
2. Garantir que quem tem acesso aos dados está obrigado a confidencialidade.
3. Aplicar as medidas do art. 32.º: cifra em trânsito, isolamento entre equipas por row-level security na base de
   dados, palavras-passe em hash Argon2id, tokens de terceiros cifrados, registos de acesso, cópias de recuperação e
   revisões de segurança (ver `docs/security/`).
4. Não recorrer a outro subcontratante sem autorização geral do Clube. O Clube autoriza os da secção 5; a Aquastats avisa
   com 30 dias de antecedência qualquer alteração, e o Clube pode opor-se.
5. Ajudar o Clube a responder a pedidos dos titulares (acesso, retificação, apagamento, portabilidade), em especial
   pelas funções da app: exportar em JSON e apagar a conta.
6. Ajudar o Clube no cumprimento dos arts. 32.º a 36.º (segurança, violações de dados, avaliações de impacto).
7. Notificar o Clube de uma violação de dados pessoais sem demora injustificada e, sempre que possível, em 48 horas
   após ter conhecimento dela.
8. No fim do contrato, apagar os dados do Clube (o dono da equipa pode apagar a equipa a qualquer momento), salvo
   obrigação legal de conservação. As cópias de recuperação desaparecem em até 7 dias.
9. Disponibilizar a informação necessária para demonstrar o cumprimento e permitir auditorias razoáveis, com aviso
   prévio de 30 dias e no máximo uma vez por ano.

## 4. Obrigações do Clube

1. Ter fundamento para os dados de treino que regista e para convidar atletas, em especial menores, e informar os
   titulares.
2. Dar acesso à equipa só a treinadores autorizados e retirá-lo quando deixarem de o ser.
3. Usar os dados só para o treino e a gestão desportiva.

## 5. Subcontratantes autorizados

| Subcontratante | Finalidade | Localização |
|---|---|---|
| Neon | Base de dados PostgreSQL | UE (Frankfurt) |
| Cloudflare | Alojamento do site, Turnstile, leitura de PDFs (Workers AI) | Rede global; empresa dos EUA |
| Google Cloud | Servidores da API, registos, entrada com Google, leitura de regulamentos (Gemini) | UE (Frankfurt); empresa dos EUA |
| Resend | Envio de emails | Empresa dos EUA |
| Polar | Importação de frequência cardíaca, só se o atleta ligar a sua conta | Finlândia |

As transferências para fora do EEE apoiam-se no Quadro de Privacidade de Dados UE-EUA ou em cláusulas contratuais-tipo.

## 6. Duração

Este acordo vigora enquanto o Clube usar a Aquastats. Uma conta inativa há 3 anos é apagada, com aviso por email 30
dias antes.

## 7. Lei aplicável

Lei portuguesa e RGPD.

Local e data: ____________________

| Pelo Clube | Pela Aquastats |
|---|---|
| __________________ | Tomás Sousa |
