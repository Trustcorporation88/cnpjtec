# ADR 0007: geração automática da guia do MEI (DAS)

Status: proposta, aguardando credenciais. Data: 12/11/2026.

## Contexto

O produto precisa gerar a guia do MEI dentro do site e do WhatsApp, e enviá-la todo mês sem a pessoa pedir. Hoje a página `/das` leva a pessoa ao PGMEI, que é o canal oficial e gratuito. Isso resolve o caminho, mas não é automação.

A versão aberta do PGMEI tem proteção contra robôs. Automatizar por cima dela seria burlar essa proteção e quebraria a qualquer mudança da tela. Não vamos por aí.

## Decisão

Gerar o DAS pelo Integra Contador do Serpro, que é a interface oficial da Receita para esse fim.

O que a documentação pública do Serpro confirma (consultada em 12/11/2026):

- Sistema `PGMEI`, com dois serviços de emissão:
  - `GERARDASPDF21`: gera o DAS em PDF.
  - `GERARDASCODBARRA22`: gera só o código de barras, sem PDF.
- Chamada `POST` em `/integra-contador/v1/Emitir`, no gateway `gateway.apiserpro.serpro.gov.br`. Existe um ambiente de testes em `/integra-contador-trial/v1/Emitir`.
- Corpo com `contratante`, `autorPedidoDados` e `contribuinte` (cada um com `numero` e `tipo`), e `pedidoDados` com `idSistema`, `idServico`, `versaoSistema` e `dados`, em que `dados` é um texto JSON com `periodoApuracao` no formato AAAAMM.
- A resposta traz `status` e `mensagens` com código, como `[Sucesso-PGMEI]`. Pedir um mês ainda não vigente devolve `[EntradaIncorreta-PGMEI-MSG_23030]`.

## O que falta para implementar

1. **Credenciais do Integra Contador**: contratação na Loja Serpro com o e-CNPJ do MEiSHOP, que devolve Consumer Key e Consumer Secret. Ou, se a consultora.meishop.com.br já gera o DAS por um serviço próprio, o acesso a esse serviço.
2. **Formato completo da resposta e fluxo de autenticação**: as páginas da documentação bloqueiam leitura automática. Alguém precisa abrir a documentação ou rodar uma chamada no ambiente de testes para fecharmos o contrato.
3. **Autorização do MEI**: confirmar se a emissão exige procuração eletrônica ou só o CNPJ.
4. **Canal de envio**: WhatsApp Business ou e-mail transacional, para o envio mensal.

## Desenho quando as credenciais chegarem

- Ferramenta `gerar_das` do agente e rota `POST /api/das`, as duas chamando o mesmo módulo.
- Módulo com interface única de provedor, para trocar entre Integra Contador e o serviço atual do MEiSHOP sem mexer na tela.
- Certificado e segredos só nas variáveis do servidor. Nada no repositório.
- Rotina mensal que gera a guia de cada MEI inscrito, guarda no Cofre de Provas e envia pelo canal escolhido, com registro de cada emissão.
- Teste de aceite: guia gerada com o mesmo valor e o mesmo código de barras do PGMEI para o mesmo CNPJ e mês.

## Fontes

- [Serpro, Gerar DAS (PGMEI)](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/sistemas/pgmei/servicos/gerar_das/)
- [Serpro, Gerar DAS com código de barras](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/sistemas/pgmei/servicos/gerar_das_cod_barras/)
- [Serpro, cenários de teste do PGMEI](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/cenarios_trial/cenarios_pgmei/)
- [Serpro, endereços oficiais do PGMEI](https://serpro.gov.br/menu/noticias/noticias-2025/nova-funcionalidade-do-pgmei)
