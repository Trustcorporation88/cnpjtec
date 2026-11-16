import type { Venda } from "@cnpjtec/motor-regras";
import { describe, expect, it } from "vitest";
import { telefoneDaConta } from "../conta/whatsapp";
import { comandoDoCaderno, tratarCaderno, tratarNotaRecebida, type DepsCaderno } from "./caderno";
import { ehPerguntaLivre } from "./conversa";
import { lerEvento } from "./evolution";

const TEL = "+5514998370223";

function depsFalsas(inicial: { conta?: boolean; vendas?: Venda[] } = {}) {
  const estado = { conta: inicial.conta ?? false, vendas: [...(inicial.vendas ?? [])], notas: 0 };
  let n = 0;
  const deps: DepsCaderno = {
    temConta: async () => estado.conta,
    criarConta: async () => {
      estado.conta = true;
    },
    incluirVenda: async (_t, v) => {
      estado.vendas.push(v);
    },
    vendas: async () => estado.vendas,
    desfazer: async () => {
      const v = estado.vendas.pop();
      return v ? { data: v.data, valor: v.valor, tipo: v.tipo } : null;
    },
    guardarNota: async () => {
      estado.notas++;
      return { emitente: "Natura", numero: "123", valor: "250.00" };
    },
    agora: () => new Date("2026-11-16T15:00:00Z"),
    site: "https://site",
    consentimento: "Posso criar a conta?",
    novoId: () => `v${++n}`,
  };
  return { deps, estado };
}

describe("comandos", () => {
  it("entende venda, serviço, empresa e resumo", () => {
    const v = comandoDoCaderno("vendi 150");
    expect(v).toMatchObject({ tipo: "venda", tipoDeVenda: "mercadoria", compradorTemCnpj: false });
    expect(Number((v as { valor: string }).valor)).toBe(150);
    const p = comandoDoCaderno("Vendi R$ 1.234,50 de perfume");
    expect(Number((p as { valor: string }).valor)).toBe(1234.5);
    expect(p).toMatchObject({ descricao: "perfume" });
    expect(comandoDoCaderno("vendi 80 serviço de unha")).toMatchObject({ tipoDeVenda: "servico" });
    expect(comandoDoCaderno("vendi 300 para empresa")).toMatchObject({ compradorTemCnpj: true });
    expect(comandoDoCaderno("minhas vendas")).toEqual({ tipo: "resumo" });
    expect(comandoDoCaderno("desfazer")).toEqual({ tipo: "desfazer" });
    expect(comandoDoCaderno("vendi muito hoje")).toBeNull();
    expect(comandoDoCaderno("quanto custa o MEI?")).toBeNull();
  });

  it("venda não vira pergunta para a assistente", () => {
    expect(ehPerguntaLivre({ etapa: "menu", atividades: [] }, "vendi 150 de perfume")).toBe(false);
  });
});

describe("primeira venda pede consentimento", () => {
  it("só guarda depois do sim", async () => {
    const { deps, estado } = depsFalsas();
    const r1 = await tratarCaderno(undefined, "vendi 150", TEL, deps);
    expect(r1?.estado.etapa).toBe("consentir_conta");
    expect(estado.vendas).toHaveLength(0);
    const r2 = await tratarCaderno(r1!.estado, "1", TEL, deps);
    expect(estado.conta).toBe(true);
    expect(estado.vendas).toHaveLength(1);
    expect(r2!.mensagens.join("\n")).toContain("Anotado: R$ 150,00");
    expect(r2!.mensagens.join("\n")).toContain("regra R14");
  });

  it("não guarda quando a pessoa diz não", async () => {
    const { deps, estado } = depsFalsas();
    const r1 = await tratarCaderno(undefined, "vendi 150", TEL, deps);
    await tratarCaderno(r1!.estado, "2", TEL, deps);
    expect(estado.conta).toBe(false);
    expect(estado.vendas).toHaveLength(0);
  });
});

describe("limite", () => {
  it("avisa o mês em que o limite estourou", async () => {
    const vendas: Venda[] = Array.from({ length: 11 }, (_, i) => ({
      data: `2026-${String(i + 1).padStart(2, "0")}-10`,
      valor: "8000.00",
      tipo: "mercadoria",
      compradorTemCnpj: false,
    }));
    const { deps } = depsFalsas({ conta: true, vendas });
    const r = await tratarCaderno({ etapa: "menu", atividades: [] }, "minhas vendas", TEL, deps);
    const t = r!.mensagens.join("\n");
    expect(t).toContain("Atenção");
    expect(t).toContain("passou do limite em novembro");
    expect(t).not.toMatch(/[—–]/);
  });

  it("projeta o estouro quando ainda não passou", async () => {
    const vendas: Venda[] = Array.from({ length: 10 }, (_, i) => ({
      data: `2026-${String(i + 1).padStart(2, "0")}-10`,
      valor: "7500.00",
      tipo: "mercadoria",
      compradorTemCnpj: false,
    }));
    const { deps } = depsFalsas({ conta: true, vendas });
    const r = await tratarCaderno({ etapa: "menu", atividades: [] }, "limite", TEL, deps);
    expect(r!.mensagens.join("\n")).toContain("no ritmo de agora, você passa do limite em dezembro");
  });

  it("desfaz a última venda", async () => {
    const { deps, estado } = depsFalsas({ conta: true });
    await tratarCaderno(undefined, "vendi 99", TEL, deps);
    const r = await tratarCaderno({ etapa: "menu", atividades: [] }, "desfazer", TEL, deps);
    expect(estado.vendas).toHaveLength(0);
    expect(r!.mensagens[0]).toContain("R$ 99,00");
  });
});

describe("nota pelo WhatsApp", () => {
  it("pede consentimento sem conta e guarda com conta", async () => {
    const sem = depsFalsas();
    expect((await tratarNotaRecebida(TEL, "<xml/>", sem.deps)).estado.etapa).toBe("consentir_conta");
    const com = depsFalsas({ conta: true });
    const r = await tratarNotaRecebida(TEL, "<xml/>", com.deps);
    expect(com.estado.notas).toBe(1);
    expect(r.mensagens[0]).toContain("Natura");
  });

  it("lê o arquivo encaminhado no evento", () => {
    const m = lerEvento({
      event: "messages.upsert",
      data: {
        key: { id: "X", remoteJid: "5514998370223@s.whatsapp.net", fromMe: false },
        message: { documentMessage: { fileName: "nota.xml", mimetype: "text/xml" } },
      },
    });
    expect(m?.documento).toEqual({ nome: "nota.xml", tipo: "text/xml" });
  });
});

describe("telefone da conta", () => {
  it("formata e repõe o 9 que o WhatsApp às vezes tira", () => {
    expect(telefoneDaConta("5514998370223")).toBe("+5514998370223");
    expect(telefoneDaConta("551498370223")).toBe("+5514998370223");
    expect(telefoneDaConta("551432345678")).toBeNull();
    expect(telefoneDaConta(null)).toBeNull();
  });
});
