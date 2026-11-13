import { describe, expect, it } from "vitest";
import { anosDisponiveis, medir, PedidoDoMedidor } from "./medidor";

describe("medidor na API", () => {
  it("só oferece anos com limite cadastrado", () => {
    expect(anosDisponiveis()).toEqual([2026, 2027]);
  });

  it("devolve resultado, pendências em linguagem simples e fontes", () => {
    const r = medir(
      PedidoDoMedidor.parse({
        anoCalendario: 2027,
        temMei: false,
        receitas: [{ mes: 1, tipo: "transporte_passageiros", valor: "12000" }],
      }),
    );
    expect(r.resultado.realizado).toBe("3000.00");
    expect(r.semDefinicao.map((f) => f.regra)).toContain("R09");
    expect(r.regras.map((x) => x.id)).toEqual(expect.arrayContaining(["R02", "R06", "R09", "R14"]));
  });

  it("recusa campo a mais e valor em formato errado", () => {
    const base = { anoCalendario: 2027, temMei: true, receitas: [{ mes: 1, tipo: "servico", valor: "1" }] };
    expect(PedidoDoMedidor.safeParse(base).success).toBe(true);
    expect(PedidoDoMedidor.safeParse({ ...base, cpf: "1" }).success).toBe(false);
    expect(
      PedidoDoMedidor.safeParse({ ...base, receitas: [{ mes: 1, tipo: "servico", valor: "1,5" }] }).success,
    ).toBe(false);
  });
});
