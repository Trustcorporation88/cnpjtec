# ADR 0001: motor determinístico decide, IA conversa e opera

Status: proposta, aguardando aceite. Data: 12/11/2026.

## Contexto

O público não entende de imposto e vai confiar no que o produto disser. Um modelo de linguagem pode errar um valor ou afirmar uma obrigação que não existe com a mesma segurança de quando acerta.

## Decisão

- O enquadramento da pessoa, os limites, os prazos e qualquer valor saem do pacote `motor-regras`, feito de funções puras com aritmética decimal.
- A IA (API da Anthropic) entende o que a pessoa diz, lê documentos, explica o resultado em linguagem simples e chama ferramentas. Ela nunca calcula nem decide.
- Toda afirmação de obrigação carrega o identificador da regra. Sem regra, o agente chama um contador.
- Se a API de IA ficar fora do ar, o produto continua por fluxo guiado com botões, usando o mesmo motor.

## Consequências

- O mesmo resultado sai pelo site, pelo WhatsApp e pela API de parceiros.
- O motor pode ser auditado pelo contador sem ler prompt.
- Custa mais trabalho no começo, porque cada situação nova exige regra cadastrada antes de o agente poder falar dela.
