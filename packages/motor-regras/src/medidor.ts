import DecimalBase from "decimal.js";
import { ParametroAusente, PerfilInvalido } from "./classificar";
import type { DecimalTexto, ParametrosDoMotor, TipoAtividade } from "./tipos";

const Decimal = DecimalBase.clone({ precision: 40 });
type Decimal = InstanceType<typeof Decimal>;

const TRANSPORTE_E_ENTREGA: ReadonlySet<TipoAtividade> = new Set([
  "transporte_passageiros",
  "entrega_de_bens",
]);

export interface ReceitaDoMes {
  /** Mês de 1 a 12. */
  mes: number;
  tipo: TipoAtividade;
  valor: DecimalTexto;
}

export interface EntradaDoMedidor {
  anoCalendario: number;
  temMei: boolean;
  /** Mês em que a atividade começou no ano. Ausente significa janeiro. */
  mesInicio?: number;
  /** Só os meses que a pessoa informou. Os demais, a partir do início, são estimados pela média. */
  receitas: ReceitaDoMes[];
}

export interface MesDoMedidor {
  mes: number;
  /** Valor que conta para o limite naquele mês. */
  computado: DecimalTexto;
  /** Soma desde o início do ano até este mês. */
  acumulado: DecimalTexto;
  /** Verdadeiro quando o mês não foi informado e veio da média. */
  estimado: boolean;
}

export interface ResultadoDoMedidor {
  tipoDeLimite: "NANO" | "MEI";
  limite: DecimalTexto;
  /** Soma dos meses informados. */
  realizado: DecimalTexto;
  /** Soma dos meses informados com os estimados até dezembro. */
  projetadoNoAno: DecimalTexto;
  /** Quanto ainda cabe no limite, considerando só o que já foi informado. Nunca negativo. */
  folga: DecimalTexto;
  /** Parte do limite já usada pelo que foi informado, de 0 a 100 ou mais. */
  percentualUsado: DecimalTexto;
  /** Primeiro mês em que a soma passa do limite. Nulo se não passa no ano. */
  mesQueEstoura: number | null;
  /** Verdadeiro quando o mês que estoura foi calculado só com valores informados. */
  estouroConfirmado: boolean;
  meses: MesDoMedidor[];
  regrasAplicadas: string[];
  pendencias: string[];
}

function formatar(valor: Decimal): string {
  return valor.decimalPlaces() <= 2 ? valor.toFixed(2) : valor.toString();
}

function lerValor(texto: string): Decimal {
  let v: Decimal;
  try {
    v = new Decimal(texto);
  } catch {
    throw new PerfilInvalido("Valor mensal inválido.");
  }
  if (!v.isFinite() || v.isNegative()) throw new PerfilInvalido("Valor mensal inválido.");
  return v;
}

/**
 * Mede o uso do limite no ano e projeta o mês em que ele estoura.
 *
 * Nanoempreendedor: o limite é "inferior a", então atingir o valor exato já tira a pessoa da faixa.
 * MEI: o limite é "até", então só passar do valor estoura.
 * A fração de transporte e entrega vale só para o teste do nano.
 */
export function medirLimite(entrada: EntradaDoMedidor, parametros: ParametrosDoMotor): ResultadoDoMedidor {
  const inicio = entrada.mesInicio ?? 1;
  if (!Number.isInteger(inicio) || inicio < 1 || inicio > 12) {
    throw new PerfilInvalido("O mês de início deve ser de 1 a 12.");
  }
  const parametroMei = parametros.limiteMeiAnual[String(entrada.anoCalendario)];
  if (!parametroMei) {
    throw new ParametroAusente(`Não há limite do MEI cadastrado para ${entrada.anoCalendario}.`);
  }

  const meses = 13 - inicio;
  const limiteMei = new Decimal(parametroMei.valor).times(meses).dividedBy(12);
  const nano = !entrada.temMei;
  const limite = nano ? limiteMei.times(parametros.fracaoLimiteNano.valor) : limiteMei;
  const fracaoApp = new Decimal(parametros.fracaoReceitaTransporteEntrega.valor);

  const regras = new Set<string>([parametroMei.regra]);
  const pendencias = new Set<string>();
  if (nano) regras.add(parametros.fracaoLimiteNano.regra);
  if (nano && inicio > 1) pendencias.add("R08");

  const porMes = new Map<number, Decimal>();
  const vistos = new Set<string>();
  for (const r of entrada.receitas) {
    if (!Number.isInteger(r.mes) || r.mes < inicio || r.mes > 12) {
      throw new PerfilInvalido(`Mês ${r.mes} fora do período de atividade.`);
    }
    const chave = `${r.mes}:${r.tipo}`;
    if (vistos.has(chave)) throw new PerfilInvalido(`A atividade aparece duas vezes no mês ${r.mes}.`);
    vistos.add(chave);
    let valor = lerValor(r.valor);
    if (nano && TRANSPORTE_E_ENTREGA.has(r.tipo)) {
      valor = valor.times(fracaoApp);
      regras.add(parametros.fracaoReceitaTransporteEntrega.regra);
      pendencias.add("R09");
    }
    porMes.set(r.mes, (porMes.get(r.mes) ?? new Decimal(0)).plus(valor));
  }
  if (porMes.size === 0) throw new PerfilInvalido("Informe o valor de pelo menos um mês.");

  let realizado = new Decimal(0);
  for (const v of porMes.values()) realizado = realizado.plus(v);
  const media = realizado.dividedBy(porMes.size);

  const passou = (acumulado: Decimal) =>
    nano ? acumulado.greaterThanOrEqualTo(limite) : acumulado.greaterThan(limite);

  const lista: MesDoMedidor[] = [];
  let acumulado = new Decimal(0);
  let mesQueEstoura: number | null = null;
  let estouroConfirmado = false;
  let houveEstimativa = false;
  for (let mes = inicio; mes <= 12; mes++) {
    const informado = porMes.get(mes);
    const computado = informado ?? media;
    if (!informado) houveEstimativa = true;
    acumulado = acumulado.plus(computado);
    if (mesQueEstoura === null && passou(acumulado)) {
      mesQueEstoura = mes;
      estouroConfirmado = !houveEstimativa;
    }
    lista.push({ mes, computado: formatar(computado), acumulado: formatar(acumulado), estimado: !informado });
  }

  if (nano && mesQueEstoura !== null) pendencias.add("R10");

  const folga = Decimal.max(limite.minus(realizado), 0);
  const percentual = limite.isZero() ? new Decimal(0) : realizado.dividedBy(limite).times(100);

  return {
    tipoDeLimite: nano ? "NANO" : "MEI",
    limite: formatar(limite),
    realizado: formatar(realizado),
    projetadoNoAno: formatar(acumulado),
    folga: formatar(folga),
    percentualUsado: percentual.toDecimalPlaces(1, Decimal.ROUND_DOWN).toFixed(1),
    mesQueEstoura,
    estouroConfirmado,
    meses: lista,
    regrasAplicadas: [...regras].sort(),
    pendencias: [...pendencias].sort(),
  };
}
