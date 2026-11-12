# ADR 0004: integrações oficiais por autorização formal, nunca por senha

Status: proposta, aguardando aceite. Data: 12/11/2026.

## Decisão

- O produto nunca pede nem guarda senha do gov.br ou de portal de governo.
- DAS do MEI, CCMEI e DASN-SIMEI passam pelo Integra Contador do Serpro, com o certificado e-CNPJ do MEiSHOP e, quando a plataforma exigir, procuração eletrônica dada pelo usuário no e-CAC.
- Consultas de CNPJ, Simples e inscrição estadual continuam pela HubServices.
- Abertura de MEI e pedido de inscrição estadual do MEI são fluxos assistidos no Portal do Empreendedor: o agente conduz e a pessoa executa.
- CNPJ técnico: enquanto a Receita não publicar o procedimento, o produto só acompanha, avisa e conduz no canal oficial. O módulo nasce com um adaptador para integração direta, desligado.
- Toda ação de efeito oficial fica registrada com quem confirmou, quando e o resumo mostrado.

## A confirmar antes de implementar

- Catálogo e preços vigentes do Integra Contador.
- Se a geração do DAS exige procuração ou só o CNPJ.
- Como a consultora.meishop.com.br gera o DAS hoje, para reaproveitar o que já funciona.
