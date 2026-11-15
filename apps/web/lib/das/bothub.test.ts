import { beforeEach, describe, expect, it, vi } from "vitest";
import { configuracaoBothub, guiasDoExtrato, lerExtrato, lerPedido, pedirAoRobo, zerarMemoria } from "./bothub";
import { configuracaoDas, consultarExtrato } from "./procontador";

const env = { BOTHUB_TOKEN: "tok", BOTHUB_AUTOMACAO_DAS_MEI_ID: "auto-1" };
const config = configuracaoBothub(env)!;
const AGORA = new Date("2026-11-15T02:30:00Z"); // dia 14 em São Paulo

beforeEach(() => zerarMemoria());

describe("pedido ao robô", () => {
  it("manda CNPJ formatado e ano, e não repete no mesmo dia", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify({ id: 987 })));
    const a = await pedirAoRobo(config, "11222333000181", 2026, buscar as unknown as typeof fetch, AGORA);
    const b = await pedirAoRobo(config, "11222333000181", 2026, buscar as unknown as typeof fetch, AGORA);
    expect(a).toEqual({ pedido: "bh:987:11222333000181:2026", repetido: false });
    expect(b.repetido).toBe(true);
    expect(buscar).toHaveBeenCalledTimes(1);
    const corpo = JSON.parse(String((buscar.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corpo).toMatchObject({
      automation_id: "auto-1",
      automation_data: { ANO: "2026", CNPJ_FORMATADO: "11.222.333/0001-81" },
      automation_id_externo: "cnpjtec:das-mei:11222333000181:2026:2026-11-14",
    });
  });

  it("respeita o teto do dia", async () => {
    const c = configuracaoBothub({ ...env, BOTHUB_LIMITE_DIARIO: "1" })!;
    const buscar = vi.fn(async () => new Response(JSON.stringify({ id: 1 })));
    await pedirAoRobo(c, "11222333000181", 2026, buscar as unknown as typeof fetch, AGORA);
    await expect(pedirAoRobo(c, "11444777000161", 2026, buscar as unknown as typeof fetch, AGORA)).rejects.toMatchObject({ status: 429 });
  });

  it("lê o pedido e recusa formato estranho", () => {
    expect(lerPedido("bh:987:11222333000181:2026")).toEqual({ jobId: "987", cnpj: "11222333000181", ano: 2026 });
    expect(lerPedido("bh:../x:1:2")).toBeNull();
  });
});

describe("extrato", () => {
  const resposta = {
    structure: "STRUCTURE_OK",
    erro: "null",
    contador: 3,
    situacao: "Optante",
    dividaAtiva: "NAO",
    situacao_0: "Liquidado", data_vencimento_0: "20/02/2026", total_0: "81,05", data_acolhimento_0: "18/02/2026",
    situacao_1: "-", data_vencimento_1: "20/03/2026", total_1: "81,05",
    situacao_2: "Não Optante", data_vencimento_2: "-", total_2: "-",
  };

  it("lê como o SaaS e monta as guias", () => {
    const e = lerExtrato(resposta);
    expect(e.confiavel).toBe(true);
    expect(e.meses[2]!.situacao).toBe("NAO_OPTANTE");
    const g = guiasDoExtrato(e, 2026, AGORA);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ mes: 1, situacao: "PAGO", valorTotal: 81.05, dataPagamento: "2026-02-18" });
    expect(g[1]).toMatchObject({ mes: 2, situacao: "VENCIDO", vencimento: "2026-03-20" });
  });

  it("consulta pelo robô quando o BotHub está configurado", async () => {
    const das = configuracaoDas(env)!;
    expect(das.bothub).toBeTruthy();
    const buscar = vi.fn(async () => new Response(JSON.stringify({ status: "FINISHED", payload: { response: resposta } })));
    const c = await consultarExtrato(das, "bh:987:11222333000181:2026", buscar as unknown as typeof fetch);
    expect(c.pronto).toBe(true);
    if (c.pronto) expect(c.guias).toHaveLength(2);
  });

  it("não confia em extrato com layout desconhecido", async () => {
    const das = configuracaoDas(env)!;
    const buscar = vi.fn(async () => new Response(JSON.stringify({ status: "FINISHED", payload: { response: { ...resposta, structure: "X" } } })));
    const c = await consultarExtrato(das, "bh:987:11222333000181:2026", buscar as unknown as typeof fetch);
    expect(c).toMatchObject({ pronto: true, extrato: null });
  });
});
