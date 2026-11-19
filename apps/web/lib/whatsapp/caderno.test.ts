import type { Venda } from "@cnpjtec/motor-regras";
import { describe, expect, it } from "vitest";
import { telefoneDaConta } from "../conta/whatsapp";
import { comandoDoCaderno, tratarCaderno, tratarNotaRecebida, type DepsCaderno } from "./caderno";
import { ehPerguntaLivre } from "./conversa";
import { lerEvento } from "./evolution";

const TEL = "+5514998370223";

function depsFalsas(inicial: { conta?: boolean; vendas?: Venda[] } = {}) {
  const estado = { conta: inicial.conta ?? false, vendas: [...(inicial.vendas ?? [])], notas: 0, lembretes: false };
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
    ligarLembretes: async () => {
      if (!estado.conta) return false;
      estado.lembretes = true;
      return true;
    },
    desligarLembretes: async () => {
      const estava = estado.lembretes;
      estado.lembretes = false;
      return estava;
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

describe("projeção com poucos dados", () => {
  it("não projeta o ano com só o mês corrente anotado", async () => {
    const { deps } = depsFalsas({ conta: true });
    const r = await tratarCaderno(undefined, "vendi 150 de perfume", TEL, deps);
    const t = r!.mensagens.join("\n");
    expect(t).toContain("Você começou a anotar em novembro");
    expect(t).not.toContain("o ano fecha em");
  });

  it("meses antes da primeira venda não contam como zero", async () => {
    const vendas: Venda[] = [
      { data: "2026-09-10", valor: "6000.00", tipo: "mercadoria", compradorTemCnpj: false },
      { data: "2026-10-10", valor: "6000.00", tipo: "mercadoria", compradorTemCnpj: false },
    ];
    const { deps } = depsFalsas({ conta: true, vendas });
    const t = (await tratarCaderno({ etapa: "menu", atividades: [] }, "minhas vendas", TEL, deps))!.mensagens.join("\n");
    // Com média de R$ 4.000 por mês (set, out e nov ainda em zero), o ano projetado passa de R$ 40 mil, não fica em R$ 12 mil.
    expect(t).not.toContain("R$ 13.");
    expect(t).not.toContain("passou do limite");
  });
});

describe("declaração anual pelo WhatsApp", () => {
  const venda = (data: string, valor: string, tipo: Venda["tipo"] = "mercadoria"): Venda => ({ data, valor, tipo, compradorTemCnpj: false });

  it("entende os jeitos de pedir", () => {
    expect(comandoDoCaderno("Declaração")).toEqual({ tipo: "declaracao", ano: null });
    expect(comandoDoCaderno("declaração anual do MEI")).toEqual({ tipo: "declaracao", ano: null });
    expect(comandoDoCaderno("DASN")).toEqual({ tipo: "declaracao", ano: null });
    expect(comandoDoCaderno("dasn-simei 2026")).toEqual({ tipo: "declaracao", ano: 2026 });
    expect(comandoDoCaderno("declaração de 2026?")).toEqual({ tipo: "declaracao", ano: 2026 });
    expect(ehPerguntaLivre({ etapa: "menu", atividades: [] }, "declaração")).toBe(false);
    expect(comandoDoCaderno("como faço a declaração do MEI?")).toBeNull();
  });

  it("monta a prévia do ano com os valores separados", async () => {
    const { deps } = depsFalsas({
      conta: true,
      vendas: [venda("2026-10-02", "1000"), venda("2026-11-03", "200", "servico")],
    });
    const r = await tratarCaderno({ etapa: "menu", atividades: [] }, "declaração", TEL, deps);
    const texto = r!.mensagens.join("\n");
    expect(texto).toContain("Declaração anual do MEI de 2026");
    expect(texto).toContain("prévia");
    expect(texto).toContain("Receita bruta total: *R$ 1.200,00*");
    expect(texto).toContain("comércio e indústria: *R$ 1.000,00*");
    expect(texto).toContain("janeiro, fevereiro");
    expect(texto).toContain("https://site/declaracao");
    expect(texto).not.toContain("—");
  });

  it("sem conta, lembra que a declaração sai com zero", async () => {
    const { deps, estado } = depsFalsas();
    const r = await tratarCaderno(undefined, "dasn", TEL, deps);
    expect(r!.mensagens.join("\n")).toContain("R$ 0,00");
    expect(estado.conta).toBe(false);
  });

  it("avisa do excesso de limite e do ano que não dá para montar", async () => {
    const vendas = Array.from({ length: 10 }, (_, i) => venda(`2026-${String(i + 1).padStart(2, "0")}-05`, "10000"));
    const { deps } = depsFalsas({ conta: true, vendas });
    const r = await tratarCaderno(undefined, "declaração 2026", TEL, deps);
    expect(r!.mensagens.join("\n")).toContain("mais de 20%");
    const r2 = await tratarCaderno(undefined, "declaração 2024", TEL, deps);
    expect(r2!.mensagens.join("\n")).toContain("Consigo montar a declaração destes anos: 2026");
  });
});

describe("lembretes pelo WhatsApp", () => {
  it("pede consentimento antes de criar a conta e liga os lembretes", async () => {
    const { deps, estado } = depsFalsas();
    const r = await tratarCaderno({ etapa: "menu", atividades: [] }, "quero lembretes", TEL, deps);
    expect(r!.estado.etapa).toBe("consentir_conta");
    expect(estado.conta).toBe(false);
    const r2 = await tratarCaderno(r!.estado, "1", TEL, deps);
    expect(estado.conta).toBe(true);
    expect(estado.lembretes).toBe(true);
    expect(r2!.mensagens.join("\n")).toContain("Lembretes ligados");
  });

  it("liga pela opção 6 do menu e desliga com parar lembretes", async () => {
    const { deps, estado } = depsFalsas({ conta: true });
    await tratarCaderno({ etapa: "menu", atividades: [] }, "6", TEL, deps);
    expect(estado.lembretes).toBe(true);
    const r = await tratarCaderno(undefined, "parar lembretes", TEL, deps);
    expect(estado.lembretes).toBe(false);
    expect(r!.mensagens[0]).toContain("parei");
  });

  it("recusar não cria conta", async () => {
    const { deps, estado } = depsFalsas();
    const r = await tratarCaderno(undefined, "lembretes", TEL, deps);
    await tratarCaderno(r!.estado, "2", TEL, deps);
    expect(estado.conta).toBe(false);
  });
});
