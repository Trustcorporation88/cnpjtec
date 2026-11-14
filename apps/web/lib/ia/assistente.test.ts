import { describe, expect, it, vi } from "vitest";
import { conversar, executarFerramenta, iaAtiva, minimizar } from "./assistente";

describe("ferramentas do motor", () => {
  it("diagnostica pelo motor de regras", () => {
    const r = JSON.parse(
      executarFerramenta("diagnosticar", {
        vinculo: "conta_propria",
        temMei: "sim",
        atividades: [{ tipo: "revenda_mercadoria", mediaMensal: "3000" }],
        uf: "SP",
        inscricaoEstadual: "nao",
      }),
    );
    expect(r.titulo).toBeTruthy();
    expect(r.regras.length).toBeGreaterThan(0);
  });

  it("devolve erro legível com dados incompletos", () => {
    const r = JSON.parse(executarFerramenta("diagnosticar", { vinculo: "conta_propria" }));
    expect(r.erro).toBeTruthy();
  });

  it("simula e busca regra", () => {
    const s = JSON.parse(executarFerramenta("simular", { atividades: [{ tipo: "servico", mediaMensal: "2000" }] }));
    expect(s.mei.dasMensal).toMatch(/^\d+\.\d{2}$/);
    expect(JSON.parse(executarFerramenta("buscar_regra", { id: "R14" })).id).toBe("R14");
    expect(JSON.parse(executarFerramenta("buscar_regra", { id: "R99" })).erro).toBeTruthy();
  });
});

describe("minimização", () => {
  it("tira CPF, CNPJ, cartão e e-mail antes de mandar para a API", () => {
    const t = minimizar("cpf 123.456.789-09 cnpj 10.657.629/0001-62 cartao 4111 1111 1111 1111 mail a@b.com");
    expect(t).not.toMatch(/123\.456|10\.657|4111|a@b/);
  });
});

describe("conversar", () => {
  const env = { ANTHROPIC_API_KEY: "k" };
  it("chama a ferramenta e devolve o texto final sem travessão", async () => {
    const respostas = [
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "buscar_regra", input: { id: "R14" } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "O limite é este — veja a regra R14." }] },
    ];
    const buscar = vi.fn(async () => new Response(JSON.stringify(respostas.shift())));
    const texto = await conversar([{ role: "user", content: "qual o limite?" }], { canal: "site", env, buscar: buscar as unknown as typeof fetch });
    expect(texto).toBe("O limite é este, veja a regra R14.");
    const segunda = JSON.parse(String((buscar.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(segunda.messages.at(-1).content[0].type).toBe("tool_result");
    expect(segunda.model).toBe("claude-sonnet-5-5");
  });

  it("fica desligada sem chave", () => {
    expect(iaAtiva({})).toBe(false);
    expect(iaAtiva(env)).toBe(true);
  });
});
