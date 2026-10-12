import type { MessageKey } from "@/i18n";
import type { SignalKind } from "@/lib/indicators";

/** Title, reasoning and alternative of each training signal (docs/natacao/produto-treinador.md §C). */
export const SIGNAL_TEXT: Record<SignalKind, { title: MessageKey; why: MessageKey; alt: MessageKey }> = {
  "sem-dados": {
    title: "Poucos tempos para decidir",
    why: "Sem pelo menos 3 sessões cronometradas em 14 dias, qualquer sinal seria ruído.",
    alt: "Cronometrar a série principal das próximas sessões.",
  },
  taper: {
    title: "Prova a aproximar-se",
    why: "Um polimento de cerca de 2 semanas, com 41–60 % menos volume e a mesma intensidade, melhora em média 1–3 % (Bosquet 2007; Mujika 2002).",
    alt: "Manter o volume se a prova não for prioritária.",
  },
  "carga-acima": {
    title: "Carga acima do habitual",
    why: "A carga desta semana subiu mais de 30 % face às 4 anteriores. É uma descrição, não um risco de lesão.",
    alt: "Se foi planeado (bloco de choque), seguir com recuperação na semana seguinte.",
  },
  "base-aerobia": {
    title: "Pouca base aeróbia para a fase",
    why: "Na preparação geral e específica o volume aeróbio costuma ser a maior parte; aqui está abaixo da referência indicativa.",
    alt: "Se o atleta é velocista, uma parte menor de aeróbio pode ser intencional.",
  },
  "queda-ritmo": {
    title: "Mais queda de ritmo nas séries",
    why: "Nas últimas 2 semanas as séries principais caem mais do que o habitual deste atleta.",
    alt: "Pode ser a saída mais curta; comparar com séries iguais antes de concluir fadiga.",
  },
};

export const UNCERTAINTY: Record<string, MessageKey> = { baixa: "incerteza baixa", média: "incerteza média", alta: "incerteza alta" };

