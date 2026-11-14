# ADR 0009: WhatsApp pela Evolution API

## Decisão
O ProContador atende no WhatsApp pela Evolution API (instância própria). A conversa é guiada por números, sem IA: as perguntas são as do Raio-X do site e quem decide é o mesmo motor de regras.

## Como funciona
- A Evolution envia o evento `MESSAGES_UPSERT` para `/api/whatsapp/webhook?segredo=...`.
- A rota ignora mensagens nossas, de grupo e sem texto, descarta repetidas e limita 20 mensagens por minuto por número.
- O estado da conversa fica em memória por 30 minutos. Se o servidor reiniciar, a conversa volta ao menu.
- `WHATSAPP_PERMITIDOS` restringe quem recebe resposta. Na fase de teste, só o número do responsável.

## Variáveis
`EVOLUTION_URL`, `EVOLUTION_INSTANCIA`, `EVOLUTION_API_KEY`, `WHATSAPP_WEBHOOK_SEGREDO` (mínimo 16 caracteres), `WHATSAPP_PERMITIDOS` (opcional, números separados por vírgula), `SITE_URL` (opcional).

## Próximos passos
- Guardar o estado no Supabase quando houver mais de uma instância do servidor.
- Abrir para todos os números depois do teste.
- Ligar a conversa livre com a API da Anthropic, sempre com o motor de regras decidindo.
