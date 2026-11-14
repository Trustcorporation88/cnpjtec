import { describe, expect, it, vi } from "vitest";
import {
  chamar,
  configuracaoDaConta,
  ErroDeSessao,
  hashDoCodigo,
  hashDoToken,
  mesmaOrigem,
  novoCodigo,
  novoToken,
  textoDoConsentimentoDaConta,
  tokenDoPedido,
} from "./servidor";

const env = {
  SUPABASE_URL: "https://x.supabase.co/",
  SUPABASE_PUBLISHABLE_KEY: "pub",
  SUPABASE_CHAVE_SERVIDOR: "s".repeat(48),
  CONTROLADOR_CNPJ: "10.657.629/0001-62",
};

describe("configuração", () => {
  it("exige chave do servidor longa e o CNPJ do controlador", () => {
    expect(configuracaoDaConta({})).toBeNull();
    expect(configuracaoDaConta({ ...env, SUPABASE_CHAVE_SERVIDOR: "curta" })).toBeNull();
    expect(configuracaoDaConta(env)?.url).toBe("https://x.supabase.co");
  });

  it("o consentimento cita o CNPJ mesmo sem razão social", () => {
    expect(textoDoConsentimentoDaConta(configuracaoDaConta(env)!)).toContain("10.657.629/0001-62");
    expect(textoDoConsentimentoDaConta(configuracaoDaConta(env)!)).not.toMatch(/[—–]/);
  });
});

describe("segredos", () => {
  const config = configuracaoDaConta(env)!;
  it("código tem 6 números e token é longo e aleatório", () => {
    expect(novoCodigo()).toMatch(/^\d{6}$/);
    expect(novoToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(novoToken()).not.toBe(novoToken());
  });
  it("hash do código depende do telefone", () => {
    expect(hashDoCodigo(config, "+5514998370223", "123456")).not.toBe(hashDoCodigo(config, "+5514998370224", "123456"));
    expect(hashDoToken("a")).toHaveLength(64);
  });
});

describe("pedido", () => {
  it("lê o token do cookie e recusa formato estranho", () => {
    const t = novoToken();
    expect(tokenDoPedido(new Request("https://s/", { headers: { cookie: `a=1; pc_sessao=${t}` } }))).toBe(t);
    expect(tokenDoPedido(new Request("https://s/", { headers: { cookie: "pc_sessao=<script>" } }))).toBeNull();
  });
  it("só aceita mudança vinda do próprio site", () => {
    const ok = new Request("https://site.com/api", { method: "POST", headers: { origin: "https://site.com", host: "site.com" } });
    const fora = new Request("https://site.com/api", { method: "POST", headers: { origin: "https://mal.com", host: "site.com" } });
    const sem = new Request("https://site.com/api", { method: "POST", headers: { host: "site.com" } });
    expect(mesmaOrigem(ok)).toBe(true);
    expect(mesmaOrigem(fora)).toBe(false);
    expect(mesmaOrigem(sem)).toBe(false);
  });
});

describe("chamar", () => {
  const config = configuracaoDaConta(env)!;
  it("manda a chave do servidor e traduz sessão inválida", async () => {
    const buscar = vi.fn(async () => new Response('{"code":"28000","message":"sessao invalida"}', { status: 400 }));
    await expect(chamar(config, "srv_vendas", { p_token_hash: "x" }, buscar as unknown as typeof fetch)).rejects.toBeInstanceOf(ErroDeSessao);
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.supabase.co/rest/v1/rpc/srv_vendas");
    expect(JSON.parse(String(init.body)).p_chave).toBe("s".repeat(48));
  });
});
