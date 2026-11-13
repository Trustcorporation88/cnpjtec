# ADR 0008: o site sai com a marca ProContador

Status: aceita. Data: 13/11/2026.

## Decisão

- O site para quem trabalha por conta própria sai com a marca ProContador, e não com a marca MEiSHOP.
- Quem responde pelos dados pessoais coletados (Radar do CNPJ técnico) é a empresa de CNPJ 10.657.629/0001-62. Falta a razão social e o e-mail de privacidade para ligar o Radar.
- O caderno de vendas passa a usar a chave `procontador.caderno.v1` no aparelho. Quem já tinha anotado vendas na chave antiga tem os dados migrados na primeira visita.
- Referências a sistemas que existem com outro nome (consultora.meishop.com.br, MEIre) continuam com o nome real deles nos documentos internos.

## Consequências

- A guia do MEI, o Passaporte Fiscal e a API de parceiros ficam naturalmente no mesmo ecossistema do procontador.com.br.
- Domínio próprio do site ainda a definir (sugestão: um subdomínio de procontador.com.br).
