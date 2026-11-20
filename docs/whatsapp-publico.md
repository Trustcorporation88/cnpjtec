# Ligar o WhatsApp público do ProContador

Tudo está pronto no código e desligado. Para ligar:

1. Na Evolution, crie a instância `procontador` (Baileys) e leia o QR Code com o celular do número novo.
2. No Railway, serviço `web`, troque as variáveis:
   - `EVOLUTION_INSTANCIA` = `procontador`
   - `WHATSAPP_NUMERO_PUBLICO` = número com DDI, só dígitos (ex.: `5514999990000`)
   - `WHATSAPP_PERMITIDOS` = vazio (libera todos)
   - `WHATSAPP_NUMEROS_COM_PALAVRA` = vazio
3. O site sobe de novo e, ao subir, aponta o webhook da instância `procontador` para
   `/api/whatsapp/webhook` (veja `instrumentation.ts`). O log mostra "whatsapp: webhook configurado".
4. Na página inicial aparecem os botões "Prefiro pelo WhatsApp" e "Chamar no WhatsApp".

A linha da Trustcorp não é mexida: o webhook dela continua no n8n, e mensagens que chegam
de outra instância são ignoradas pelo ProContador (o n8n repassa ao Hawk).

Para desligar, apague `WHATSAPP_NUMERO_PUBLICO`: o botão some do site.
