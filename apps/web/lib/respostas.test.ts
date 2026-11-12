import { describe, expect, it } from "vitest";
import { lerValor, mostrarValor } from "./dinheiro";
import { diagnosticar, Respostas } from "./respostas";

describe("leitura de valor digitado", () => {
  it.each([
    ["1200", "1200"],
    ["1.200", "1200"],
    ["1.200,5", "1200.50"],
    ["R$ 12.000,00", "12000.00"],
    ["0800", "800"],
    ["0", "0"],
  ])("%s vira %s", (digitado, esperado) => {
    expect(lerValor(digitado)).toBe(esperado);
  });

  it.each(["", "abc", "1,2,3", "12.00.000", "-5", "1200.5"])("recusa %s", (digitado) => {
    expect(lerValor(digitado)).toBeNull();
  });

  it("mostra em formato brasileiro", () => {
    expect(mostrarValor("55000.00")).toBe("R$ 55.000,00");
  });
});

describe("diagnóstico a partir das respostas", () => {
  it("motorista de R$ 12 mil por mês é nano em 2027", () => {
    const r = diagnosticar(
      Respostas.parse({
        vinculo: "conta_propria",
        temMei: "nao",
        atividades: [{ tipo: "transporte_passageiros", mediaMensal: "12000" }],
        uf: "SP",
      }),
    );
    expect(r.ano).toBe(2027);
    expect(r.diagnostico.trilhas).toEqual(["A_NANO"]);
    expect(r.diagnostico.numeros.receitaBrutaTotal).toBe("144000.00");
    expect(r.diagnostico.numeros.receitaComputadaNano).toBe("36000.00");
  });

  it("quem não sabe se tem MEI recebe o aviso", () => {
    const r = diagnosticar(
      Respostas.parse({
        vinculo: "conta_propria",
        temMei: "nao_sei",
        atividades: [{ tipo: "servico", mediaMensal: "2000" }],
      }),
    );
    expect(r.observacoes.join(" ")).toMatch(/não soube dizer se tem MEI/);
  });

  it("MEI revendedor que não sabe da inscrição recebe a tarefa de descobrir", () => {
    const r = diagnosticar(
      Respostas.parse({
        vinculo: "conta_propria",
        temMei: "sim",
        atividades: [{ tipo: "revenda_mercadoria", mediaMensal: "4000" }],
        uf: "SP",
        inscricaoEstadual: "nao_sei",
      }),
    );
    expect(r.diagnostico.trilhas).toEqual(["D_MEI_REVENDA"]);
    expect(r.diagnostico.fazerAgora.map((f) => f.texto).join(" ")).toMatch(/Descubra se o seu MEI/);
  });

  it("recusa respostas fora do formato", () => {
    expect(Respostas.safeParse({ vinculo: "conta_propria", atividades: [] }).success).toBe(false);
    expect(
      Respostas.safeParse({
        vinculo: "conta_propria",
        atividades: [
          { tipo: "servico", mediaMensal: "1" },
          { tipo: "servico", mediaMensal: "2" },
        ],
      }).success,
    ).toBe(false);
    expect(
      Respostas.safeParse({
        vinculo: "conta_propria",
        atividades: [{ tipo: "servico", mediaMensal: "1,50" }],
      }).success,
    ).toBe(false);
    expect(Respostas.safeParse({ vinculo: "somente_empregado", senha: "x" }).success).toBe(false);
  });
});
