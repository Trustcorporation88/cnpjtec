import { baseDeRegras, buscarRegra } from "@cnpjtec/regras";
import { describe, expect, it } from "vitest";
import { anoDaDeclaracao, ParametroAusente, PerfilInvalido, prepararDeclaracao, type Venda } from "./index";

const parametros = baseDeRegras.parametros;
const v = (data: string, valor: string, tipo: Venda["tipo"] = "mercadoria", compradorTemCnpj = false): Venda => ({
  data,
  valor,
  tipo,
  compradorTemCnpj,
});
const todoMes = (ano: number, valor: string, tipo: Venda["tipo"] = "mercadoria") =>
  Array.from({ length: 12 }, (_, i) => v(`${ano}-${String(i + 1).padStart(2, "0")}-10`, valor, tipo));

describe("declaração anual do MEI", () => {
  it("separa comércio e serviços e soma o total", () => {
    const d = prepararDeclaracao(
      {
        vendas: [...todoMes(2026, "1000"), v("2026-03-02", "250.50", "servico"), v("2026-04-01", "300", "mercadoria", true)],
        anoCalendario: 2026,
        hoje: "2027-02-10",
      },
      parametros,
    );
    expect(d).toMatchObject({
      receitaComercio: "12300.00",
      receitaServicos: "250.50",
      receitaTotal: "12550.50",
      quantidadeDeVendas: 14,
      vendasParaEmpresa: 1,
      mesesSemAnotacao: [],
      prazo: "2027-05-31",
      situacao: "no_prazo",
      faixa: "dentro",
      excedente: "0.00",
    });
    expect(d.regrasAplicadas).toEqual(["R33", "R14"]);
  });

  it("ano sem venda declara zero", () => {
    const d = prepararDeclaracao({ vendas: [], anoCalendario: 2026, hoje: "2027-01-05" }, parametros);
    expect(d.receitaTotal).toBe("0.00");
    expect(d.mesesSemAnotacao).toHaveLength(12);
  });

  it("aponta os meses fechados sem venda anotada, sem contar o mês aberto", () => {
    const d = prepararDeclaracao(
      { vendas: [v("2026-01-05", "10"), v("2026-03-05", "10"), v("2026-11-02", "10")], anoCalendario: 2026, hoje: "2026-11-16" },
      parametros,
    );
    expect(d.situacao).toBe("ano_em_curso");
    expect(d.mesesSemAnotacao).toEqual([2, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("conta só a partir do mês de abertura, com limite proporcional", () => {
    const d = prepararDeclaracao(
      { vendas: [v("2026-07-10", "100")], anoCalendario: 2026, hoje: "2027-01-10", mesInicio: 7 },
      parametros,
    );
    expect(d.limite).toBe("40500.00");
    expect(d.mesesSemAnotacao).toEqual([8, 9, 10, 11, 12]);
  });

  it("excesso de até 20% ainda se declara, com R38", () => {
    const d = prepararDeclaracao({ vendas: todoMes(2026, "7500"), anoCalendario: 2026, hoje: "2027-01-10" }, parametros);
    expect(d).toMatchObject({ receitaTotal: "90000.00", faixa: "excesso_ate_20", excedente: "9000.00" });
    expect(d.regrasAplicadas).toContain("R38");
  });

  it("exatamente 20% acima ainda é a faixa de até 20%", () => {
    const d = prepararDeclaracao({ vendas: todoMes(2026, "8100"), anoCalendario: 2026, hoje: "2027-01-10" }, parametros);
    expect(d).toMatchObject({ receitaTotal: "97200.00", faixa: "excesso_ate_20" });
  });

  it("acima de 20% vai para o contador", () => {
    const d = prepararDeclaracao({ vendas: todoMes(2026, "8100.01"), anoCalendario: 2026, hoje: "2027-01-10" }, parametros);
    expect(d.faixa).toBe("excesso_acima_20");
  });

  it("passou de 31 de maio está atrasada, com R39", () => {
    const d = prepararDeclaracao({ vendas: [v("2026-01-05", "10")], anoCalendario: 2026, hoje: "2027-06-01" }, parametros);
    expect(d.situacao).toBe("atrasada");
    expect(d.regrasAplicadas).toContain("R39");
    expect(prepararDeclaracao({ vendas: [], anoCalendario: 2026, hoje: "2027-05-31" }, parametros).situacao).toBe("no_prazo");
  });

  it("recusa ano futuro, ano sem limite e mês de início inválido", () => {
    expect(() => prepararDeclaracao({ vendas: [], anoCalendario: 2027, hoje: "2026-11-16" }, parametros)).toThrow(PerfilInvalido);
    expect(() => prepararDeclaracao({ vendas: [], anoCalendario: 2025, hoje: "2026-01-10" }, parametros)).toThrow(ParametroAusente);
    expect(() =>
      prepararDeclaracao({ vendas: [], anoCalendario: 2026, hoje: "2027-01-10", mesInicio: 13 }, parametros),
    ).toThrow(PerfilInvalido);
  });

  it("escolhe o ano anterior até maio e o ano corrente depois", () => {
    expect(anoDaDeclaracao("2027-05-31")).toBe(2026);
    expect(anoDaDeclaracao("2027-06-01")).toBe(2027);
  });

  it("as regras citadas existem e estão conferidas na fonte oficial", () => {
    for (const id of ["R33", "R38", "R39"]) expect(buscarRegra(id).conferencia).toBe("OFICIAL");
  });
});
