import { z } from "zod";

/** Versão do texto de consentimento. Mude sempre que o texto mudar. */
export const VERSAO_DO_CONSENTIMENTO = "2026-11-12";

export interface Controlador {
  nome: string;
  cnpj: string;
  email: string;
}

export interface ConfiguracaoDoRadar {
  url: string;
  chave: string;
  controlador: Controlador;
}

/**
 * O Radar só liga quando o banco e os dados de quem responde pelos dados pessoais
 * estão configurados. Sem isso a tela não mostra o formulário.
 */
export function configuracaoDoRadar(
  ambiente: Record<string, string | undefined> = process.env,
): ConfiguracaoDoRadar | null {
  const ler = (nome: string) => ambiente[nome]?.trim() || null;
  const url = ler("SUPABASE_URL");
  const chave = ler("SUPABASE_PUBLISHABLE_KEY");
  const nome = ler("CONTROLADOR_NOME");
  const cnpj = ler("CONTROLADOR_CNPJ");
  const email = ler("CONTROLADOR_EMAIL");
  if (!url || !chave || !nome || !cnpj || !email) return null;
  return { url: url.replace(/\/$/, ""), chave, controlador: { nome, cnpj, email } };
}

/** Texto que a pessoa aceita ao pedir o aviso. */
export function textoDoConsentimento(c: Controlador): string {
  return (
    `Quero que o MEiSHOP me avise quando a Receita Federal abrir o canal do CNPJ técnico. ` +
    `Meu contato será usado só para esse aviso e posso pedir para sair quando quiser, pelo e-mail ${c.email}. ` +
    `Quem responde pelos meus dados é ${c.nome}, CNPJ ${c.cnpj}.`
  );
}

/** Deixa o contato num formato único. Devolve null quando não parece válido. */
export function normalizarContato(canal: "whatsapp" | "email", digitado: string): string | null {
  if (canal === "email") {
    const email = digitado.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120 ? email : null;
  }
  let numeros = digitado.replace(/\D/g, "");
  if (numeros.length >= 12 && numeros.startsWith("55")) numeros = numeros.slice(2);
  numeros = numeros.replace(/^0/, "");
  // DDD de dois dígitos sem zero e celular de nove dígitos começando em 9.
  return /^[1-9][1-9]9\d{8}$/.test(numeros) ? `+55${numeros}` : null;
}

export const PedidoDeAviso = z
  .object({
    canal: z.enum(["whatsapp", "email"]),
    contato: z.string().min(1).max(160),
    trilha: z.enum(["A_NANO", "B_PF_CONTRIBUINTE", "C_MEI_SERVICO", "D_MEI_REVENDA", "E_ME_EPP"]),
    uf: z.string().regex(/^[A-Z]{2}$/),
    aceite: z.literal(true),
  })
  .strict();

export type PedidoDeAviso = z.infer<typeof PedidoDeAviso>;

/** Limite simples por endereço: evita que alguém encha a tabela a partir de um só lugar. */
export function criarLimite(maximo: number, janelaMs: number, agora: () => number = Date.now) {
  const pedidos = new Map<string, number[]>();
  return (chave: string): boolean => {
    const instante = agora();
    const recentes = (pedidos.get(chave) ?? []).filter((t) => instante - t < janelaMs);
    if (recentes.length >= maximo) {
      pedidos.set(chave, recentes);
      return false;
    }
    recentes.push(instante);
    pedidos.set(chave, recentes);
    if (pedidos.size > 5000) pedidos.clear();
    return true;
  };
}

/** Grava o pedido no banco. Contato repetido conta como gravado, para não revelar se já existia. */
export async function gravarPedido(
  config: ConfiguracaoDoRadar,
  pedido: { canal: string; contato: string; trilha: string; uf: string },
  buscar: typeof fetch = fetch,
): Promise<boolean> {
  const resposta = await buscar(`${config.url}/rest/v1/radar_inscricoes`, {
    method: "POST",
    headers: {
      apikey: config.chave,
      Authorization: `Bearer ${config.chave}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ ...pedido, consentimento_versao: VERSAO_DO_CONSENTIMENTO }),
  });
  // 409 é contato repetido. A chave pública só inclui, não lê, então a repetição chega como conflito.
  return resposta.ok || resposta.status === 409;
}
