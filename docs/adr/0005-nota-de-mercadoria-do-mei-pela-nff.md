# ADR 0005: nota de mercadoria do MEI pela Nota Fiscal Fácil, sem emissor próprio

Status: proposta, aguardando aceite. Data: 12/11/2026.

## Contexto

Em 2027, nas vendas a consumidor final pessoa física sem CNPJ, a DASN-SIMEI pode servir de documento fiscal (regra R18). Fora dessa hipótese, a regulamentação do Simples aponta a Nota Fiscal Fácil (NFF) como canal preferencial e gratuito para mercadorias do MEI (regra R20). A NFF é um aplicativo de celular do regime especial do Ajuste SINIEF 37/2019, que emite NF-e e NFC-e e carrega os produtos a partir do código de barras do DANFE de compra. A adesão é por estado.

## Decisão

- Na trilha D, o produto não constrói emissor próprio de NF-e nesta versão.
- Venda para pessoa física: o produto registra a venda e alimenta a DASN-SIMEI.
- Venda para empresa: o agente conduz a emissão pela NFF e guarda a nota no Cofre de Provas.
- A emissão de nota de produto que já existe na consultora.meishop.com.br continua disponível para quem é assinante de lá.

## A confirmar

- Se São Paulo aderiu à NFF para o MEI e desde quando.
- Se a NFF tem interface para integração ou só o aplicativo.
- O texto da Resolução CGSN 190/2026 no Diário Oficial (a regra R20 está com conferência secundária).
