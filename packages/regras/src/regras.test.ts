import { describe, expect, it } from "vitest";
import { baseDeRegras, buscarRegra, regrasIncertas } from "./index";

describe("base de regras", () => {
  it("carrega dentro do esquema", () => {
    expect(baseDeRegras.regras.length).toBeGreaterThan(0);
  });

  it("não tem identificador repetido", () => {
    const ids = baseDeRegras.regras.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo parâmetro aponta para uma regra existente", () => {
    const { limiteMeiAnual, fracaoLimiteNano, fracaoReceitaTransporteEntrega } =
      baseDeRegras.parametros;
    const referencias = [
      ...Object.values(limiteMeiAnual).map((p) => p.regra),
      fracaoLimiteNano.regra,
      fracaoReceitaTransporteEntrega.regra,
    ];
    for (const id of referencias) expect(() => buscarRegra(id)).not.toThrow();
  });

  it("nenhum parâmetro numérico se apoia em regra pendente", () => {
    const incertas = new Set(regrasIncertas().map((r) => r.id));
    const { limiteMeiAnual, fracaoLimiteNano, fracaoReceitaTransporteEntrega } =
      baseDeRegras.parametros;
    const referencias = [
      ...Object.values(limiteMeiAnual).map((p) => p.regra),
      fracaoLimiteNano.regra,
      fracaoReceitaTransporteEntrega.regra,
    ];
    for (const id of referencias) expect(incertas.has(id)).toBe(false);
  });

  it("regra sem norma nunca aparece como em vigor", () => {
    for (const r of baseDeRegras.regras) {
      if (r.conferencia === "SEM_NORMA") expect(r.status).toBe("PENDENTE");
    }
  });

  it("recusa identificador que não existe", () => {
    expect(() => buscarRegra("R99")).toThrow();
  });
});
