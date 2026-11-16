import { medirLimite, resumirVendas, type ReceitaDoMes, type ResultadoDoMedidor, type Venda } from "@cnpjtec/motor-regras";
import { baseDeRegras } from "@cnpjtec/regras";

/**
 * Mede o limite do MEI a partir do caderno de vendas: os meses já vividos entram com o que foi anotado
 * (mesmo zero) e os meses que faltam são projetados pela média. Mesma conta no site e no WhatsApp.
 */
export function medirCaderno(vendas: Venda[], ano: number, agora: Date = new Date()): ResultadoDoMedidor | null {
  const resumo = resumirVendas(vendas, ano);
  if (!baseDeRegras.parametros.limiteMeiAnual[String(ano)] || resumo.totalDoAno.quantidade === 0) return null;
  const anoAtual = agora.getFullYear();
  const ultimoMesFechado = ano < anoAtual ? 12 : ano === anoAtual ? agora.getMonth() + 1 : 0;
  if (ultimoMesFechado === 0) return null;
  const receitas: ReceitaDoMes[] = [];
  for (const m of resumo.meses.slice(0, ultimoMesFechado)) {
    receitas.push({ mes: m.mes, tipo: "revenda_mercadoria", valor: m.mercadoria });
    receitas.push({ mes: m.mes, tipo: "servico", valor: m.servico });
  }
  return medirLimite({ anoCalendario: ano, temMei: true, receitas }, baseDeRegras.parametros);
}
