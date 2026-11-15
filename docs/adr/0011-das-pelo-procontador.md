# ADR 0011: Situação do DAS pelo ProContador SaaS

## Decisão
O site e o WhatsApp consultam a situação do DAS do MEI pelo ProContador SaaS, que usa o robô do BotHub no PGMEI (aplicativo oficial). O SaaS ganhou a rota de serviço `/api/v1/servico/das-mei/extrato` (PR #108 do contador-saas).

## O que entrega e o que não entrega
- Entrega: o extrato do ano mês a mês (paga, em aberto, em atraso, valor, vencimento) e, se o robô trouxer, código de barras e linha digitável.
- Não entrega a guia gerada: no teste real, o robô não trouxe código de barras nem PDF. Para pagar, a pessoa é levada ao PGMEI, que só pede o CNPJ. Nunca dizemos que a guia foi gerada.

## Custo
Cada consulta concluída é cobrada pelo BotHub. Travas: no SaaS, uma consulta por CNPJ, ano e dia e teto diário (`SERVICO_DAS_LIMITE_DIARIO`, padrão 30); no site, só com conta e no máximo 5 por conta por dia; no WhatsApp, 3 por número por dia.

## Variáveis
Site: `PROCONTADOR_API_URL` (https://api.procontador.com.br/api/v1) e `PROCONTADOR_SERVICO_TOKEN`. SaaS: `SERVICO_PROCONTADOR_TOKEN` com o mesmo valor.
