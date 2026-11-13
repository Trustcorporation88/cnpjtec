import { baseDeRegras, buscarRegra } from "@cnpjtec/regras";
import { describe, expect, it } from "vitest";
import { ParametroAusente, PerfilInvalido, simularRegimes } from "./index";

const p = baseDeRegras.parametros;

describe("simulador", () => {
  it("guia do MEI de 2026 bate com os valores publicados", () => {
    const comercio = simularRegimes({ anoCalendario: 2026, atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "30000" }] }, p);
    const servico = simularRegimes({ anoCalendario: 2026, atividades: [{ tipo: "servico", receitaBrutaAnual: "30000" }] }, p);
    const misto = simularRegimes({ anoCalendario: 2026, atividades: [{ tipo: "servico", receitaBrutaAnual: "1" }, { tipo: "revenda_mercadoria", receitaBrutaAnual: "1" }] }, p);
    expect(comercio.mei.dasMensal).toBe("82.05");
    expect(servico.mei.dasMensal).toBe("86.05");
    expect(misto.mei.dasMensal).toBe("87.05");
    expect(servico.mei.dasNoAno).toBe("1032.60");
  });

  it("2027 usa o salário mínimo estimado e cita a regra de estimativa", () => {
    const r = simularRegimes({ anoCalendario: 2027, atividades: [{ tipo: "servico", receitaBrutaAnual: "40000" }] }, p);
    expect(r.mei.inss).toBe("87.05");
    expect(r.mei.dasMensal).toBe("92.05");
    expect(r.regrasAplicadas).toContain("R37");
    expect(buscarRegra("R37").status).toBe("ESTIMATIVA");
  });

  it("motorista de R$ 12 mil por mês: cabe no nano, não cabe no MEI", () => {
    const r = simularRegimes({ anoCalendario: 2027, atividades: [{ tipo: "transporte_passageiros", receitaBrutaAnual: "144000" }] }, p);
    expect(r.nano.cabe).toBe(true);
    expect(r.nano.receitaComputada).toBe("36000.00");
    expect(r.mei.cabe).toBe(false);
    expect(r.regularSeNaoForMei).toBe(false);
  });

  it("serviço de R$ 70 mil: não é nano, cabe no MEI, e sem MEI vai para o regime regular", () => {
    const r = simularRegimes({ anoCalendario: 2027, atividades: [{ tipo: "servico", receitaBrutaAnual: "70000" }] }, p);
    expect(r.nano.cabe).toBe(false);
    expect(r.mei.cabe).toBe(true);
    expect(r.regularSeNaoForMei).toBe(true);
    expect(r.mei.pesoNaReceita).toBe("1.6");
    expect(r.pendencias).toEqual(expect.arrayContaining(["R10", "R13"]));
  });

  it("MEI no limite exato ainda cabe", () => {
    const r = simularRegimes({ anoCalendario: 2027, atividades: [{ tipo: "servico", receitaBrutaAnual: "110000" }] }, p);
    expect(r.mei.cabe).toBe(true);
  });

  it("recusa ano sem salário mínimo e entrada inválida", () => {
    expect(() => simularRegimes({ anoCalendario: 2028, atividades: [{ tipo: "servico", receitaBrutaAnual: "1" }] }, p)).toThrow(ParametroAusente);
    expect(() => simularRegimes({ anoCalendario: 2027, atividades: [] }, p)).toThrow(PerfilInvalido);
    expect(() => simularRegimes({ anoCalendario: 2027, atividades: [{ tipo: "servico", receitaBrutaAnual: "1" }, { tipo: "servico", receitaBrutaAnual: "1" }] }, p)).toThrow(PerfilInvalido);
  });
});
