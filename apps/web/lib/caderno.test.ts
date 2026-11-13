import { describe, expect, it } from "vitest";
import { juntarCadernos, lerCaderno, planilhaDoAno, type Caderno } from "./caderno";

const venda = {
  id: "a",
  data: "2026-03-10",
  valor: "80.50",
  tipo: "mercadoria" as const,
  compradorTemCnpj: false,
  descricao: "Perfume",
};

describe("caderno", () => {
  it("lê e descarta o que está fora do formato", () => {
    const { caderno, descartadas } = lerCaderno(
      JSON.stringify({ vendas: [venda, { ...venda, id: "b", valor: "-1" }, { lixo: true }] }),
    );
    expect(caderno.vendas).toHaveLength(1);
    expect(descartadas).toBe(2);
  });

  it("recusa arquivo que não é caderno", () => {
    expect(() => lerCaderno("não é json")).toThrow();
    expect(() => lerCaderno(JSON.stringify({ outra: 1 }))).toThrow();
    expect(lerCaderno(null).caderno.vendas).toEqual([]);
  });

  it("junta sem repetir", () => {
    const c: Caderno = { versao: 1, vendas: [venda] };
    expect(juntarCadernos(c, { versao: 1, vendas: [venda, { ...venda, id: "b" }] }).vendas).toHaveLength(2);
  });

  it("gera planilha brasileira e protege contra fórmula", () => {
    const c: Caderno = {
      versao: 1,
      vendas: [
        { ...venda, descricao: '=HYPERLINK("x")' },
        { ...venda, id: "c", data: "2025-01-01" },
      ],
    };
    const linhas = planilhaDoAno(c, 2026).split("\r\n");
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toBe(`10/03/2026;Produto;Pessoa física;80,50;"'=HYPERLINK(""x"")"`);
  });
});

describe("migração da chave antiga", () => {
  it("lê o caderno salvo com a marca antiga, grava na chave nova e apaga a antiga", async () => {
    const dados = new Map<string, string>([["meishop.caderno.v1", JSON.stringify({ versao: 1, vendas: [venda] })]]);
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => dados.get(k) ?? null,
        setItem: (k: string, v: string) => void dados.set(k, v),
        removeItem: (k: string) => void dados.delete(k),
      },
    };
    const { carregarDoAparelho } = await import("./caderno");
    expect(carregarDoAparelho().vendas).toHaveLength(1);
    expect(dados.has("meishop.caderno.v1")).toBe(false);
    expect(dados.has("procontador.caderno.v1")).toBe(true);
    expect(carregarDoAparelho().vendas).toHaveLength(1);
    delete (globalThis as { window?: unknown }).window;
  });
});
