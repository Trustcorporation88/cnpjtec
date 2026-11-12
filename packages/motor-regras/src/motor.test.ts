import { baseDeRegras, buscarRegra } from "@cnpjtec/regras";
import { describe, expect, it } from "vitest";
import { classificar, ParametroAusente, PerfilInvalido } from "./index";
import type { Perfil, Resultado } from "./index";

const parametros = baseDeRegras.parametros;

function pf(extra: Partial<Perfil> & Pick<Perfil, "atividades">): Perfil {
  return { anoCalendario: 2027, vinculo: "conta_propria", temMei: false, uf: "SP", ...extra };
}

function codigos(resultado: Resultado): string[] {
  return resultado.alertas.map((a) => a.codigo);
}

describe("casos de referência da Fase 0 (2027)", () => {
  it("T1: motorista com R$ 12 mil brutos por mês é nano", () => {
    const r = classificar(
      pf({ atividades: [{ tipo: "transporte_passageiros", receitaBrutaAnual: "144000" }] }),
      parametros,
    );
    expect(r.trilhas).toEqual(["A_NANO"]);
    expect(r.receitaComputadaNano).toBe("36000.00");
    expect(r.limiteNano).toBe("55000.00");
    expect(r.pendencias).toContain("R09");
  });

  it("T2: R$ 220 mil brutos dá exatamente o limite e não é nano", () => {
    const r = classificar(
      pf({ atividades: [{ tipo: "transporte_passageiros", receitaBrutaAnual: "220000" }] }),
      parametros,
    );
    expect(r.receitaComputadaNano).toBe("55000.00");
    expect(r.trilhas).toEqual(["B_PF_CONTRIBUINTE"]);
    expect(r.pendencias).toEqual(expect.arrayContaining(["R10", "R12", "R13"]));
    expect(codigos(r)).toContain("ACOMPANHAR_CNPJ_TECNICO");
  });

  it("T3: um centavo abaixo é nano, sem arredondar", () => {
    const r = classificar(
      pf({ atividades: [{ tipo: "entrega_de_bens", receitaBrutaAnual: "219999.99" }] }),
      parametros,
    );
    expect(r.receitaComputadaNano).toBe("54999.9975");
    expect(r.trilhas).toEqual(["A_NANO"]);
  });

  it("T4: início em julho usa limite proporcional e marca a pendência", () => {
    const r = classificar(
      pf({
        mesesDeAtividadeNoAno: 6,
        atividades: [{ tipo: "servico", receitaBrutaAnual: "27500" }],
      }),
      parametros,
    );
    expect(r.limiteNano).toBe("27500.00");
    expect(r.trilhas).toEqual(["B_PF_CONTRIBUINTE"]);
    expect(r.pendencias).toContain("R08");
  });

  it("T5: receitas de atividades diferentes se somam", () => {
    const r = classificar(
      pf({
        atividades: [
          { tipo: "transporte_passageiros", receitaBrutaAnual: "120000" },
          { tipo: "revenda_mercadoria", receitaBrutaAnual: "26400" },
        ],
      }),
      parametros,
    );
    expect(r.receitaComputadaNano).toBe("56400.00");
    expect(r.trilhas).toEqual(["B_PF_CONTRIBUINTE"]);
  });

  it("T6: quem só recebe comissão não entra na revenda", () => {
    const r = classificar(
      pf({ atividades: [{ tipo: "intermediacao_comissao", receitaBrutaAnual: "18000" }] }),
      parametros,
    );
    expect(r.trilhas).toEqual(["A_NANO"]);
    expect(codigos(r)).toContain("INTERMEDIACAO_ANALISAR_COMO_SERVICO");
    expect(codigos(r)).not.toContain("REVENDA_PF_CONTRIBUINTE_ICMS");
  });

  it("T7: MEI revendedor em SP sem inscrição estadual recebe alerta de CADESP", () => {
    const r = classificar(
      pf({
        temMei: true,
        inscricaoEstadualAtiva: false,
        atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "60000" }],
      }),
      parametros,
    );
    expect(r.trilhas).toEqual(["D_MEI_REVENDA"]);
    expect(codigos(r)).toContain("CADESP_OBRIGATORIO");
    expect(codigos(r)).toContain("GUARDAR_NOTAS_DE_COMPRA");
  });

  it("T8: em 2027 o MEI registra as vendas a pessoa física", () => {
    const r = classificar(
      pf({
        temMei: true,
        inscricaoEstadualAtiva: true,
        atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "60000" }],
      }),
      parametros,
    );
    expect(codigos(r)).toContain("REGISTRAR_VENDAS_PF");
    expect(codigos(r)).not.toContain("CADESP_OBRIGATORIO");
    expect(r.regrasAplicadas).toContain("R18");
  });

  it("T8b: em 2026 a regra da DASN-SIMEI como documento ainda não vale", () => {
    const r = classificar(
      pf({
        anoCalendario: 2026,
        temMei: true,
        inscricaoEstadualAtiva: true,
        atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "60000" }],
      }),
      parametros,
    );
    expect(codigos(r)).not.toContain("REGISTRAR_VENDAS_PF");
    expect(r.limiteMei).toBe("81000.00");
  });
});

describe("outras situações", () => {
  it("quem só tem emprego está fora do alcance", () => {
    const r = classificar(pf({ vinculo: "somente_empregado", atividades: [] }), parametros);
    expect(r.trilhas).toEqual(["FORA_DO_ALCANCE"]);
  });

  it("MEI com serviço e revenda entra nas duas trilhas", () => {
    const r = classificar(
      pf({
        temMei: true,
        inscricaoEstadualAtiva: true,
        atividades: [
          { tipo: "servico", receitaBrutaAnual: "30000" },
          { tipo: "revenda_mercadoria", receitaBrutaAnual: "40000" },
        ],
      }),
      parametros,
    );
    expect(r.trilhas).toEqual(["C_MEI_SERVICO", "D_MEI_REVENDA"]);
  });

  it("MEI acima do limite vai para atendimento de ME e EPP", () => {
    const r = classificar(
      pf({ temMei: true, atividades: [{ tipo: "servico", receitaBrutaAnual: "110000.01" }] }),
      parametros,
    );
    expect(r.trilhas).toEqual(["E_ME_EPP"]);
    expect(codigos(r)).toContain("MEI_ACIMA_DO_LIMITE");
  });

  it("MEI exatamente no limite continua MEI", () => {
    const r = classificar(
      pf({ temMei: true, atividades: [{ tipo: "servico", receitaBrutaAnual: "110000" }] }),
      parametros,
    );
    expect(r.trilhas).toEqual(["C_MEI_SERVICO"]);
  });

  it("nano que revende em SP sem inscrição recebe os alertas de ICMS", () => {
    const r = classificar(
      pf({ atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "20000" }] }),
      parametros,
    );
    expect(r.trilhas).toEqual(["A_NANO"]);
    expect(codigos(r)).toEqual(
      expect.arrayContaining(["REVENDA_PF_CONTRIBUINTE_ICMS", "REMESSA_VEDADA_SEM_CADESP"]),
    );
  });

  it("revenda fora de SP aparece como lacuna, sem inventar regra", () => {
    const r = classificar(
      pf({ uf: "MG", atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "20000" }] }),
      parametros,
    );
    expect(r.lacunas).toEqual(["ICMS_UF_NAO_COBERTA"]);
    expect(codigos(r)).not.toContain("REMESSA_VEDADA_SEM_CADESP");
  });

  it("quem optou pelo regime regular não é tratado como nano", () => {
    const r = classificar(
      pf({ optouRegimeRegular: true, atividades: [{ tipo: "servico", receitaBrutaAnual: "10000" }] }),
      parametros,
    );
    expect(r.trilhas).toEqual(["B_PF_CONTRIBUINTE"]);
    expect(r.pendencias).not.toContain("R10");
  });

  it("recusa ano sem limite cadastrado em vez de supor", () => {
    expect(() =>
      classificar(
        pf({ anoCalendario: 2028, atividades: [{ tipo: "servico", receitaBrutaAnual: "1" }] }),
        parametros,
      ),
    ).toThrow(ParametroAusente);
  });

  it("recusa perfil inválido", () => {
    expect(() => classificar(pf({ atividades: [] }), parametros)).toThrow(PerfilInvalido);
    expect(() =>
      classificar(pf({ atividades: [{ tipo: "servico", receitaBrutaAnual: "-1" }] }), parametros),
    ).toThrow(PerfilInvalido);
    expect(() =>
      classificar(
        pf({ mesesDeAtividadeNoAno: 13, atividades: [{ tipo: "servico", receitaBrutaAnual: "1" }] }),
        parametros,
      ),
    ).toThrow(PerfilInvalido);
  });
});

describe("propriedades", () => {
  const perfis: Perfil[] = [
    pf({ atividades: [{ tipo: "transporte_passageiros", receitaBrutaAnual: "144000" }] }),
    pf({ atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "70000" }] }),
    pf({ temMei: true, atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "60000" }] }),
    pf({ mesesDeAtividadeNoAno: 3, atividades: [{ tipo: "servico", receitaBrutaAnual: "5000" }] }),
    pf({ vinculo: "somente_empregado", atividades: [] }),
  ];

  it("toda regra citada pelo motor existe na base", () => {
    for (const perfil of perfis) {
      const r = classificar(perfil, parametros);
      const ids = [...r.regrasAplicadas, ...r.pendencias, ...r.alertas.map((a) => a.regra)];
      for (const id of ids) expect(() => buscarRegra(id)).not.toThrow();
    }
  });

  it("toda pendência citada é de fato uma regra incerta na base", () => {
    for (const perfil of perfis) {
      for (const id of classificar(perfil, parametros).pendencias) {
        expect(["PENDENTE", "ANUNCIADO", "A_CONFIRMAR"]).toContain(buscarRegra(id).status);
      }
    }
  });

  it("aumentar a receita nunca transforma quem não é nano em nano", () => {
    for (const receita of ["54999", "55000", "55001", "90000"]) {
      const menor = classificar(
        pf({ atividades: [{ tipo: "servico", receitaBrutaAnual: receita }] }),
        parametros,
      );
      const maior = classificar(
        pf({ atividades: [{ tipo: "servico", receitaBrutaAnual: String(Number(receita) + 1000) }] }),
        parametros,
      );
      if (!menor.trilhas.includes("A_NANO")) expect(maior.trilhas).not.toContain("A_NANO");
    }
  });
});
