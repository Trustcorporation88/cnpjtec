import { baseDeRegras } from "@cnpjtec/regras";
import { describe, expect, it } from "vitest";
import { ParametroAusente, PerfilInvalido, simularSaidaDoMei } from "./index";

const p = baseDeRegras.parametros;

describe("simulação de saída do MEI (ME no Simples)", () => {
  it("revendedora com R$ 10 mil por mês: Anexo I, 1ª faixa, 4%", () => {
    const r = simularSaidaDoMei({ anoCalendario: 2027, comercioMensal: "10000", servicoMensal: "0" }, p);
    expect(r.receitaAnual).toBe("120000.00");
    expect(r.partes[0]).toMatchObject({ anexo: "I", faixa: 1, aliquotaEfetiva: "4.00", guiaMensal: "400.00", cbsMensal: "61.32", ibsMensal: "0.68", cbsNaNota: "0.61", ibsNaNota: "0.01" });
    // MEI 2027: 5% de R$ 1.741 (estimativa, R37) + R$ 1 de ICMS = R$ 88,05
    expect(r.guiaMensalMei).toBe("88.05");
    expect(r.diferencaMensal).toBe("311.95");
    expect(r.regrasAplicadas).toEqual(expect.arrayContaining(["R40", "R42", "R37", "R35"]));
  });

  it("serviço na 2ª faixa usa a alíquota efetiva da receita total", () => {
    const r = simularSaidaDoMei({ anoCalendario: 2027, comercioMensal: "0", servicoMensal: "20000" }, p);
    // RBT12 240 mil: (240.000 x 11,2% - 9.360) / 240.000 = 7,30%
    expect(r.partes[0]).toMatchObject({ anexo: "III", faixa: 2, aliquotaNominal: "11.20", aliquotaEfetiva: "7.30", guiaMensal: "1460.00" });
    expect(r.avisos.join(" ")).toMatch(/fator R/);
  });

  it("comércio e serviço juntos: faixa pela receita somada", () => {
    const r = simularSaidaDoMei({ anoCalendario: 2027, comercioMensal: "12000", servicoMensal: "6000" }, p);
    expect(r.receitaAnual).toBe("216000.00");
    expect(r.partes.map((x) => x.faixa)).toEqual([2, 2]);
    expect(Number(r.guiaMensalSimples)).toBeCloseTo(Number(r.partes[0]!.guiaMensal) + Number(r.partes[1]!.guiaMensal), 2);
  });

  it("recusa o que não sabe calcular", () => {
    expect(() => simularSaidaDoMei({ anoCalendario: 2026, comercioMensal: "1000", servicoMensal: "0" }, p)).toThrow(ParametroAusente);
    expect(() => simularSaidaDoMei({ anoCalendario: 2027, comercioMensal: "200000", servicoMensal: "0" }, p)).toThrow(ParametroAusente);
    expect(() => simularSaidaDoMei({ anoCalendario: 2027, comercioMensal: "0", servicoMensal: "0" }, p)).toThrow(PerfilInvalido);
    expect(() => simularSaidaDoMei({ anoCalendario: 2027, comercioMensal: "-1", servicoMensal: "0" }, p)).toThrow(PerfilInvalido);
  });
});
