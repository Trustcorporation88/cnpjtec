import { z } from "zod";

/** Cliente mínimo da Evolution API v2: lê o webhook de mensagens e envia texto. */

export interface ConfiguracaoEvolution {
  url: string;
  instancia: string;
  chave: string;
  segredo: string;
  /** Números que podem conversar. Vazio libera todos. */
  permitidos: Set<string>;
}

export function configuracaoEvolution(env: NodeJS.ProcessEnv = process.env): ConfiguracaoEvolution | null {
  const url = env.EVOLUTION_URL?.trim().replace(/\/$/, "");
  const instancia = env.EVOLUTION_INSTANCIA?.trim();
  const chave = env.EVOLUTION_API_KEY?.trim();
  const segredo = env.WHATSAPP_WEBHOOK_SEGREDO?.trim();
  if (!url || !instancia || !chave || !segredo || segredo.length < 16) return null;
  const permitidos = new Set(
    (env.WHATSAPP_PERMITIDOS ?? "")
      .split(",")
      .map((n) => n.replace(/\D/g, ""))
      .filter(Boolean),
  );
  return { url, instancia, chave, segredo, permitidos };
}

const Chave = z.object({
  remoteJid: z.string(),
  fromMe: z.boolean().optional(),
  id: z.string(),
  remoteJidAlt: z.string().optional(),
  senderPn: z.string().optional(),
});

const Evento = z.object({
  event: z.string(),
  instance: z.string().optional(),
  data: z.object({
    key: Chave,
    message: z
      .object({
        conversation: z.string().optional(),
        extendedTextMessage: z.object({ text: z.string().optional() }).passthrough().optional(),
      })
      .passthrough()
      .nullish(),
  }).passthrough(),
}).passthrough();

export interface MensagemRecebida {
  id: string;
  /** Para onde responder: número com DDI ou o jid completo quando o número não veio. */
  destino: string;
  /** Número com DDI, quando conhecido. */
  numero: string | null;
  texto: string;
}

function numeroDoJid(jid: string | undefined): string | null {
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return null;
  const n = jid.split("@")[0]?.split(":")[0] ?? "";
  return /^\d{10,15}$/.test(n) ? n : null;
}

/** Extrai a mensagem de texto de um evento do webhook. Ignora as nossas, grupos e o que não é texto. */
export function lerEvento(corpo: unknown): MensagemRecebida | null {
  const evento = Evento.safeParse(corpo);
  if (!evento.success) return null;
  const nome = evento.data.event.toLowerCase().replace(/_/g, ".");
  if (nome !== "messages.upsert") return null;

  const { key, message } = evento.data.data;
  if (key.fromMe) return null;
  if (key.remoteJid.endsWith("@g.us") || key.remoteJid.endsWith("@broadcast") || key.remoteJid.endsWith("@newsletter")) {
    return null;
  }

  const texto = (message?.conversation ?? message?.extendedTextMessage?.text ?? "").trim();
  if (!texto || texto.length > 500) return null;

  const numero = numeroDoJid(key.remoteJid) ?? numeroDoJid(key.remoteJidAlt) ?? numeroDoJid(key.senderPn);
  return { id: key.id, destino: numero ?? key.remoteJid, numero, texto };
}

/** Envia uma mensagem de texto pela instância configurada. */
export async function enviarTexto(
  config: ConfiguracaoEvolution,
  destino: string,
  texto: string,
  buscar: typeof fetch = fetch,
): Promise<void> {
  const resposta = await buscar(`${config.url}/message/sendText/${encodeURIComponent(config.instancia)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.chave },
    body: JSON.stringify({ number: destino, text: texto }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) {
    throw new Error(`Evolution respondeu ${resposta.status} ao enviar mensagem.`);
  }
}

/** Compara o segredo sem vazar o tamanho do acerto pelo tempo de resposta. */
export function segredoConfere(esperado: string, recebido: string | null): boolean {
  if (!recebido || recebido.length !== esperado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diferenca === 0;
}
