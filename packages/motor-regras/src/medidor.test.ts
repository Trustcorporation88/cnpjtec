import { baseDeRegras, buscarRegra } from "@cnpjtec/regras";
import { describe, expect, it } from "vitest";
import { medirLimite, ParametroAusente, PerfilInvalido } from "./index";

const parametros = baseDeRegras.parametros;

describe("medidor de limite", () => {
  it("motorista nano com R$ 12 mil brutos em todos os meses não estoura em 2027", () => {
    const r = medirLimite(
      {
        anoCalendario: 2027,
        temMei: false,
        receitas: Array.from({ length: 12 }, (_, i) => ({
          mes: i + 1,
          tipo: "transporte_passageiros" as const,
          valor: "12000",
        })),
      },
      parametros,
    );
    expect(r.tipoDeLimite).toBe("NANO");
    expect(r.limite).toBe("55000.00");
    expect(r.realizado).toBe("36000.00");
    expect(r.mesQueEstoura).toBeNull();
    expect(r.pendencias).toContain("R09");
  });

  it("nano estoura no mês em que a soma atinge o limite exato", () => {
    // 11 meses de R$ 5.000 somam R$ 55.000, que já não é "inferior a" R$ 55.000.
    const r = medirLimite(
      {
        anoCalendario: 2027,
        temMei: false,
        receitas: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, tipo: "servico" as const, valor: "5000" })),
      },
      parametros,
    );
    expect(r.mesQueEstoura).toBe(11);
    expect(r.estouroConfirmado).toBe(true);
    expect(r.pendencias).toContain("R10");
  });

  it("MEI só estoura quando passa do limite, não quando atinge", () => {
    const base = Array.from({ length: 11 }, (_, i) => ({ mes: i + 1, tipo: "servico" as const, valor: "10000" }));
    const exato = medirLimite(
      { anoCalendario: 2027, temMei: true, receitas: [...base, { mes: 12, tipo: "servico", valor: "0" }] },
      parametros,
    );
    expect(exato.realizado).toBe("110000.00");
    expect(exato.mesQueEstoura).toBeNull();
    const acima = medirLimite(
      { anoCalendario: 2027, temMei: true, receitas: [...base, { mes: 12, tipo: "servico", valor: "0.01" }] },
      parametros,
    );
    expect(acima.mesQueEstoura).toBe(12);
  });

  it("projeta os meses não informados pela média e marca o estouro como estimado", () => {
    const r = medirLimite(
      {
        anoCalendario: 2026,
        temMei: true,
        receitas: [
          { mes: 1, tipo: "revenda_mercadoria", valor: "9000" },
          { mes: 2, tipo: "revenda_mercadoria", valor: "7000" },
        ],
      },
      parametros,
    );
    expect(r.limite).toBe("81000.00");
    expect(r.realizado).toBe("16000.00");
    expect(r.projetadoNoAno).toBe("96000.00");
    // 8.000 por mês: janeiro a outubro somam 80.000, novembro passa para 88.000.
    expect(r.mesQueEstoura).toBe(11);
    expect(r.estouroConfirmado).toBe(false);
    expect(r.meses.filter((m) => m.estimado)).toHaveLength(10);
    expect(r.folga).toBe("65000.00");
    expect(r.percentualUsado).toBe("19.7");
  });

  it("MEI não usa a fração de aplicativo", () => {
    const r = medirLimite(
      { anoCalendario: 2027, temMei: true, receitas: [{ mes: 1, tipo: "entrega_de_bens", valor: "1000" }] },
      parametros,
    );
    expect(r.realizado).toBe("1000.00");
    expect(r.pendencias).not.toContain("R09");
  });

  it("começo no meio do ano reduz o limite e marca a pendência", () => {
    const r = medirLimite(
      { anoCalendario: 2027, temMei: false, mesInicio: 7, receitas: [{ mes: 7, tipo: "servico", valor: "1000" }] },
      parametros,
    );
    expect(r.limite).toBe("27500.00");
    expect(r.meses).toHaveLength(6);
    expect(r.pendencias).toContain("R08");
  });

  it("recusa entradas inválidas e ano sem limite", () => {
    const ok = { anoCalendario: 2027, temMei: false, receitas: [{ mes: 1, tipo: "servico" as const, valor: "1" }] };
    expect(() => medirLimite({ ...ok, receitas: [] }, parametros)).toThrow(PerfilInvalido);
    expect(() => medirLimite({ ...ok, mesInicio: 2 }, parametros)).toThrow(PerfilInvalido);
    expect(() =>
      medirLimite({ ...ok, receitas: [...ok.receitas, ...ok.receitas] }, parametros),
    ).toThrow(PerfilInvalido);
    expect(() =>
      medirLimite({ ...ok, receitas: [{ mes: 1, tipo: "servico", valor: "-1" }] }, parametros),
    ).toThrow(PerfilInvalido);
    expect(() => medirLimite({ ...ok, anoCalendario: 2028 }, parametros)).toThrow(ParametroAusente);
  });

  it("toda regra e pendência citada existe na base", () => {
    const r = medirLimite(
      {
        anoCalendario: 2027,
        temMei: false,
        mesInicio: 3,
        receitas: [{ mes: 3, tipo: "transporte_passageiros", valor: "90000" }],
      },
      parametros,
    );
    for (const id of [...r.regrasAplicadas, ...r.pendencias]) expect(() => buscarRegra(id)).not.toThrow();
  });
});
