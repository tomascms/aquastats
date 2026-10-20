/**
 * Portuguese overrides. Portuguese is the source text, so this only holds what the key itself
 * can't express: singular forms ("…|one", used when count === 1). Context keys ("Texto|ctx")
 * need no entry — Portuguese shows the part before "|".
 */
export const pt: Partial<Record<string, string>> = {
  "{count} tempos por sincronizar|one": "1 tempo por sincronizar",
  "{count} atletas|one": "1 atleta",
  "{count} reps mais lentas do que costuma|one": "1 rep mais lenta do que costuma",
  "{count} reps mais rápidas do que costuma|one": "1 rep mais rápida do que costuma",
  "quebrou nas últimas {count}|one": "quebrou na última",
  "{count} treinos agendados|one": "1 treino agendado",
  "{count} competições por vir|one": "1 competição por vir",
  "{count} convocados|one": "1 convocado",
  "{count} provas|one": "1 prova",
  "{count} atletas no plantel.|one": "1 atleta no plantel.",
  "{count} tempos|one": "1 tempo",
  "{count} tempos teus|one": "1 tempo teu",
  "{count} parciais|one": "1 parcial",
  "em {count} sessões|one": "em 1 sessão",
  "{count} tempos ignorados|one": "1 tempo ignorado",
  "{count} reps com estimativa|one": "1 rep com estimativa",
  "{count} estimadas|one": "1 estimada",
  "{count} reps|one": "1 rep",
  "{count} pernadas|one": "1 pernada",
  "{title}: {count} atletas atualizados.|one": "{title}: 1 atleta atualizado.",
  "TOT {count} reps|one": "TOT 1 rep",
  "Efeitos estimados só com os tempos deste atleta ({count} repetições comparáveis). Com poucos dados ficam perto de zero.|one":
    "Efeitos estimados só com os tempos deste atleta (1 repetição comparável). Com poucos dados ficam perto de zero.",
};
