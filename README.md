# cnpjtec

Contador de bolso com IA do MEiSHOP para quem trabalha por conta própria: nanoempreendedor, pessoa física com CNPJ técnico, MEI prestador de serviço e MEI revendedor (Natura, Avon, Ambev e outras marcas).

**Regra principal:** a IA conversa, entende, explica e opera. Quem decide a situação fiscal de alguém e calcula qualquer valor é o motor de regras determinístico, com fonte e vigência.

## Estado atual

Fase 0 e início da fundação. Ainda não há site nem serviço no ar.

| Pacote | O que é | Estado |
|---|---|---|
| `packages/regras` | Regras e parâmetros legais como dado versionado, com fonte, status e grau de conferência | 31 regras: 9 conferidas na fonte oficial, 13 em fonte secundária, 5 não conferidas e 4 sem norma publicada |
| `packages/motor-regras` | Motor puro que classifica a pessoa em trilhas e aponta alertas e pendências | Trilhas A a E, com os casos de teste da Fase 0 |
| `packages/agente` | Prompt de sistema e contrato das ferramentas do agente (API da Anthropic) | Contrato de 19 ferramentas definido, sem implementação |
| `docs/adr` | Decisões de arquitetura | 6 decisões propostas, aguardando aceite |

## Como rodar

```bash
pnpm install
pnpm typecheck
pnpm test
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
