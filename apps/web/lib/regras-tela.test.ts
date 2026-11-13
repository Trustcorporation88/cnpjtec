import { describe, expect, it } from "vitest";
import { citar, dataDaRegra } from "./regras-tela";

describe("regras na tela", () => {
  it("as datas das páginas vêm da vigência cadastrada", () => {
    expect(dataDaRegra("R11", "inicio")).toBe("1/1/2027");
    expect(dataDaRegra("R07", "fim")).toBe("31/12/2028");
  });

  it("recusa pedir data que a regra não tem", () => {
    expect(() => dataDaRegra("R13", "inicio")).toThrow();
  });

  it("marca como em conferência o que não veio de fonte oficial", () => {
    const regras = citar(["R32", "R11", "R11"]);
    expect(regras.map((r) => r.id)).toEqual(["R11", "R32"]);
    expect(regras.find((r) => r.id === "R32")?.emRevisao).toBe(true);
    expect(regras.find((r) => r.id === "R11")?.emRevisao).toBe(false);
  });

  it("recusa citar regra que não existe", () => {
    expect(() => citar(["R99"])).toThrow();
  });
});
