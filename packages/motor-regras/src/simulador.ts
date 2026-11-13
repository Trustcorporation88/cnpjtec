import DecimalBase from "decimal.js";
import { ParametroAusente, PerfilInvalido } from "./classificar";
import type { Atividade, DecimalTexto, ParametrosDoMotor, TipoAtividade } from "./tipos";

const Decimal = DecimalBase.clone({ precision: 40 });
type Decimal = InstanceType<typeof Decimal>;

const TRANSPORTE_E_ENTREGA: ReadonlySet<TipoAtividade> = new Set(["transporte_passageiros", "entrega_de_bens"]);

export interface EntradaDoSimulador {
  anoCalendario: number;
  /** Receita bruta prevista no ano, por atividade. */
  atividades: Atividade[];
}

export interface ResultadoDoSimulador {
  ano: number;
  receitaBrutaTotal: DecimalTexto;
  nano: {
    cabe: boolean;
    receitaComputada: DecimalTexto;
    /** Precisa ficar abaixo deste valor. */
    limite: DecimalTexto;
  };
  mei: {
    cabe: boolean;
    limite: DecimalTexto;
    /** Guia mensal. */
    dasMensal: DecimalTexto;
    dasNoAno: DecimalTexto;
    inss: DecimalTexto;
    icms: DecimalTexto;
    iss: DecimalTexto;
    /** Parte da receita que a guia representa, em porcentagem com uma casa. */
    pesoNaReceita: DecimalTexto | null;
  };
  /** A pessoa física fica obrigada ao regime regular se não for nano nem abrir MEI. */
  regularSeNaoForMei: boolean;
  regrasAplicadas: string[];
  pendencias: string[];
}

function formatar(v: Decimal): string {
  return v.decimalPlaces() <= 2 ? v.toFixed(2) : v.toString();
}

function parametroDoAno(
  mapa: Record<string, { valor: string; regra: string }>,
  ano: number,
  nome: string,
): { valor: Decimal; regra: string } {
  const p = mapa[String(ano)];
  if (!p) throw new ParametroAusente(`Não há ${nome} cadastrado para ${ano}.`);
  return { valor: new Decimal(p.valor), regra: p.regra };
}

/**
 * Compara, para o ano inteiro, ficar como nanoempreendedor, abrir MEI ou ir para o regime regular.
 * Calcula só o que tem regra: limites e guia do MEI. O imposto do regime regular depende de
 * alíquota e de créditos e não é calculado aqui.
 */
export function simularRegimes(entrada: EntradaDoSimulador, parametros: ParametrosDoMotor): ResultadoDoSimulador {
  if (entrada.atividades.length === 0) throw new PerfilInvalido("Informe ao menos uma atividade.");
  const limiteMei = parametroDoAno(parametros.limiteMeiAnual, entrada.anoCalendario, "limite do MEI");
  const salario = parametroDoAno(parametros.salarioMinimo, entrada.anoCalendario, "salário mínimo");
  const limiteNano = limiteMei.valor.times(parametros.fracaoLimiteNano.valor);
  const fracaoApp = new Decimal(parametros.fracaoReceitaTransporteEntrega.valor);

  const regras = new Set<string>([limiteMei.regra, salario.regra, parametros.fracaoLimiteNano.regra, parametros.fracaoInssMei.regra]);
  const pendencias = new Set<string>();

  let bruta = new Decimal(0);
  let computada = new Decimal(0);
  let vendeMercadoria = false;
  let prestaServico = false;
  const vistos = new Set<TipoAtividade>();
  for (const a of entrada.atividades) {
    if (vistos.has(a.tipo)) throw new PerfilInvalido("Cada atividade só pode aparecer uma vez.");
    vistos.add(a.tipo);
    let v: Decimal;
    try {
      v = new Decimal(a.receitaBrutaAnual);
    } catch {
      throw new PerfilInvalido("Receita inválida.");
    }
    if (!v.isFinite() || v.isNegative()) throw new PerfilInvalido("Receita inválida.");
    bruta = bruta.plus(v);
    if (TRANSPORTE_E_ENTREGA.has(a.tipo)) {
      computada = computada.plus(v.times(fracaoApp));
      regras.add(parametros.fracaoReceitaTransporteEntrega.regra);
      pendencias.add("R09");
    } else {
      computada = computada.plus(v);
    }
    if (a.tipo === "revenda_mercadoria") vendeMercadoria = true;
    else prestaServico = true;
  }

  const inss = salario.valor.times(parametros.fracaoInssMei.valor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const icms = vendeMercadoria ? new Decimal(parametros.icmsMei.valor) : new Decimal(0);
  const iss = prestaServico ? new Decimal(parametros.issMei.valor) : new Decimal(0);
  const das = inss.plus(icms).plus(iss);
  const dasAno = das.times(12);

  const nanoCabe = computada.lessThan(limiteNano);
  const meiCabe = bruta.lessThanOrEqualTo(limiteMei.valor);
  if (!nanoCabe) {
    regras.add("R11");
    pendencias.add("R10");
    pendencias.add("R13");
  } else {
    regras.add("R07");
  }

  return {
    ano: entrada.anoCalendario,
    receitaBrutaTotal: formatar(bruta),
    nano: { cabe: nanoCabe, receitaComputada: formatar(computada), limite: formatar(limiteNano) },
    mei: {
      cabe: meiCabe,
      limite: formatar(limiteMei.valor),
      dasMensal: das.toFixed(2),
      dasNoAno: dasAno.toFixed(2),
      inss: inss.toFixed(2),
      icms: icms.toFixed(2),
      iss: iss.toFixed(2),
      pesoNaReceita: bruta.isZero() ? null : dasAno.dividedBy(bruta).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1),
    },
    regularSeNaoForMei: !nanoCabe,
    regrasAplicadas: [...regras].sort(),
    pendencias: [...pendencias].sort(),
  };
}
