import type { Venda } from "@cnpjtec/motor-regras";
import { medirCaderno } from "../caderno-limite";
import { lerValor, mostrarValor } from "../dinheiro";
import type { Estado } from "./conversa";
import { limpar } from "./conversa";

/**
 * Caderno de vendas e cofre de notas pelo WhatsApp, ligados à conta do site pelo número do celular.
 * Nada é guardado sem o "sim" da pessoa na primeira vez.
 */

export interface VendaNova extends Venda {
  id: string;
  descricao: string;
}

export type Pendente = { tipo: "venda"; venda: VendaNova } | { tipo: "nota"; xml: string };

export type Comando =
  | { tipo: "venda"; valor: string; tipoDeVenda: "mercadoria" | "servico"; compradorTemCnpj: boolean; descricao: string }
  | { tipo: "resumo" }
  | { tipo: "desfazer" }
  | { tipo: "ajuda" };

export interface DepsCaderno {
  temConta(telefone: string): Promise<boolean>;
  criarConta(telefone: string): Promise<void>;
  incluirVenda(telefone: string, venda: VendaNova): Promise<void>;
  vendas(telefone: string): Promise<Venda[]>;
  desfazer(telefone: string): Promise<{ data: string; valor: string; tipo: string } | null>;
  /** Lê e guarda a nota; devolve o resumo para a resposta. */
  guardarNota(telefone: string, xml: string): Promise<{ emitente: string; numero: string | null; valor: string | null }>;
  agora(): Date;
  site: string;
  consentimento: string;
  novoId(): string;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const VENDA = /^(?:vendi|venda|vendido|anota|anotar)\s+(?:de\s+)?(?:r\$\s*)?(\d[\d.,]*)\s*(?:reais|real|conto|contos)?\s*(.*)$/i;

/** Entende os pedidos do caderno. Devolve nulo quando a mensagem é outra coisa. */
export function comandoDoCaderno(recebido: string): Comando | null {
  const texto = limpar(recebido);
  if (/^(minhas vendas|meu caderno|meu limite|limite|quanto vendi|total do ano|resumo)$/.test(texto)) return { tipo: "resumo" };
  if (/^(desfazer|apagar a ultima|apaga a ultima|apagar ultima|cancelar a ultima)$/.test(texto)) return { tipo: "desfazer" };
  if (/^(caderno|anotar venda|anotar vendas|como anotar)$/.test(texto)) return { tipo: "ajuda" };
  const m = VENDA.exec(recebido.trim());
  if (!m) return null;
  const valor = lerValor(m[1]!.replace(/[.,]$/, ""));
  if (!valor || Number(valor) <= 0) return null;
  const resto = (m[2] ?? "").trim();
  const restoLimpo = limpar(resto);
  return {
    tipo: "venda",
    valor,
    tipoDeVenda: /servic|consert|manutenc|corte|unha|aula|diaria|frete/.test(restoLimpo) ? "servico" : "mercadoria",
    compradorTemCnpj: /\b(para|pra|pro) (uma )?(empresa|loja|cnpj)\b|\bcnpj\b/.test(restoLimpo),
    descricao: resto.replace(/^(de|do|da|em)\s+/i, "").slice(0, 120),
  };
}

export const AJUDA_CADERNO = [
  "*Caderno de vendas*",
  "Mande cada venda assim:",
  "• *vendi 150* (produto)",
  "• *vendi 80 serviço de unha*",
  "• *vendi 300 para empresa* (quando quem compra tem CNPJ)",
  "",
  "Outros pedidos:",
  "• *minhas vendas*: total do ano e o limite do MEI",
  "• *desfazer*: apaga a última venda anotada",
  "",
  "Também dá para encaminhar aqui o arquivo XML da nota de compra da marca, que eu guardo no cofre.",
].join("\n");

function dataHoje(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Texto do total do ano e do limite, calculado pelo motor. */
export function textoDoLimite(vendas: Venda[], agora: Date): string {
  const ano = Number(dataHoje(agora).slice(0, 4));
  const medida = medirCaderno(vendas, ano, agora);
  if (!medida) return `Ainda não há vendas anotadas em ${ano}.`;
  const linhas = [
    `Em ${ano} você já anotou ${mostrarValor(medida.realizado)} em vendas, ${Number(medida.percentualUsado).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do limite do MEI de ${mostrarValor(medida.limite)} (regra R14).`,
  ];
  if (medida.mesQueEstoura) {
    linhas.push(
      "",
      medida.estouroConfirmado
        ? `*Atenção:* com o que já foi anotado, você passou do limite em ${MESES[medida.mesQueEstoura - 1]}. Fale com um contador: ${"{site}"}/ajuda`
        : `*Atenção:* no ritmo de agora, você passa do limite em ${MESES[medida.mesQueEstoura - 1]}. Vale falar com um contador antes: ${"{site}"}/ajuda`,
    );
  } else if (Number(medida.percentualUsado) >= 80) {
    linhas.push("", "*Atenção:* falta pouco para o limite do MEI.");
  } else {
    linhas.push(`No ritmo de agora, o ano fecha em ${mostrarValor(medida.projetadoNoAno)}, dentro do limite.`);
  }
  return linhas.join("\n");
}

async function anotar(telefone: string, venda: VendaNova, deps: DepsCaderno): Promise<string> {
  await deps.incluirVenda(telefone, venda);
  const vendas = await deps.vendas(telefone);
  const linhas = [
    `Anotado: ${mostrarValor(venda.valor)} em ${diaMes(venda.data)}, ${venda.tipo === "servico" ? "serviço" : "venda de produto"}${venda.descricao ? ` (${venda.descricao})` : ""}.`,
  ];
  if (venda.compradorTemCnpj) linhas.push("Venda para empresa precisa de nota fiscal.");
  linhas.push("", textoDoLimite(vendas, deps.agora()).replaceAll("{site}", deps.site), "", "Anotou errado? Mande *desfazer*.");
  return linhas.join("\n");
}

async function guardar(telefone: string, xml: string, deps: DepsCaderno): Promise<string> {
  const n = await deps.guardarNota(telefone, xml);
  return [
    `Nota guardada no cofre: ${n.emitente}${n.numero ? `, nota ${n.numero}` : ""}${n.valor ? `, ${mostrarValor(n.valor)}` : ""}.`,
    `Veja todas em ${deps.site}/cofre`,
  ].join("\n");
}

function pedirConsentimento(deps: DepsCaderno): string {
  return [deps.consentimento, "", "1. Sim, pode guardar", "2. Não, obrigado"].join("\n");
}

export interface RespostaDoCaderno {
  estado: Estado;
  mensagens: string[];
}

/** Trata o que for do caderno. Devolve nulo quando a mensagem não é do caderno. */
export async function tratarCaderno(
  anterior: Estado | undefined,
  recebido: string,
  telefone: string | null,
  deps: DepsCaderno,
): Promise<RespostaDoCaderno | null> {
  const menu: Estado = { etapa: "menu", atividades: [] };

  if (anterior?.etapa === "consentir_conta" && anterior.pendente) {
    const t = limpar(recebido);
    if (t === "1" || t === "sim") {
      if (!telefone) return { estado: menu, mensagens: ["Não consegui identificar o seu número. Use o site para criar a conta."] };
      await deps.criarConta(telefone);
      const p = anterior.pendente;
      const texto = p.tipo === "venda" ? await anotar(telefone, p.venda, deps) : await guardar(telefone, p.xml, deps);
      return { estado: menu, mensagens: [`Conta criada. Você também pode entrar no site com este número: ${deps.site}/entrar`, texto] };
    }
    if (t === "2" || t === "nao") return { estado: menu, mensagens: ["Tudo bem, não guardei nada. Mande 0 para ver o menu."] };
    return { estado: anterior, mensagens: ["Responda 1 para guardar ou 2 para não guardar."] };
  }

  if (anterior?.etapa === "menu" && limpar(recebido) === "4") return { estado: menu, mensagens: [AJUDA_CADERNO] };

  const comando = comandoDoCaderno(recebido);
  if (!comando) return null;
  if (comando.tipo === "ajuda") return { estado: menu, mensagens: [AJUDA_CADERNO] };
  if (!telefone) {
    return { estado: menu, mensagens: [`Não consegui identificar o seu número. Anote as vendas no site: ${deps.site}/caderno`] };
  }

  const conta = await deps.temConta(telefone);
  if (comando.tipo === "resumo" || comando.tipo === "desfazer") {
    if (!conta) return { estado: menu, mensagens: ["Você ainda não anotou vendas aqui. Mande, por exemplo, *vendi 150*."] };
    if (comando.tipo === "resumo") {
      return { estado: menu, mensagens: [textoDoLimite(await deps.vendas(telefone), deps.agora()).replaceAll("{site}", deps.site)] };
    }
    const desfeita = await deps.desfazer(telefone);
    return {
      estado: menu,
      mensagens: [
        desfeita
          ? `Apaguei a venda de ${mostrarValor(desfeita.valor)} de ${diaMes(desfeita.data)}.`
          : "Não achei venda anotada nas últimas 24 horas para apagar. As mais antigas você corrige no site, no caderno.",
      ],
    };
  }

  const venda: VendaNova = {
    id: deps.novoId(),
    data: dataHoje(deps.agora()),
    valor: comando.valor,
    tipo: comando.tipoDeVenda,
    compradorTemCnpj: comando.compradorTemCnpj,
    descricao: comando.descricao,
  };
  if (!conta) {
    return { estado: { etapa: "consentir_conta", atividades: [], pendente: { tipo: "venda", venda } }, mensagens: [pedirConsentimento(deps)] };
  }
  return { estado: menu, mensagens: [await anotar(telefone, venda, deps)] };
}

/** Nota de compra encaminhada como arquivo XML. */
export async function tratarNotaRecebida(telefone: string | null, xml: string, deps: DepsCaderno): Promise<RespostaDoCaderno> {
  const menu: Estado = { etapa: "menu", atividades: [] };
  if (!telefone) return { estado: menu, mensagens: [`Não consegui identificar o seu número. Guarde a nota pelo site: ${deps.site}/cofre`] };
  if (!(await deps.temConta(telefone))) {
    return { estado: { etapa: "consentir_conta", atividades: [], pendente: { tipo: "nota", xml } }, mensagens: [pedirConsentimento(deps)] };
  }
  return { estado: menu, mensagens: [await guardar(telefone, xml, deps)] };
}
