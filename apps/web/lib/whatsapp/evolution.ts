import { z } from "zod";

/** Cliente mínimo da Evolution API v2: lê o webhook de mensagens e envia texto. */

export interface ConfiguracaoEvolution {
  url: string;
  instancia: string;
  chave: string;
  segredo: string;
  /** Números que podem conversar. Vazio libera todos. */
  permitidos: Set<string>;
  /** Números que dividem a linha com outros robôs: só entram na conversa com a palavra. */
  comPalavra: Set<string>;
  palavra: string;
}

export function configuracaoEvolution(env: NodeJS.ProcessEnv = process.env): ConfiguracaoEvolution | null {
  const url = env.EVOLUTION_URL?.trim().replace(/\/$/, "");
  const instancia = env.EVOLUTION_INSTANCIA?.trim();
  const chave = env.EVOLUTION_API_KEY?.trim();
  const segredo = env.WHATSAPP_WEBHOOK_SEGREDO?.trim();
  if (!url || !instancia || !chave || !segredo || segredo.length < 16) return null;
  const numeros = (lista: string | undefined) =>
    new Set(
      (lista ?? "")
        .split(",")
        .map((n) => n.replace(/\D/g, ""))
        .filter(Boolean),
    );
  const palavra = (env.WHATSAPP_PALAVRA_ENTRADA ?? "procontador").trim().toLowerCase();
  return {
    url,
    instancia,
    chave,
    segredo,
    permitidos: numeros(env.WHATSAPP_PERMITIDOS),
    comPalavra: numeros(env.WHATSAPP_NUMEROS_COM_PALAVRA),
    palavra,
  };
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
  /** Arquivo encaminhado (por enquanto só tratamos XML de nota). */
  documento?: { nome: string; tipo: string };
  /** Para onde responder: número com DDI ou o jid completo quando o número não veio. */
  destino: string;
  /** Número com DDI, quando conhecido. */
  numero: string | null;
  texto: string;
  /** Nome da instância da Evolution que recebeu a mensagem, quando o evento informa. */
  instancia?: string;
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

  const numero = numeroDoJid(key.remoteJid) ?? numeroDoJid(key.remoteJidAlt) ?? numeroDoJid(key.senderPn);
  const destino = numero ?? key.remoteJid;
  const instancia = evento.data.instance ? { instancia: evento.data.instance } : {};

  const bruto = (message ?? {}) as Record<string, unknown>;
  const doc = (bruto.documentMessage ??
    ((bruto.documentWithCaptionMessage as { message?: { documentMessage?: unknown } } | undefined)?.message?.documentMessage)) as
    | { fileName?: unknown; mimetype?: unknown; caption?: unknown }
    | undefined;
  if (doc) {
    return {
      id: key.id,
      destino,
      numero,
      texto: typeof doc.caption === "string" ? doc.caption.slice(0, 500) : "",
      documento: { nome: String(doc.fileName ?? "arquivo").slice(0, 120), tipo: String(doc.mimetype ?? "") },
      ...instancia,
    };
  }

  const texto = (message?.conversation ?? message?.extendedTextMessage?.text ?? "").trim();
  if (!texto || texto.length > 500) return null;
  return { id: key.id, destino, numero, texto, ...instancia };
}

/** A mensagem veio de outra conexão (ex.: a linha da Trustcorp repassada pelo n8n)? */
export function deOutraInstancia(config: ConfiguracaoEvolution, mensagem: MensagemRecebida): boolean {
  return mensagem.instancia !== undefined && mensagem.instancia.toLowerCase() !== config.instancia.toLowerCase();
}

/**
 * Número público do ProContador no WhatsApp (só dígitos, com DDI). Enquanto não estiver
 * configurado, o site não mostra o botão e o webhook não é mexido.
 */
export function numeroPublicoDoWhatsapp(env: Record<string, string | undefined> = process.env): string | null {
  const n = (env.WHATSAPP_NUMERO_PUBLICO ?? "").replace(/\D/g, "");
  return /^\d{12,13}$/.test(n) ? n : null;
}

export function linkDoWhatsapp(numero: string, texto = "Oi, ProContador!"): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Aponta o webhook da instância para o ProContador. Chamado ao subir o site, e só quando o número
 * público está configurado: assim a linha da Trustcorp, que tem webhook próprio no n8n, nunca é tocada.
 */
export async function configurarWebhook(
  config: ConfiguracaoEvolution,
  siteUrl: string,
  buscar: typeof fetch = fetch,
): Promise<boolean> {
  const destino = `${siteUrl.replace(/\/$/, "")}/api/whatsapp/webhook?segredo=${encodeURIComponent(config.segredo)}`;
  const r = await buscar(`${config.url}/webhook/set/${encodeURIComponent(config.instancia)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.chave },
    body: JSON.stringify({
      webhook: { enabled: true, url: destino, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return r.ok;
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

/** Envia um PDF como documento pela instância configurada. */
export async function enviarPdf(
  config: ConfiguracaoEvolution,
  destino: string,
  pdf: Buffer,
  nome: string,
  legenda: string,
  buscar: typeof fetch = fetch,
): Promise<void> {
  const resposta = await buscar(`${config.url}/message/sendMedia/${encodeURIComponent(config.instancia)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.chave },
    body: JSON.stringify({
      number: destino,
      mediatype: "document",
      mimetype: "application/pdf",
      fileName: nome,
      caption: legenda,
      media: pdf.toString("base64"),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resposta.ok) throw new Error(`Evolution respondeu ${resposta.status} ao enviar o PDF.`);
}

/** Compara o segredo sem vazar o tamanho do acerto pelo tempo de resposta. */
export function segredoConfere(esperado: string, recebido: string | null): boolean {
  if (!recebido || recebido.length !== esperado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diferenca === 0;
}

/** Baixa o arquivo de uma mensagem recebida (base64), pela Evolution. */
export async function baixarArquivo(
  config: ConfiguracaoEvolution,
  idDaMensagem: string,
  buscar: typeof fetch = fetch,
): Promise<Buffer> {
  const r = await buscar(`${config.url}/chat/getBase64FromMediaMessage/${encodeURIComponent(config.instancia)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.chave },
    body: JSON.stringify({ message: { key: { id: idDaMensagem } }, convertToMp4: false }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`Evolution respondeu ${r.status} ao baixar o arquivo.`);
  const corpo = (await r.json()) as { base64?: unknown };
  if (typeof corpo.base64 !== "string") throw new Error("Evolution não devolveu o arquivo.");
  const arquivo = Buffer.from(corpo.base64, "base64");
  if (arquivo.length > 1_048_576) throw new Error("Arquivo grande demais.");
  return arquivo;
}

export function ehXml(documento: { nome: string; tipo: string }): boolean {
  return /\.xml$/i.test(documento.nome) || /xml/i.test(documento.tipo);
}
