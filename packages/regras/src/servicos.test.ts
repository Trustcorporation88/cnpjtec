import { describe, expect, it } from "vitest";
import { buscarServicos, normalizar, tabelaDeServicos } from "./servicos";

describe("tabela oficial de serviços da NFS-e", () => {
  it("carrega a tabela da calculadora oficial com versão e data de referência", () => {
    expect(tabelaDeServicos.itens.length).toBeGreaterThan(150);
    expect(tabelaDeServicos.versaoBase.versao).toMatch(/^V\d{4}$/);
    expect(tabelaDeServicos.dataReferencia).toBe("2027-01-01");
  });

  it("acha manicure pelo que a pessoa faz, com os códigos completos", () => {
    const [primeiro] = buscarServicos("faço unhas, sou manicure");
    expect(primeiro!.item.codigo).toBe("6.01");
    expect(primeiro!.nbs.codigo).toBe("126022000");
    expect(primeiro!.operacoes.map((o) => o.cIndOp)).toContain("030101");
    expect(primeiro!.tributacao[0]).toMatchObject({ cst: "000", cClassTrib: "000001" });
  });

  it("acha pelo item da LC 116 e pela NBS", () => {
    expect(buscarServicos("6.01").every((r) => r.item.codigo === "6.01")).toBe(true);
    expect(buscarServicos("126021000")[0]!.nbs.descricao).toMatch(/cabeleireiros/i);
  });

  it("entende acento e plural", () => {
    expect(normalizar("Serviços de Informática")).toBe("servicos de informatica");
    expect(buscarServicos("cabeleireiras").some((r) => r.nbs.codigo === "126021000")).toBe(true);
  });

  it("entende palavras do dia a dia pelos sinônimos, sem inventar código", () => {
    expect(buscarServicos("faxina")[0]!.nbs.codigo).toBe("118031000");
    expect(buscarServicos("conserto de celular")[0]!.nbs.descricao).toMatch(/eletroeletr/i);
    expect(buscarServicos("pedreiro")[0]!.item.codigo).toMatch(/^7\./);
  });

  it("não inventa resultado para consulta sem sentido", () => {
    expect(buscarServicos("xyzqwv")).toEqual([]);
    expect(buscarServicos("de para com")).toEqual([]);
  });
});

describe("sincronia com os serviços oficiais", () => {
  it("a tabela foi gerada do mesmo commit que o serviço do regime regular usa", async () => {
    if (tabelaDeServicos.commit.startsWith("pacote oficial")) return; // imagem e tabela saem do mesmo pacote no workflow base-rtc
    const { readFileSync } = await import("node:fs");
    const dockerfile = readFileSync(new URL("../../../servicos/calculadora-rtc/Dockerfile.regime-regular", import.meta.url), "utf8");
    expect(dockerfile).toContain(`COMMIT_REGULAR=${tabelaDeServicos.commit}`);
  });
});
