# ADR 0002: regras e parâmetros legais como dado versionado

Status: proposta, aguardando aceite. Data: 12/11/2026.

## Contexto

A legislação da Reforma muda toda semana. Na conferência de 12/11/2026 já apareceram um regulamento novo prometido para dezembro, um adiamento anunciado para março de 2027 e um limite do MEI de 2028 que depende do orçamento.

## Decisão

- Regras e parâmetros ficam em `packages/regras/dados/regras.json`, validados por esquema na carga.
- Cada regra tem status (em vigor, efeito futuro, pendente, anunciado, a confirmar) e grau de conferência (oficial, secundária, não conferida, sem norma).
- O motor recebe os parâmetros como argumento. Se faltar o parâmetro de um ano, ele falha com erro claro em vez de supor.
- Parâmetro numérico não pode se apoiar em regra pendente. Há teste para isso.
- Mudança de regra é feita por PR, com revisão do contador responsável. Quando houver banco, a tabela `regras` é carregada a partir deste arquivo, que continua sendo a fonte.

## Consequências

- O que está pendente aparece como pendente para o usuário, sem depender de memória de quem programou.
- A Sentinela Legislativa, quando existir, abre PR neste arquivo. Ela nunca altera regra sozinha.
