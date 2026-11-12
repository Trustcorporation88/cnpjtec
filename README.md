# cnpjtec

Contador de bolso com IA do MEiSHOP para quem trabalha por conta própria: nanoempreendedor, pessoa física com CNPJ técnico, MEI prestador de serviço e MEI revendedor (Natura, Avon, Ambev e outras marcas).

**Regra principal:** a IA conversa, entende, explica e opera. Quem decide a situação fiscal de alguém e calcula qualquer valor é o motor de regras determinístico, com fonte e vigência.

## Estado atual

Fase 1 em andamento. O Raio-X Fiscal está publicado como prévia de testes no Railway. O Radar do CNPJ técnico está pronto e desligado até a configuração de quem responde pelos dados pessoais. Ainda não há agente de IA ligado.

| Pacote | O que é | Estado |
|---|---|---|
| `packages/regras` | Regras e parâmetros legais como dado versionado, com fonte, status e grau de conferência | 31 regras: 9 conferidas na fonte oficial, 13 em fonte secundária, 5 não conferidas e 4 sem norma publicada |
| `packages/motor-regras` | Motor puro que classifica a pessoa em trilhas e aponta alertas e pendências | Trilhas A a E, com os casos de teste da Fase 0 |
| `packages/agente` | Prompt de sistema e contrato das ferramentas do agente (API da Anthropic) | Contrato de 19 ferramentas definido, sem implementação |
| `packages/conteudo` | Textos em linguagem simples que transformam o resultado do motor em diagnóstico | Trilhas, alertas e pendências cobertos. Textos aguardam revisão do contador |
| `apps/web` | Site (Next.js) com o Raio-X Fiscal: questionário de uma pergunta por tela, resultado com a regra de cada afirmação, página da guia do MEI e página do caminho do CNPJ técnico | Publicado como prévia de testes |
| `supabase/migrations` | Estrutura do banco (Supabase, região de São Paulo) | Tabela `radar_inscricoes`, em que a chave pública só inclui e não lê |
| `docs/adr` | Decisões de arquitetura | 7 decisões. A 0007 trata da geração automática do DAS e aguarda credenciais |

## Como rodar

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @cnpjtec/web dev   # abre o Raio-X em http://localhost:3000
```

Requer Node 22 e pnpm 10.

## Regras de trabalho

- Nenhuma regra, valor ou prazo fica fixo no código. Tudo vem de `packages/regras/dados/regras.json`.
- Regra sem fonte entra como `PENDENTE`. O motor nunca inventa parâmetro: se faltar o limite de um ano, ele falha com erro claro.
- Mudança em regra é feita por PR, com revisão do contador responsável.
- Textos em português do Brasil, sem travessão.
- `main` só recebe código por PR com CI verde.

## Documentos de origem

O prompt do produto, a matriz de regras comentada e o estudo de viabilidade estão no projeto "CEREBRO MASTER", pasta `cnpj-tecnico/`.
