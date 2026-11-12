import { describe, expect, it, vi } from "vitest";
import {
  configuracaoDoRadar,
  criarLimite,
  gravarPedido,
  normalizarContato,
  PedidoDeAviso,
  textoDoConsentimento,
} from "./radar";

const ambiente = {
  SUPABASE_URL: "https://exemplo.supabase.co/",
  SUPABASE_PUBLISHABLE_KEY: "chave",
  CONTROLADOR_NOME: "Empresa Exemplo Ltda.",
  CONTROLADOR_CNPJ: "00.000.000/0001-00",
  CONTROLADOR_EMAIL: "privacidade@exemplo.com.br",
};

describe("configuração do Radar", () => {
  it("liga só quando banco e responsável pelos dados estão configurados", () => {
    expect(configuracaoDoRadar(ambiente)?.url).toBe("https://exemplo.supabase.co");
    for (const nome of Object.keys(ambiente)) {
      expect(configuracaoDoRadar({ ...ambiente, [nome]: "" })).toBeNull();
    }
  });

  it("o consentimento diz quem responde pelos dados e como sair", () => {
    const texto = textoDoConsentimento(configuracaoDoRadar(ambiente)!.controlador);
    expect(texto).toContain("Empresa Exemplo Ltda.");
    expect(texto).toContain("00.000.000/0001-00");
    expect(texto).toContain("privacidade@exemplo.com.br");
    expect(texto).not.toMatch(/[—–]/);
  });
});

describe("contato", () => {
  it.each([
    ["14 99999 9999", "+5514999999999"],
    ["(14) 99999-9999", "+5514999999999"],
    ["+55 14 99999 9999", "+5514999999999"],
    ["014999999999", "+5514999999999"],
  ])("celular %s vira %s", (digitado, esperado) => {
    expect(normalizarContato("whatsapp", digitado)).toBe(esperado);
  });

  it.each(["99999 9999", "14 3222 1234", "00 99999 9999", "abc", ""])("recusa celular %s", (d) => {
    expect(normalizarContato("whatsapp", d)).toBeNull();
  });

  it("e-mail fica em minúsculas e sem espaços nas pontas", () => {
    expect(normalizarContato("email", "  Nome@Email.COM ")).toBe("nome@email.com");
    expect(normalizarContato("email", "nome@email")).toBeNull();
    expect(normalizarContato("email", "nome email@x.com")).toBeNull();
  });
});

describe("pedido de aviso", () => {
  const base = { canal: "whatsapp", contato: "14999999999", trilha: "B_PF_CONTRIBUINTE", uf: "SP" };

  it("exige o aceite explícito", () => {
    expect(PedidoDeAviso.safeParse({ ...base, aceite: true }).success).toBe(true);
    expect(PedidoDeAviso.safeParse({ ...base, aceite: false }).success).toBe(false);
    expect(PedidoDeAviso.safeParse(base).success).toBe(false);
  });

  it("recusa campo a mais, como CPF", () => {
    expect(PedidoDeAviso.safeParse({ ...base, aceite: true, cpf: "1" }).success).toBe(false);
  });
});

describe("limite por origem", () => {
  it("barra depois do máximo e libera quando a janela passa", () => {
    let agora = 0;
    const dentro = criarLimite(2, 1000, () => agora);
    expect(dentro("a")).toBe(true);
    expect(dentro("a")).toBe(true);
    expect(dentro("a")).toBe(false);
    expect(dentro("b")).toBe(true);
    agora = 1001;
    expect(dentro("a")).toBe(true);
  });
});

describe("gravação", () => {
  it("contato repetido conta como gravado", async () => {
    const buscar = vi.fn(async () => new Response(null, { status: 409 }));
    const ok = await gravarPedido(
      configuracaoDoRadar(ambiente)!,
      { canal: "email", contato: "a@b.co", trilha: "B_PF_CONTRIBUINTE", uf: "SP" },
      buscar as unknown as typeof fetch,
    );
    expect(ok).toBe(true);
  });

  it("envia só os campos previstos", async () => {
    const buscar = vi.fn(async () => new Response(null, { status: 201 }));
    const ok = await gravarPedido(
      configuracaoDoRadar(ambiente)!,
      { canal: "email", contato: "nome@email.com", trilha: "B_PF_CONTRIBUINTE", uf: "SP" },
      buscar as unknown as typeof fetch,
    );
    expect(ok).toBe(true);
    const [url, opcoes] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://exemplo.supabase.co/rest/v1/radar_inscricoes");
    expect((opcoes.headers as Record<string, string>).Prefer).toBe("return=minimal");
    expect(Object.keys(JSON.parse(opcoes.body as string)).sort()).toEqual([
      "canal",
      "consentimento_versao",
      "contato",
      "trilha",
      "uf",
    ]);
  });

  it("avisa quando o banco recusa", async () => {
    const buscar = vi.fn(async () => new Response(null, { status: 403 }));
    const ok = await gravarPedido(
      configuracaoDoRadar(ambiente)!,
      { canal: "email", contato: "a@b.co", trilha: "B_PF_CONTRIBUINTE", uf: "SP" },
      buscar as unknown as typeof fetch,
    );
    expect(ok).toBe(false);
  });
});
