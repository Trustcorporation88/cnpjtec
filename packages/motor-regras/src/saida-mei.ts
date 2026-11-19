import DecimalBase from "decimal.js";
import { ParametroAusente, PerfilInvalido } from "./classificar";
import type { DecimalTexto, ParametrosDoMotor } from "./tipos";

const Decimal = DecimalBase.clone({ precision: 40 });

export interface EntradaDaSaidaDoMei {
  anoCalendario: number;
  /** Média mensal bruta de venda de mercadoria (Anexo I). */
  comercioMensal: DecimalTexto;
  /** Média mensal bruta de serviço do Anexo III. */
  servicoMensal: DecimalTexto;
}

export interface ParteDoSimples {
  anexo: "I" | "III";
  receitaMensal: DecimalTexto;
  faixa: number;
  aliquotaNominal: DecimalTexto;
  aliquotaEfetiva: DecimalTexto;
  guiaMensal: DecimalTexto;
  cbsMensal: DecimalTexto;
  ibsMensal: DecimalTexto;
  /** Percentual de CBS e de IBS que vai destacado na nota (crédito de quem compra de empresa). */
  cbsNaNota: DecimalTexto;
  ibsNaNota: DecimalTexto;
}

export interface SaidaDoMei {
  anoCalendario: number;
  receitaAnual: DecimalTexto;
  partes: ParteDoSimples[];
  guiaMensalSimples: DecimalTexto;
  guiaMensalMei: DecimalTexto;
  diferencaMensal: DecimalTexto;
  regrasAplicadas: string[];
  /** Pontos que só um contador fecha (fator R, ISS fixo, sublimite). */
  avisos: string[];
}

const dinheiro = (d: DecimalBase) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
const percentual = (d: DecimalBase) => d.times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

function lerValor(v: string, nome: string): DecimalBase {
  let d: DecimalBase;
  try {
    d = new Decimal(v);
  } catch {
    throw new PerfilInvalido(`${nome} inválido.`);
  }
  if (!d.isFinite() || d.isNegative()) throw new PerfilInvalido(`${nome} inválido.`);
  return d;
}

/**
 * Quanto a pessoa pagaria como ME no Simples Nacional, comparado ao DAS fixo do MEI, com a parte
 * de CBS e IBS da guia e o percentual que vai na nota. Aproxima a receita dos últimos 12 meses pela
 * média mensal informada vezes 12.
 */
export function simularSaidaDoMei(entrada: EntradaDaSaidaDoMei, parametros: ParametrosDoMotor): SaidaDoMei {
  const tabelas = parametros.simplesNacional?.[String(entrada.anoCalendario)];
  if (!tabelas?.I || !tabelas.III) throw new ParametroAusente(`Não há tabela do Simples cadastrada para ${entrada.anoCalendario}.`);
  const salario = parametros.salarioMinimo[String(entrada.anoCalendario)];
  if (!salario) throw new ParametroAusente(`Não há salário mínimo cadastrado para ${entrada.anoCalendario}.`);

  const comercio = lerValor(entrada.comercioMensal, "Valor de comércio");
  const servico = lerValor(entrada.servicoMensal, "Valor de serviço");
  const mensal = comercio.plus(servico);
  if (mensal.isZero()) throw new PerfilInvalido("Informe quanto você vende por mês.");
  const rbt12 = mensal.times(12);

  const regras = new Set<string>(["R42", salario.regra, parametros.fracaoInssMei.regra]);
  const avisos: string[] = [];
  const partes: ParteDoSimples[] = [];

  for (const [anexo, receita] of [["I", comercio], ["III", servico]] as const) {
    if (receita.isZero()) continue;
    const tabela = tabelas[anexo]!;
    const indice = tabela.faixas.findIndex((f) => rbt12.lessThanOrEqualTo(f.ate));
    if (indice < 0) throw new ParametroAusente("Receita acima de R$ 1,8 milhão por ano: a conta precisa de um contador.");
    const f = tabela.faixas[indice]!;
    regras.add(tabela.regra);
    const efetiva = rbt12.times(f.aliquota).minus(f.deduzir).dividedBy(rbt12);
    const guia = receita.times(efetiva);
    partes.push({
      anexo,
      receitaMensal: dinheiro(receita),
      faixa: indice + 1,
      aliquotaNominal: percentual(new Decimal(f.aliquota)),
      aliquotaEfetiva: percentual(efetiva),
      guiaMensal: dinheiro(guia),
      cbsMensal: dinheiro(guia.times(f.cbs)),
      ibsMensal: dinheiro(guia.times(f.ibs)),
      cbsNaNota: percentual(efetiva.times(f.cbs)),
      ibsNaNota: percentual(efetiva.times(f.ibs)),
    });
  }

  const guiaSimples = partes.reduce((t, p) => t.plus(p.guiaMensal), new Decimal(0));
  let guiaMei = new Decimal(salario.valor).times(parametros.fracaoInssMei.valor);
  if (!comercio.isZero()) {
    guiaMei = guiaMei.plus(parametros.icmsMei.valor);
    regras.add(parametros.icmsMei.regra);
  }
  if (!servico.isZero()) {
    guiaMei = guiaMei.plus(parametros.issMei.valor);
    regras.add(parametros.issMei.regra);
    avisos.push("Alguns serviços (fator R) vão para o Anexo V, com guia maior. O contador confirma o anexo da sua atividade.");
  }
  avisos.push("Como ME você também passa a ter contador, emitir nota em todas as vendas e entregar as declarações do Simples.");

  return {
    anoCalendario: entrada.anoCalendario,
    receitaAnual: dinheiro(rbt12),
    partes,
    guiaMensalSimples: dinheiro(guiaSimples),
    guiaMensalMei: dinheiro(guiaMei),
    diferencaMensal: dinheiro(guiaSimples.minus(guiaMei)),
    regrasAplicadas: [...regras],
    avisos,
  };
}
