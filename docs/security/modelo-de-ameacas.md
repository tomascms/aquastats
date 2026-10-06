# Modelo de ameaças

Método: STRIDE simplificado sobre o fluxo real (telemóvel → Cloudflare Worker `aquastats.net` → Cloud Run
`aquastats-api` → Neon Postgres; Worker de IA `aquastats-ai` → Workers AI; Gemini; Polar; Resend; Google OAuth).

## Ativos

| Ativo | Porque importa |
|-------|----------------|
| Dados de atletas (nome, data de nascimento, tempos, provas, objetivos, bem-estar, frequência cardíaca) | Dados pessoais, muitas vezes de **menores**; bem-estar e FC são dados sensíveis de saúde/desempenho |
| Contas e sessões (password argon2, refresh tokens, contas Google) | Controlo da conta do treinador = acesso a toda a equipa |
| Segredos (`SESSION_SECRET`, chaves Google/Polar/Gemini/Resend/AI worker, credenciais da base) | Permitem forjar sessões, ler a base ou gastar quotas |
| Ledger de previsões | Histórico de avaliação do modelo; tem de ser imutável mas apagável com a conta |
| Disponibilidade da cronometragem | Usada na piscina em tempo real |

## Atores

Anónimo na internet · atleta curioso sobre colegas · treinador de outra equipa · conta comprometida ·
dependência comprometida · quem tenha acesso de leitura ao projeto GCP ou a uma cópia do `.env` local.

## Pontos de entrada

`aquastats.net` (Worker + proxy `/api/v1/*`), URL direto do Cloud Run (aberto até ao passo 6 da Fase G),
Worker de IA em `workers.dev` (chave partilhada), endpoint público do Neon (sem *allowlist* de IP, ver
"Limites"), callbacks OAuth (Google, Polar), uploads (PDF/Lenex/FIT), URLs de resultados ao vivo colados pelo
treinador (SSRF), repositório e CI.

## Ameaças priorizadas

| # | Ameaça (STRIDE) | Antes (06/10) | Agora (branch) | Resta |
|---|-----------------|---------------|----------------|-------|
| T1 | Acesso a dados de outra equipa por bug na app (I) | Só filtros em Python; role com BYPASSRLS → RLS ineficaz | Role `aquastats_api` sem BYPASSRLS; RLS forçada em todas as tabelas; atleta só vê o seu; matriz testada | Ativo só após Fase G passo 5 |
| T2 | SQL injection desliga o isolamento (E) | `app.bypass_rls` definível por qualquer sessão | Só `aquastats_auth` pode contornar (migração 012); a role da API não, mesmo com a flag (teste) | Injeção nos fluxos de autenticação continua grave → ORM parametrizado, sem SQL dinâmico com dados do utilizador |
| T3 | Execução remota via `next/og` (E) | Next 16.3.5 vulnerável (GHSA-vcvr-r3jv-pc5j) | 16.3.8 no PR #14 | Deploy = passo 1 da Fase G |
| T4 | Enumeração de contas e força bruta (I/S) | Mensagens distintas (Google, bloqueada); 8 caracteres | Mensagem única; 12 caracteres; lista de comuns; bloqueio 15 min após 8 falhas; rate limit na edge e na API | Bloqueio por conta pode ser abusado para negar acesso a um treinador → Turnstile no login (roadmap) |
| T5 | Contornar o rate limit pela origem aberta e falsificar o IP (S/D) | `ingress: all`, sem token; `CF-Connecting-IP` aceite de qualquer um | Token da edge testado; IPs validados antes de chegar a colunas `inet` | Ligar o token = passo 6 |
| T6 | Negação de serviço com pedidos pesados (D) | `/snapshot` 5 s e 39 MB por pedido (sintético 32×4) | Fase C (janela, paginação, compressão) | Ver Fase C |
| T7 | PDF malicioso (D/E) | pypdf 5.1.0 (49 avisos) | pypdf 6.19.0; limite de 15 MB | Parser ainda no processo da API |
| T8 | SSRF pelos resultados ao vivo (I) | HTTPS, porta 443, IPs privados bloqueados | Igual | DNS rebinding teórico (mitigado por TLS) |
| T9 | Fuga de segredos (I) | Variáveis simples no Cloud Run; `.env` local com o owner da produção | Guarda no arranque; plano: 1 segredo no Secret Manager + conta de serviço própria; rodar o owner | Passos 4 e 9 |
| T10 | Cópias de dados reais fora do fluxo de apagamento (I) | Branch Neon `teste-i18n-local` com dados de 26/09 | **Apagada** (06/10) | — |
| T11 | Edição do ledger ou bloqueio do direito ao apagamento (T) | Trigger contornável por qualquer role; permissões sem efeito | Sem UPDATE/DELETE para a API; interruptor só para o owner; cascatas testadas pelos caminhos reais | — |
| T12 | Atleta vê dados de colegas (I) | Filtro em Python depois de carregar a equipa | Políticas por papel; audit logs, convites e outbox só para treinadores; atleta não vê emails de colegas | Treinos/competições/presenças guardam listas de ids de atletas da equipa (sem nomes) |

## Fora de âmbito / aceites

Ataques ao Cloudflare, Google, Neon ou Resend em si; dispositivo do treinador comprometido; engenharia social.
