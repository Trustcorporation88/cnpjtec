# ADR 0006: camada de IA com a API da Anthropic

Status: proposta, aguardando aceite. Data: 12/11/2026.

## Decisão

- Roteamento por tarefa, com o identificador do modelo em variável de ambiente (`packages/agente/src/modelos.ts`):
  - triagem e extração de campos: `claude-haiku-5-5`
  - conversa com o usuário e operação das ferramentas: `claude-sonnet-5-5`
  - revisão de respostas de baixa confiança e leitura de legislação: `claude-opus-5-5`
- Tool use com esquema estrito. O contrato das 19 ferramentas está em `packages/agente/src/ferramentas.ts`. Só três têm efeito oficial e exigem confirmação registrada: gerar DAS, transmitir DASN-SIMEI e emitir NFS-e.
- Saída estruturada para a leitura de documentos, validada no servidor. Valor lido é confirmado com a pessoa antes de ser usado.
- Prompt de sistema versionado em `packages/agente/prompts/sistema.md`, alterado por PR.
- Cache de prompt para o prompt de sistema e a base de regras. Lotes para reavaliações noturnas.
- A chave da API fica só nos segredos do servidor, uma por ambiente, com limite de gasto e alerta.
- Registro de cada chamada com modelo, versão do prompt, ferramentas usadas e versão da base de regras.
- Áudio: a API recebe texto e imagem. Transcrição e resposta falada usam um serviço de voz a escolher.

## Avaliação antes de liberar qualquer versão

- Conjunto de referência com conversas e documentos reais anonimizados, com resposta certa definida pelo contador.
- Metas: toda afirmação de obrigação com regra identificada, nenhum valor calculado pela IA, pelo menos 98% de acerto nos campos monetários lidos e encaminhamento correto dos casos sem regra.
- Testes de injeção de instrução por documento e de vazamento de dados entre usuários.

## A confirmar

- Termos de retenção de dados do contrato da API e cláusula de transferência internacional para a LGPD.
- Lista de modelos vigente, conferida de novo a cada fase.
