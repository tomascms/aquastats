# Data processing agreement (template for clubs)

> **Draft: this text must be reviewed by a lawyer before it is signed.** Template under GDPR art. 28. Version
> 2026-10-20. The Portuguese version ([dpa-clubes.md](dpa-clubes.md)) prevails.

Between:

- **Controller:** [club name], company number [___], registered at [___], represented by [___] (the "Club");
- **Processor:** Tomás Sousa, author of Aquastats (aquastats.net), contact [contact email] ("Aquastats").

## 1. Subject

Aquastats processes personal data on the Club's behalf to provide the swim training app: planning workouts, recording
times, attendance, races and results, and showing indicators to the Club's coaches.

## 2. Data and data subjects

| Data subjects | Data |
|---|---|
| The Club's athletes, minors included | Name, date of birth, gender, training group, workouts, times, splits, attendance, races, results, personal bests, goals |
| Athletes who consent (or, under 13, their parent or guardian) | Sleep, perceived effort (RPE), recovery, heart rate (special category, art. 9) |
| The Club's coaches | Name, email, role |

Health and wellbeing data rests on the athlete's consent (or, under 13, the parent's or guardian's, Lei 58/2019,
art. 16), collected by the app itself. The athlete's account and that consent are processed by Aquastats as
controller, under the [privacy policy](https://aquastats.net/privacidade).

## 3. Aquastats' obligations

1. Process the data only on the Club's documented instructions (this agreement and the use of the app), unless the law
   requires otherwise, in which case it tells the Club first where the law allows.
2. Ensure that anyone with access to the data is bound by confidentiality.
3. Apply the art. 32 measures: encryption in transit, isolation between teams by row-level security in the database,
   Argon2id password hashes, encrypted third-party tokens, access logs, recovery backups and security reviews (see
   `docs/security/`).
4. Not engage another processor without the Club's general authorisation. The Club authorises those in section 5;
   Aquastats gives 30 days' notice of any change, and the Club may object.
5. Help the Club answer data subjects' requests (access, rectification, erasure, portability), in particular through the
   app: JSON export and account deletion.
6. Help the Club comply with arts. 32 to 36 (security, data breaches, impact assessments).
7. Notify the Club of a personal data breach without undue delay and, where possible, within 48 hours of becoming aware
   of it.
8. At the end of the contract, delete the Club's data (the team owner can delete the team at any time), unless the law
   requires it to be kept. Recovery backups are gone within 7 days.
9. Make available the information needed to demonstrate compliance and allow reasonable audits, with 30 days' notice
   and at most once a year.

## 4. The Club's obligations

1. Have a basis for the training data it records and for inviting athletes, minors in particular, and inform the data
   subjects.
2. Give access to the team only to authorised coaches and remove it when they stop being so.
3. Use the data only for training and sports management.

## 5. Authorised sub-processors

| Sub-processor | Purpose | Location |
|---|---|---|
| Neon | PostgreSQL database | EU (Frankfurt) |
| Cloudflare | Website hosting, Turnstile, reading PDFs (Workers AI) | Global network; US company |
| Google Cloud | API servers, logs, Google sign-in, reading meet regulations (Gemini) | EU (Frankfurt); US company |
| Resend | Sending emails | US company |
| Polar | Importing heart rate, only if the athlete connects their account | Finland |

Transfers outside the EEA rely on the EU–US Data Privacy Framework or on standard contractual clauses.

## 6. Term

This agreement applies while the Club uses Aquastats. An account inactive for 3 years is deleted, with an email warning
30 days before.

## 7. Governing law

Portuguese law and the GDPR.

Place and date: ____________________

| For the Club | For Aquastats |
|---|---|
| __________________ | Tomás Sousa |
