import { describe, expect, it, vi } from "vitest";
import { cnpjValido, configuracaoDas, consultarExtrato, pedirExtrato, resumoParaWhatsapp, type Consulta } from "./procontador";

const das = { url: "https://api.exemplo/api/v1", token: "t".repeat(40) };
const PEDIDO = "site:das-mei:11222333000181:2026:2026-11-14";

describe("configuração e CNPJ", () => {
  it("exige URL e token longo", () => {
    expect(configuracaoDas({})).toBeNull();
    expect(configuracaoDas({ PROCONTADOR_API_URL: "https://a/", PROCONTADOR_SERVICO_TOKEN: "curto" })).toBeNull();
    expect(configuracaoDas({ PROCONTADOR_API_URL: "https://a/", PROCONTADOR_SERVICO_TOKEN: "t".repeat(32) })?.url).toBe("https://a");
  });
  it("confere o dígito do CNPJ", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe("11222333000181");
    expect(cnpjValido("11.222.333/0001-82")).toBeNull();
    expect(cnpjValido("00000000000000")).toBeNull();
  });
});

describe("cliente", () => {
  it("pede com o token e confere a chave devolvida", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify({ success: true, pedido: PEDIDO, repetido: false }), { status: 202 }));
    expect(await pedirExtrato(das, "11222333000181", 2026, buscar as unknown as typeof fetch)).toEqual({ pedido: PEDIDO, repetido: false });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.exemplo/api/v1/servico/das-mei/extrato");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${"t".repeat(40)}`);
  });
  it("recusa pedido fora do formato antes de chamar", async () => {
    const buscar = vi.fn();
    await expect(consultarExtrato(das, "das-mei:x", buscar as unknown as typeof fetch)).rejects.toThrow();
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe("resumo para o WhatsApp", () => {
  const consulta: Consulta = {
    pronto: true,
    status: "FINISHED",
    erro: null,
    extrato: { situacaoGeralTexto: null, dividaAtiva: false, meses: [] },
    guias: [
      { mes: 9, ano: 2026, vencimento: "2026-10-20", situacao: "PAGO", valorTotal: 86.05, dataPagamento: "2026-10-15", codigoBarras: null, linhaDigitavel: null, temPdf: false },
      { mes: 10, ano: 2026, vencimento: "2026-11-20", situacao: "EMITIDO", valorTotal: 86.05, dataPagamento: null, codigoBarras: null, linhaDigitavel: null, temPdf: false },
    ],
  };
  it("mostra mês a mês e manda ao PGMEI quando não há linha digitável", () => {
    const t = resumoParaWhatsapp("11222333000181", 2026, consulta, "https://pgmei");
    expect(t).toContain("setembro: paga");
    expect(t).toContain("outubro: em aberto");
    expect(t).toContain("https://pgmei");
    expect(t).not.toMatch(/[—–]/);
  });
  it("não inventa extrato quando o robô falhou", () => {
    const t = resumoParaWhatsapp("11222333000181", 2026, { ...consulta, extrato: null, guias: [] }, "https://pgmei");
    expect(t).toContain("Não consegui ler o PGMEI");
  });
});
