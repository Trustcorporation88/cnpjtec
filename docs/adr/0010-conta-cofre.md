# ADR 0010: Conta sem senha, Caderno na nuvem e Cofre de Provas

## Decisão
- Login só com o celular: código de 6 números pelo WhatsApp (Evolution), válido por 10 minutos, 5 tentativas e 3 envios a cada 15 minutos. Sessão em cookie httpOnly de 30 dias; o banco guarda só o hash do token.
- Os dados ficam no esquema `privado` do Supabase de São Paulo, que a API pública não expõe. O site acessa por funções `srv_*` que conferem a chave do servidor (`SUPABASE_CHAVE_SERVIDOR`, só no Railway; o banco guarda o hash) e a sessão. A chave publicável sozinha não lê nada.
- Caderno: sem conta continua só no aparelho; com conta, junta o que está no aparelho com a nuvem e guarda nos dois.
- Cofre de Provas: NF-e de compra pelo XML (lido no servidor, sem DOCTYPE nem entidades) ou só pela chave de acesso, com dígito conferido. Aceita CNPJ alfanumérico. O selo ICMS-ST só repete o que está na nota; a conclusão tributária depende da regra R28, pendente.
- LGPD: consentimento versionado na criação da conta, exportação completa em JSON, exclusão definitiva, registro de acessos.
- Pedido de ajuda ao contador: guarda a dúvida e avisa `CONTADOR_WHATSAPP`.

## Variáveis
`SUPABASE_CHAVE_SERVIDOR` (mínimo 32 caracteres), `CONTROLADOR_CNPJ`, `CONTROLADOR_NOME` (opcional), `CONTADOR_WHATSAPP`.

## Pendências
- Razão social do controlador e e-mail de privacidade para o texto de consentimento completo.
- Foto e PDF de nota no cofre (hoje só XML e chave).

## Assistente com IA (atualização)
- `/assistente` no site e pergunta livre no menu do WhatsApp. Liga sozinha quando `ANTHROPIC_API_KEY` existir no Railway.
- A IA só conversa: diagnóstico e simulação vêm das ferramentas `diagnosticar` e `simular`, que chamam o mesmo motor do site. Regras citadas vêm de `buscar_regra`.
- Minimização: o telefone nunca vai para a API; CPF, CNPJ, cartão e e-mail digitados são trocados por marcadores antes do envio.
- Modelo da conversa por `MODELO_CONVERSA` (padrão `claude-sonnet-5-5`).

## Caderno e cofre pelo WhatsApp (atualização de 16/11/2026)
- O WhatsApp acha a conta pelo número, que é o mesmo login do site. Funções `srv_wa_*` (migração `20261116120000_caderno_whatsapp.sql`) recebem o telefone e exigem a chave do servidor.
- Comandos: "vendi 150", "vendi 80 serviço", "vendi 300 para empresa", "minhas vendas", "desfazer" (últimas 24 horas) e arquivo XML de nota encaminhado.
- Na primeira vez, nada é guardado sem o "sim" da pessoa; o "sim" cria a conta com o mesmo consentimento do site.
- Depois de cada venda, o total do ano e o limite do MEI pelo mesmo cálculo do Caderno do site (`lib/caderno-limite.ts`), com aviso do mês em que estoura.
- Na linha compartilhada com o n8n, arquivos não chegam ao ProContador, porque o workflow só repassa texto. Com número próprio, o XML funciona.
