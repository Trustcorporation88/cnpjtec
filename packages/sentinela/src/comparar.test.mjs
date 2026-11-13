import { describe, expect, it } from "vitest";
import fontes from "./fontes.json";
import { comparar, normalizar, resumo, textoDoAviso } from "./comparar.mjs";
import { buscarRegra } from "@cnpjtec/regras";

describe("normalização", () => {
  it("ignora script, estilo e espaços", () => {
    const a = "<body><script>var t=1</script><p>Art. 1º  Texto</p></body>";
    const b = "<body><script>var t=2</script>\n<p>Art. 1º Texto</p><style>x{}</style></body>";
    expect(normalizar(a)).toBe("Art. 1º Texto");
    expect(resumo(normalizar(a))).toBe(resumo(normalizar(b)));
  });

  it("prefere o conteúdo principal quando existe", () => {
    expect(normalizar("<body><nav>menu</nav><main><p>norma</p></main></body>")).toBe("norma");
  });
});

describe("comparação", () => {
  const f = [{ id: "x", nome: "X", url: "https://x", regras: ["R01"] }];
  it("aponta mudança, queda e volta, e nada quando igual", () => {
    expect(comparar(f, { x: { estado: "ok", resumo: "a" } }, { x: { estado: "ok", resumo: "a" } })).toEqual([]);
    expect(comparar(f, { x: { estado: "ok", resumo: "a" } }, { x: { estado: "ok", resumo: "b" } })[0]?.tipo).toBe("mudou");
    expect(comparar(f, { x: { estado: "ok", resumo: "a" } }, { x: { estado: "erro", detalhe: "403" } })[0]?.tipo).toBe("parou");
    expect(comparar(f, { x: { estado: "erro", detalhe: "403" } }, { x: { estado: "ok", resumo: "a" } })[0]?.tipo).toBe("voltou");
    expect(comparar(f, { x: { estado: "erro", detalhe: "403" } }, { x: { estado: "erro", detalhe: "403" } })).toEqual([]);
  });

  it("primeira leitura não gera aviso", () => {
    expect(comparar(f, {}, { x: { estado: "ok", resumo: "a" } })).toEqual([]);
  });

  it("o aviso diz que a sentinela não altera regra", () => {
    expect(textoDoAviso({ id: "x", nome: "X", url: "https://x", regras: ["R01"], tipo: "mudou" })).toMatch(/nunca altera regra sozinha/);
  });
});

describe("lista de fontes", () => {
  it("toda regra monitorada existe e não há fonte repetida", () => {
    const ids = fontes.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of fontes) {
      expect(x.url).toMatch(/^https:\/\//);
      for (const r of x.regras) expect(() => buscarRegra(r)).not.toThrow();
    }
  });
});
