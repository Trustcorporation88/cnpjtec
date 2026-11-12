# ADR 0003: stack e organização do repositório

Status: proposta, aguardando aceite. Data: 12/11/2026.

## Decisão

- Monorepo com pnpm workspaces e TypeScript em modo strict. Turborepo entra quando houver aplicações para compilar.
- Pacotes já criados: `regras`, `motor-regras`, `agente`.
- Aplicações previstas:
  - `apps/web`: Next.js (App Router), com site público, área logada e painel de parceiros.
  - `apps/worker`: filas, integrações oficiais, leitura de documentos e lotes.
  - `apps/whatsapp`: webhook e orquestração do canal WhatsApp Business.
- Banco e autenticação no Supabase (Postgres, RLS em toda tabela com dado pessoal, Storage privado). Projetos separados para staging e produção, com migrations só pelo repositório.
- Hospedagem dos serviços no Railway, com ambiente por PR.
- Fila sobre o Postgres, com trava por usuário.
- Login sem senha, por código enviado no WhatsApp ou SMS.

## Pontos em aberto

- A infraestrutura atual do MEiSHOP está na Oracle Cloud. Falta decidir se este produto fica em Supabase e Railway ou se acompanha a infraestrutura existente.
- A MEIre já tem um canal de WhatsApp. Falta decidir se o agente novo usa o mesmo número.
