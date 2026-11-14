import { describe, expect, it } from "vitest";
import { responder, type Estado } from "./conversa";

function conversar(falas: string[]): { estado: Estado | undefined; ultima: string } {
  let estado: Estado | undefined;
  let ultima = "";
  for (const fala of falas) {
    const r = responder(estado, fala);
    estado = r.estado;
    ultima = r.mensagens.join("\n---\n");
  }
  return { estado, ultima };
}

describe("conversa do WhatsApp", () => {
  it("abre o menu na primeira mensagem", () => {
    const r = responder(undefined, "Oi!");
    expect(r.estado?.etapa).toBe("menu");
    expect(r.mensagens[0]).toContain("1. Fazer o Raio-X");
  });

  it("volta ao menu com 0 em qualquer etapa", () => {
    const { estado } = conversar(["oi", "1", "1", "0"]);
    expect(estado?.etapa).toBe("menu");
  });

  it("quem só tem emprego recebe o resultado direto", () => {
    const { estado, ultima } = conversar(["oi", "1", "2"]);
    expect(estado?.etapa).toBe("menu");
    expect(ultima).toContain("Veja o resultado completo");
  });

  it("motorista com ganho baixo passa pelo fluxo inteiro", () => {
    const { ultima } = conversar(["oi", "1", "1", "2", "1", "1.500,00", "2", "sp"]);
    expect(ultima).toContain("por ano");
    expect(ultima).not.toContain("—");
  });

  it("revendedora em SP responde a pergunta da inscrição estadual", () => {
    const { estado, ultima } = conversar(["oi", "1", "1", "1", "4", "3000", "2", "SP"]);
    expect(estado?.etapa).toBe("ie");
    expect(ultima).toContain("CADESP");
    const fim = responder(estado, "2");
    expect(fim.estado?.etapa).toBe("menu");
  });

  it("não deixa repetir a mesma atividade", () => {
    const { estado, ultima } = conversar(["oi", "1", "1", "2", "1", "1000", "1"]);
    expect(estado?.etapa).toBe("atividade");
    expect(ultima).not.toContain("Levo passageiros");
  });

  it("pede de novo quando o valor é inválido", () => {
    const { estado, ultima } = conversar(["oi", "1", "1", "2", "1", "muito"]);
    expect(estado?.etapa).toBe("valor");
    expect(ultima).toContain("Não consegui ler");
  });

  it("explica a guia do MEI sem pedir senha", () => {
    const { ultima } = conversar(["oi", "2"]);
    expect(ultima).toContain("pgmei.app");
    expect(ultima).toContain("Nunca passe a senha");
  });

  it("nenhuma mensagem usa travessão", () => {
    const falas = [["oi"], ["oi", "2"], ["oi", "3"], ["oi", "1", "1", "1", "4", "3000", "1", "3", "800", "2", "SP", "1"]];
    for (const f of falas) expect(conversar(f).ultima).not.toMatch(/[—–]/);
  });
});

describe("entrada e saída", () => {
  it("procontador abre o menu e sair encerra", () => {
    const entrou = responder(undefined, "ProContador");
    expect(entrou.estado?.etapa).toBe("menu");
    const saiu = responder(entrou.estado, "sair");
    expect(saiu.estado).toBeUndefined();
    expect(saiu.mensagens[0]).toContain("procontador");
  });
});
