import DecimalBase from "decimal.js";
import { PerfilInvalido } from "./classificar";
import type { DecimalTexto } from "./tipos";

const Decimal = DecimalBase.clone({ precision: 40 });
type Decimal = InstanceType<typeof Decimal>;

export type TipoDeVenda = "mercadoria" | "servico";

export interface Venda {
  /** Data no formato AAAA-MM-DD. */
  data: string;
  valor: DecimalTexto;
  tipo: TipoDeVenda;
  /** Quem comprou é empresa (tem CNPJ). */
  compradorTemCnpj: boolean;
}

export interface TotaisDeVendas {
  mercadoria: DecimalTexto;
  servico: DecimalTexto;
  total: DecimalTexto;
  quantidade: number;
  /** Vendas para empresa, que pedem documento fiscal. */
  vendasParaEmpresa: number;
}

export interface ResumoDeVendas {
  ano: number;
  /** Doze meses, de janeiro a dezembro. */
  meses: (TotaisDeVendas & { mes: number })[];
  totalDoAno: TotaisDeVendas;
  regrasAplicadas: string[];
}

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

function dataValida(texto: string): { ano: number; mes: number } | null {
  const m = DATA.exec(texto);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
    ? { ano, mes }
    : null;
}

function totais(lista: { valor: Decimal; tipo: TipoDeVenda; empresa: boolean }[]): TotaisDeVendas {
  let mercadoria = new Decimal(0);
  let servico = new Decimal(0);
  let empresa = 0;
  for (const v of lista) {
    if (v.tipo === "mercadoria") mercadoria = mercadoria.plus(v.valor);
    else servico = servico.plus(v.valor);
    if (v.empresa) empresa++;
  }
  return {
    mercadoria: mercadoria.toFixed(2),
    servico: servico.toFixed(2),
    total: mercadoria.plus(servico).toFixed(2),
    quantidade: lista.length,
    vendasParaEmpresa: empresa,
  };
}

/**
 * Soma as vendas de um ano por mês, separando mercadoria e serviço como pede a declaração
 * anual do MEI. Vendas de outros anos são ignoradas.
 */
export function resumirVendas(vendas: Venda[], ano: number): ResumoDeVendas {
  const porMes = Array.from({ length: 12 }, () => [] as { valor: Decimal; tipo: TipoDeVenda; empresa: boolean }[]);
  for (const v of vendas) {
    const data = dataValida(v.data);
    if (!data) throw new PerfilInvalido(`Data inválida: ${v.data}.`);
    if (v.tipo !== "mercadoria" && v.tipo !== "servico") throw new PerfilInvalido("Tipo de venda inválido.");
    let valor: Decimal;
    try {
      valor = new Decimal(v.valor);
    } catch {
      throw new PerfilInvalido("Valor de venda inválido.");
    }
    if (!valor.isFinite() || valor.isNegative() || valor.decimalPlaces() > 2) {
      throw new PerfilInvalido("Valor de venda inválido.");
    }
    if (data.ano !== ano) continue;
    porMes[data.mes - 1]!.push({ valor, tipo: v.tipo, empresa: v.compradorTemCnpj });
  }
  return {
    ano,
    meses: porMes.map((lista, i) => ({ mes: i + 1, ...totais(lista) })),
    totalDoAno: totais(porMes.flat()),
    regrasAplicadas: ["R33"],
  };
}
