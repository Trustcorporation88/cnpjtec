import { describe, expect, it } from "vitest";
import { ferramentas, modeloPara } from "./index";

describe("contrato das ferramentas", () => {
  it("não repete nome", () => {
    const nomes = ferramentas.map((f) => f.name);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("usa nomes aceitos pela API", () => {
    for (const f of ferramentas) expect(f.name).toMatch(/^[a-z_]{1,64}$/);
  });

  it("toda ferramenta de efeito oficial exige confirmação", () => {
    for (const f of ferramentas) {
      if (f.efeito === "oficial") expect(f.exigeConfirmacao).toBe(true);
    }
  });

  it("gerar DAS, transmitir DASN e emitir NFS-e são de efeito oficial", () => {
    const oficiais = ferramentas.filter((f) => f.efeito === "oficial").map((f) => f.name);
    expect(oficiais.sort()).toEqual(["emitir_nfse", "gerar_das", "transmitir_dasn"]);
  });

  it("todo esquema é estrito e só exige campos que existem", () => {
    for (const f of ferramentas) {
      expect(f.input_schema.additionalProperties).toBe(false);
      for (const campo of f.input_schema.required) {
        expect(Object.keys(f.input_schema.properties)).toContain(campo);
      }
    }
  });

  it("nenhuma ferramenta recebe senha ou valor de tributo calculado fora do motor", () => {
    for (const f of ferramentas) {
      for (const campo of Object.keys(f.input_schema.properties)) {
        expect(campo.toLowerCase()).not.toMatch(/senha|password|imposto|tributo|aliquota/);
      }
    }
  });
});

describe("roteamento de modelos", () => {
  it("usa o padrão quando não há variável", () => {
    expect(modeloPara("conversa")).toBe("claude-sonnet-5-5");
  });

  it("respeita a variável de ambiente", () => {
    expect(modeloPara("conversa", { MODELO_CONVERSA: " outro-modelo " })).toBe("outro-modelo");
  });
});
