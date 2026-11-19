import { describe, expect, it } from "vitest";
import { pedidoDeCodigos, textoDosCodigos } from "./codigos";
import { responder } from "./conversa";
import { executarFerramenta } from "../ia/assistente";

describe("códigos da nota pelo WhatsApp", () => {
  it("entende os jeitos de pedir", () => {
    expect(pedidoDeCodigos("Código manicure")).toBe("manicure");
    expect(pedidoDeCodigos("códigos da nota de serviço para faxina")).toBe("faxina");
    expect(pedidoDeCodigos("nbs 6.01")).toBe("6.01");
    expect(pedidoDeCodigos("qual o código do meu MEI?")).toBeNull();
    expect(pedidoDeCodigos("código")).toBeNull();
  });

  it("responde com os códigos da tabela oficial, sem travessão", () => {
    const t = textoDosCodigos("manicure", "https://site");
    expect(t).toContain("Código de tributação nacional: 6.01");
    expect(t).toContain("NBS: 126022000");
    expect(t).toContain("cClassTrib 000001");
    expect(t).toContain("https://site/nota-de-servico");
    expect(t).not.toContain("—");
  });

  it("não inventa quando não acha", () => {
    expect(textoDosCodigos("xyzqwv", "https://site")).toContain("Não achei");
  });

  it("aparece no menu como opção 5", () => {
    const r = responder({ etapa: "menu", atividades: [] }, "5");
    expect(r.mensagens.join("\n")).toContain("código manicure");
  });

  it("a assistente busca os códigos pela ferramenta", () => {
    const r = JSON.parse(executarFerramenta("codigos_da_nota", { servico: "faxina" }));
    expect(r.resultados[0].nbs.codigo).toBe("118031000");
    expect(r.fonte).toMatch(/Receita/);
  });
});
