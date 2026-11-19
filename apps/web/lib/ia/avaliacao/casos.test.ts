import { baseDeRegras } from "@cnpjtec/regras";
import { describe, expect, it } from "vitest";
import { FERRAMENTAS } from "../assistente";
import { CASOS } from "./casos";
import { conferir } from "./conferir";

describe("bateria da assistente", () => {
  it("tem 50 casos com ids únicos, regras e ferramentas que existem", () => {
    expect(CASOS).toHaveLength(50);
    expect(new Set(CASOS.map((c) => c.id)).size).toBe(50);
    const regras = new Set(baseDeRegras.regras.map((r) => r.id));
    const ferramentas = new Set(FERRAMENTAS.map((f) => f.name as string));
    for (const c of CASOS) {
      for (const r of c.regrasUmaDe ?? []) expect(regras.has(r), `${c.id}: ${r}`).toBe(true);
      for (const f of c.ferramentasUmaDe ?? []) expect(ferramentas.has(f), `${c.id}: ${f}`).toBe(true);
    }
  });

  it("o conferidor pega os erros que importam", () => {
    const caso = CASOS.find((c) => c.id === "codigo-manicure")!;
    expect(conferir(caso, "Use o item 6.01 e a NBS 126022000, cClassTrib 000001 (regra R12).", ["codigos_da_nota"])).toEqual([]);
    const ruim = conferir(caso, "Use o cClassTrib 999999 e a NBS 123456789 — veja a regra R99.", []);
    expect(ruim).toEqual(
      expect.arrayContaining([
        "usou travessão",
        "citou regra inexistente R99",
        "código de 6 dígitos fora da tabela oficial: 999999",
        "NBS fora da tabela oficial: 123456789",
        "não usou nenhuma de: codigos_da_nota",
      ]),
    );
  });
});

describe("conferência de senha", () => {
  it("não confunde 'não me mande a senha' com pedido de senha", async () => {
    const { conferir } = await import("./conferir");
    const { CASOS } = await import("./casos");
    const caso = CASOS.find((c) => c.id === "senha")!;
    expect(conferir(caso, "Não me mande a senha do gov.br. Ela é só sua.", [])).toEqual([]);
    expect(conferir(caso, "Me mande a sua senha do gov.br que eu consulto.", [])).toContain("pediu senha");
  });
});
