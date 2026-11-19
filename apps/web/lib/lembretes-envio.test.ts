import { describe, expect, it, vi } from "vitest";
import { destinoDoTelefone, dispararLembretes } from "./lembretes-envio";
import type { ConfiguracaoDaConta } from "./conta/servidor";

const conta = { url: "https://banco", chavePublica: "pub", chaveServidor: "srv" } as ConfiguracaoDaConta;
const evolution = { url: "https://evo", chave: "k", instancia: "Trustcorp" } as never;

function falso(opcoes: { jaEnviado?: boolean; falharEnvio?: boolean } = {}) {
  const chamadas: string[] = [];
  const buscar = vi.fn(async (url: string, init: RequestInit) => {
    const nome = url.split("/").at(-1)!;
    chamadas.push(nome);
    if (nome === "srv_lembretes_assinantes") {
      return Response.json([{ telefone: "+5514998370223", das: true, declaracao: false, limite: false, vendas: [] }]);
    }
    if (nome === "srv_lembrete_marcar") return Response.json(!opcoes.jaEnviado);
    if (nome === "srv_lembrete_desmarcar") return Response.json(null);
    if (url.includes("/message/sendText/")) {
      expect(JSON.parse(String(init.body)).number).toBe("5514998370223");
      return new Response("{}", { status: opcoes.falharEnvio ? 500 : 201 });
    }
    return new Response("?", { status: 404 });
  });
  return { buscar: buscar as unknown as typeof fetch, chamadas };
}

describe("disparo dos lembretes", () => {
  it("marca, envia e conta", async () => {
    const { buscar, chamadas } = falso();
    const r = await dispararLembretes(conta, evolution, "2026-11-16", "https://site", { buscar });
    expect(r).toEqual({ assinantes: 1, enviados: 1, repetidos: 0, falhas: 0 });
    expect(chamadas).toEqual(["srv_lembretes_assinantes", "srv_lembrete_marcar", "Trustcorp"]);
  });

  it("não repete o que já saiu", async () => {
    const { buscar } = falso({ jaEnviado: true });
    expect((await dispararLembretes(conta, evolution, "2026-11-16", "x", { buscar })).repetidos).toBe(1);
  });

  it("desmarca quando o envio falha, para tentar amanhã", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { buscar, chamadas } = falso({ falharEnvio: true });
    const r = await dispararLembretes(conta, evolution, "2026-11-16", "x", { buscar });
    expect(r.falhas).toBe(1);
    expect(chamadas).toContain("srv_lembrete_desmarcar");
    erro.mockRestore();
  });

  it("formata o número para a Evolution", () => {
    expect(destinoDoTelefone("+5514998370223")).toBe("5514998370223");
  });
});
