import { describe, expect, it, vi } from "vitest";
import type { ConfiguracaoDaConta } from "./conta/servidor";
import { criarMemoriaDuravel, resumo } from "./memoria-duravel";

const config = { url: "https://banco", chavePublica: "pub", chaveServidor: "srv" } as ConfiguracaoDaConta;

describe("memória durável", () => {
  it("sem banco, guarda no processo com validade, reserva e conta", async () => {
    const m = criarMemoriaDuravel(null);
    await m.gravar("a", { etapa: "menu" }, 60);
    expect(await m.ler("a")).toEqual({ etapa: "menu" });
    await m.gravar("a", undefined, 60);
    expect(await m.ler("a")).toBeUndefined();
    expect(await m.reservar("r", 60)).toBe(true);
    expect(await m.reservar("r", 60)).toBe(false);
    expect(await m.contar("c", 2, 60)).toBe(true);
    expect(await m.contar("c", 2, 60)).toBe(true);
    expect(await m.contar("c", 2, 60)).toBe(false);
  });

  it("com banco, chama as funções srv_ com a chave do servidor", async () => {
    const chamadas: { funcao: string; corpo: Record<string, unknown> }[] = [];
    const buscar = vi.fn(async (url: string, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body));
      chamadas.push({ funcao: url.split("/").at(-1)!, corpo });
      const respostas: Record<string, unknown> = { srv_mem_ler: { etapa: "menu" }, srv_contar: false, srv_mem_reservar: corpo.p_valor };
      return new Response(JSON.stringify(respostas[url.split("/").at(-1)!] ?? null), { status: 200 });
    });
    const m = criarMemoriaDuravel(config, buscar as unknown as typeof fetch);
    expect(await m.ler("x")).toEqual({ etapa: "menu" });
    expect(await m.contar("y", 3, 60)).toBe(false);
    expect(await m.reservar("z", 60)).toBe(true);
    await m.gravar("w", undefined, 60);
    expect(chamadas.map((c) => c.funcao)).toEqual(["srv_mem_ler", "srv_contar", "srv_mem_reservar", "srv_mem_gravar"]);
    expect(chamadas.every((c) => c.corpo.p_chave === "srv")).toBe(true);
    expect(chamadas[3]!.corpo.p_valor).toBeNull();
  });

  it("se o banco falhar, segue com a memória do processo", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const buscar = vi.fn(async () => new Response("erro", { status: 500 }));
    const m = criarMemoriaDuravel(config, buscar as unknown as typeof fetch);
    await m.gravar("a", 1, 60);
    expect(await m.ler("a")).toBe(1);
    expect(await m.reservar("b", 60)).toBe(true);
    erro.mockRestore();
  });

  it("resume identificadores sem guardar o número", () => {
    expect(resumo("5514998370223@s.whatsapp.net")).toMatch(/^[0-9a-f]{32}$/);
    expect(resumo("5514998370223@s.whatsapp.net")).not.toContain("5514");
  });
});
