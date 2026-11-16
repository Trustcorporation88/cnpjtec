import { medirLimite, resumirVendas, type ReceitaDoMes, type ResultadoDoMedidor, type Venda } from "@cnpjtec/motor-regras";
import { baseDeRegras } from "@cnpjtec/regras";

export interface MedidaDoCaderno extends ResultadoDoMedidor {
  /** Primeiro mês do ano com venda anotada. */
  primeiroMesAnotado: number;
  /** Verdadeiro quando há pelo menos um mês completo anotado, o mínimo para projetar o ano. */
  projecaoConfiavel: boolean;
}

/**
 * Mede o limite do MEI a partir do caderno de vendas. Contam os meses desde a primeira venda anotada
 * (mesmo os de venda zero); os meses antes dela não são tratados como zero, porque a pessoa pode só não
 * ter anotado: entram estimados pela média, como os que faltam até dezembro. Mesma conta no site e no WhatsApp.
 */
export function medirCaderno(vendas: Venda[], ano: number, agora: Date = new Date()): MedidaDoCaderno | null {
  const resumo = resumirVendas(vendas, ano);
  if (!baseDeRegras.parametros.limiteMeiAnual[String(ano)] || resumo.totalDoAno.quantidade === 0) return null;
  const anoAtual = agora.getFullYear();
  const ultimoMesFechado = ano < anoAtual ? 12 : ano === anoAtual ? agora.getMonth() + 1 : 0;
  if (ultimoMesFechado === 0) return null;
  const primeiro = resumo.meses.find((m) => m.quantidade > 0)?.mes ?? 1;
  const receitas: ReceitaDoMes[] = [];
  for (const m of resumo.meses.slice(primeiro - 1, Math.max(ultimoMesFechado, primeiro))) {
    receitas.push({ mes: m.mes, tipo: "revenda_mercadoria", valor: m.mercadoria });
    receitas.push({ mes: m.mes, tipo: "servico", valor: m.servico });
  }
  const medida = medirLimite({ anoCalendario: ano, temMei: true, receitas }, baseDeRegras.parametros);
  const mesCorrente = ano === anoAtual ? agora.getMonth() + 1 : 13;
  return { ...medida, primeiroMesAnotado: primeiro, projecaoConfiavel: primeiro < mesCorrente };
}
