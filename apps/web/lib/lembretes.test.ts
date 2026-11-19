import type { Venda } from "@cnpjtec/motor-regras";
import { describe, expect, it } from "vitest";
import { comandoDeLembretes, lembretesDoDia, type Assinante } from "./lembretes";

const v = (data: string, valor: string): Venda => ({ data, valor, tipo: "mercadoria", compradorTemCnpj: false });
const pessoa = (vendas: Venda[] = [], extra: Partial<Assinante> = {}): Assinante => ({
  telefone: "+5514998370223",
  das: true,
  declaracao: true,
  limite: true,
  vendas,
  ...extra,
});
const chaves = (a: Assinante, hoje: string) => lembretesDoDia(a, hoje, "https://site").map((l) => l.chave);

describe("lembretes do dia", () => {
  it("DAS do dia 15 ao 20, com a competência do mês anterior e a regra R32", () => {
    expect(chaves(pessoa(), "2026-11-14")).toEqual([]);
    const [l] = lembretesDoDia(pessoa(), "2026-11-15", "https://site");
    expect(l!.chave).toBe("das:2026-11");
    expect(l!.texto).toContain("outubro de 2026");
    expect(l!.texto).toContain("20/11");
    expect(l!.texto).toContain("R32");
    expect(chaves(pessoa(), "2026-11-20")).toEqual(["das:2026-11"]);
    expect(chaves(pessoa(), "2026-11-21")).toEqual([]);
    expect(lembretesDoDia(pessoa(), "2027-01-16", "x")[0]!.texto).toContain("dezembro de 2026");
  });

  it("declaração em março e a partir de 15 de maio, com o total do caderno", () => {
    const a = pessoa([v("2026-03-10", "1500"), v("2026-07-01", "500")], { das: false });
    const [mar] = lembretesDoDia(a, "2027-03-02", "https://site");
    expect(mar!.chave).toBe("dasn:2026:mar");
    expect(mar!.texto).toContain("R$ 2.000,00");
    expect(chaves(a, "2027-05-14")).toEqual([]);
    expect(chaves(a, "2027-05-15")).toEqual(["dasn:2026:mai"]);
    expect(lembretesDoDia(pessoa([], { das: false }), "2027-03-02", "x")[0]!.texto).toContain("R$ 0,00");
  });

  it("limite: 80% e depois 100%, cada um uma vez por ano", () => {
    const meses = (valor: string, n: number) => Array.from({ length: n }, (_, i) => v(`2026-${String(i + 1).padStart(2, "0")}-05`, valor));
    expect(chaves(pessoa(meses("6800", 10), { das: false }), "2026-11-02")).toEqual(["limite80:2026"]);
    expect(chaves(pessoa(meses("9000", 10), { das: false }), "2026-11-02")).toEqual(["limite100:2026"]);
    expect(chaves(pessoa(meses("1000", 10), { das: false }), "2026-11-02")).toEqual([]);
    const texto = lembretesDoDia(pessoa(meses("9000", 10), { das: false }), "2026-11-02", "https://site")[0]!.texto;
    expect(texto).toContain("R38");
    expect(texto).toContain("https://site/ajuda");
  });

  it("respeita o que a pessoa desligou e nunca usa travessão", () => {
    expect(chaves(pessoa([], { das: false, declaracao: false }), "2027-03-16")).toEqual([]);
    for (const l of lembretesDoDia(pessoa([v("2026-01-05", "90000")]), "2026-11-16", "x")) {
      expect(l.texto).not.toContain("—");
      expect(l.texto).toContain("parar lembretes");
    }
  });

  it("entende os pedidos", () => {
    expect(comandoDeLembretes("lembretes")).toBe("ligar");
    expect(comandoDeLembretes("quero lembretes")).toBe("ligar");
    expect(comandoDeLembretes("parar lembretes")).toBe("desligar");
    expect(comandoDeLembretes("nao quero mais lembretes")).toBe("desligar");
    expect(comandoDeLembretes("lembrete do das")).toBeNull();
  });
});
