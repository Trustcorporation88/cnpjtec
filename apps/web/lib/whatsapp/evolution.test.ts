import { describe, expect, it, vi } from "vitest";
import { configuracaoEvolution, enviarTexto, lerEvento, segredoConfere } from "./evolution";

const evento = (key: Record<string, unknown>, message: Record<string, unknown> = { conversation: "oi" }) => ({
  event: "messages.upsert",
  instance: "Trustcorp",
  data: { key: { id: "ABC", remoteJid: "5514998370223@s.whatsapp.net", fromMe: false, ...key }, message },
});

describe("lerEvento", () => {
  it("lê texto simples", () => {
    expect(lerEvento(evento({}))).toEqual({ id: "ABC", destino: "5514998370223", numero: "5514998370223", texto: "oi", instancia: "Trustcorp" });
  });
  it("lê texto estendido e evento em maiúsculas", () => {
    const e = { ...evento({}, { extendedTextMessage: { text: "1" } }), event: "MESSAGES_UPSERT" };
    expect(lerEvento(e)?.texto).toBe("1");
  });
  it("ignora mensagens nossas, de grupo e sem texto", () => {
    expect(lerEvento(evento({ fromMe: true }))).toBeNull();
    expect(lerEvento(evento({ remoteJid: "123@g.us" }))).toBeNull();
    expect(lerEvento(evento({}, { imageMessage: {} }))).toBeNull();
    expect(lerEvento({ event: "connection.update", data: {} })).toBeNull();
  });
  it("usa o número alternativo quando o jid é @lid", () => {
    const m = lerEvento(evento({ remoteJid: "987654321@lid", remoteJidAlt: "5514998370223@s.whatsapp.net" }));
    expect(m?.numero).toBe("5514998370223");
    expect(m?.destino).toBe("5514998370223");
  });
  it("responde pelo jid @lid quando não há número", () => {
    const m = lerEvento(evento({ remoteJid: "987654321@lid" }));
    expect(m?.numero).toBeNull();
    expect(m?.destino).toBe("987654321@lid");
  });
});

describe("configuração e envio", () => {
  const env = {
    EVOLUTION_URL: "https://evo.exemplo/",
    EVOLUTION_INSTANCIA: "Trustcorp",
    EVOLUTION_API_KEY: "chave",
    WHATSAPP_WEBHOOK_SEGREDO: "a".repeat(32),
    WHATSAPP_PERMITIDOS: "55 14 99837-0223",
  } as unknown as NodeJS.ProcessEnv;

  it("exige todas as variáveis", () => {
    expect(configuracaoEvolution({} as NodeJS.ProcessEnv)).toBeNull();
    const c = configuracaoEvolution(env);
    expect(c?.url).toBe("https://evo.exemplo");
    expect([...(c?.permitidos ?? [])]).toEqual(["5514998370223"]);
    expect(c?.palavra).toBe("procontador");
    expect(c?.comPalavra.size).toBe(0);
  });

  it("envia com a chave no cabeçalho", async () => {
    const c = configuracaoEvolution(env)!;
    const buscar = vi.fn(async () => new Response("{}", { status: 201 }));
    await enviarTexto(c, "5514998370223", "olá", buscar as unknown as typeof fetch);
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://evo.exemplo/message/sendText/Trustcorp");
    expect((init.headers as Record<string, string>).apikey).toBe("chave");
    expect(JSON.parse(String(init.body))).toEqual({ number: "5514998370223", text: "olá" });
  });

  it("confere o segredo", () => {
    expect(segredoConfere("abc", "abc")).toBe(true);
    expect(segredoConfere("abc", "abd")).toBe(false);
    expect(segredoConfere("abc", null)).toBe(false);
  });
});

describe("número público e instância", () => {
  it("só aceita número com DDI", async () => {
    const { numeroPublicoDoWhatsapp, linkDoWhatsapp } = await import("./evolution");
    expect(numeroPublicoDoWhatsapp({})).toBeNull();
    expect(numeroPublicoDoWhatsapp({ WHATSAPP_NUMERO_PUBLICO: "(14) 99999-0000" })).toBeNull();
    expect(numeroPublicoDoWhatsapp({ WHATSAPP_NUMERO_PUBLICO: "+55 14 99999-0000" })).toBe("5514999990000");
    expect(linkDoWhatsapp("5514999990000")).toBe("https://wa.me/5514999990000?text=Oi%2C%20ProContador!");
  });

  it("ignora mensagem de outra conexão", async () => {
    const { deOutraInstancia } = await import("./evolution");
    const config = { instancia: "procontador" } as Parameters<typeof deOutraInstancia>[0];
    const base = { id: "1", destino: "x", numero: null, texto: "oi" };
    expect(deOutraInstancia(config, { ...base, instancia: "Trustcorp" })).toBe(true);
    expect(deOutraInstancia(config, { ...base, instancia: "ProContador" })).toBe(false);
    expect(deOutraInstancia(config, base)).toBe(false);
  });

  it("configura o webhook da instância com o segredo na URL", async () => {
    const { configurarWebhook } = await import("./evolution");
    let chamada: { url: string; corpo: unknown; chave: string } | null = null;
    const buscar = (async (url: string, init: RequestInit) => {
      chamada = { url, corpo: JSON.parse(String(init.body)), chave: (init.headers as Record<string, string>).apikey ?? "" };
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    const config = { url: "https://evo", instancia: "procontador", chave: "k", segredo: "s".repeat(20) } as Parameters<typeof configurarWebhook>[0];
    expect(await configurarWebhook(config, "https://app.procontador.com.br/", buscar)).toBe(true);
    expect(chamada!.url).toBe("https://evo/webhook/set/procontador");
    expect(JSON.stringify(chamada!.corpo)).toContain("https://app.procontador.com.br/api/whatsapp/webhook?segredo=");
  });
});
