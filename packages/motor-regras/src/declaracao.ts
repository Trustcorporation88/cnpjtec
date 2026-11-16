import DecimalBase from "decimal.js";
import { ParametroAusente, PerfilInvalido } from "./classificar";
import type { DecimalTexto, ParametrosDoMotor } from "./tipos";
import { resumirVendas, type Venda } from "./vendas";

const Decimal = DecimalBase.clone({ precision: 40 });

/** Onde a declaração está no calendário, olhando a data de hoje. */
export type SituacaoDaDeclaracao =
  /** O ano ainda não acabou: os números são parciais. */
  | "ano_em_curso"
  /** De janeiro até o último dia de maio do ano seguinte. */
  | "no_prazo"
  /** Passou do último dia de maio do ano seguinte. */
  | "atrasada";

/** Como a receita do ano ficou diante do limite do MEI. */
export type FaixaDoLimite = "dentro" | "excesso_ate_20" | "excesso_acima_20";

export interface EntradaDaDeclaracao {
  vendas: Venda[];
  anoCalendario: number;
  /** Data de hoje no formato AAAA-MM-DD, no fuso de Brasília. */
  hoje: string;
  /** Mês em que o MEI começou, quando abriu no próprio ano. O limite fica proporcional. */
  mesInicio?: number;
}

export interface Declaracao {
  anoCalendario: number;
  /** Receita bruta total do ano. É o primeiro campo da DASN-SIMEI. */
  receitaTotal: DecimalTexto;
  /** Parte da receita que veio de comércio, indústria ou transporte intermunicipal e interestadual. */
  receitaComercio: DecimalTexto;
  /** Parte da receita que veio de prestação de serviços. Fica dentro do total. */
  receitaServicos: DecimalTexto;
  quantidadeDeVendas: number;
  /** Vendas para empresa: cada uma pedia nota fiscal. */
  vendasParaEmpresa: number;
  /** Meses já fechados, desde o início, sem nenhuma venda anotada. */
  mesesSemAnotacao: number[];
  /** Último dia para entregar sem multa, AAAA-MM-DD. */
  prazo: string;
  situacao: SituacaoDaDeclaracao;
  limite: DecimalTexto;
  faixa: FaixaDoLimite;
  /** Quanto passou do limite. Zero quando ficou dentro. */
  excedente: DecimalTexto;
  regrasAplicadas: string[];
}

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Último dia de maio do ano seguinte: 31 de maio, sempre. */
function prazoDe(ano: number): string {
  return `${ano + 1}-05-31`;
}

/**
 * Monta os números da declaração anual do MEI a partir do caderno de vendas. Não transmite nada:
 * a entrega é feita pela própria pessoa no Portal do Simples Nacional ou no app MEI.
 */
export function prepararDeclaracao(entrada: EntradaDaDeclaracao, parametros: ParametrosDoMotor): Declaracao {
  const ano = entrada.anoCalendario;
  const hoje = DATA.exec(entrada.hoje);
  if (!hoje) throw new PerfilInvalido("Data de hoje inválida.");
  const anoHoje = Number(hoje[1]);
  const mesHoje = Number(hoje[2]);
  const inicio = entrada.mesInicio ?? 1;
  if (!Number.isInteger(inicio) || inicio < 1 || inicio > 12) {
    throw new PerfilInvalido("O mês de início deve ser de 1 a 12.");
  }
  if (ano > anoHoje) throw new PerfilInvalido("Esse ano ainda não começou.");
  const parametroMei = parametros.limiteMeiAnual[String(ano)];
  if (!parametroMei) throw new ParametroAusente(`Não há limite do MEI cadastrado para ${ano}.`);

  const resumo = resumirVendas(entrada.vendas, ano);
  const prazo = prazoDe(ano);
  const situacao: SituacaoDaDeclaracao =
    ano === anoHoje ? "ano_em_curso" : entrada.hoje <= prazo ? "no_prazo" : "atrasada";

  // No ano em curso, o mês de hoje ainda está aberto e não entra na lista de meses sem anotação.
  const ultimoFechado = ano === anoHoje ? mesHoje - 1 : 12;
  const mesesSemAnotacao = resumo.meses
    .filter((m) => m.mes >= inicio && m.mes <= ultimoFechado && m.quantidade === 0)
    .map((m) => m.mes);

  const limite = new Decimal(parametroMei.valor).times(13 - inicio).dividedBy(12);
  const total = new Decimal(resumo.totalDoAno.total);
  const excedente = Decimal.max(total.minus(limite), 0);
  const faixa: FaixaDoLimite = excedente.isZero()
    ? "dentro"
    : total.lessThanOrEqualTo(limite.times("1.2"))
      ? "excesso_ate_20"
      : "excesso_acima_20";

  const regras = ["R33", parametroMei.regra];
  if (faixa !== "dentro") regras.push("R38");
  if (situacao === "atrasada") regras.push("R39");

  return {
    anoCalendario: ano,
    receitaTotal: resumo.totalDoAno.total,
    receitaComercio: resumo.totalDoAno.mercadoria,
    receitaServicos: resumo.totalDoAno.servico,
    quantidadeDeVendas: resumo.totalDoAno.quantidade,
    vendasParaEmpresa: resumo.totalDoAno.vendasParaEmpresa,
    mesesSemAnotacao,
    prazo,
    situacao,
    limite: limite.toFixed(2),
    faixa,
    excedente: excedente.toFixed(2),
    regrasAplicadas: regras,
  };
}

/**
 * Ano que a pessoa provavelmente quer declarar: até o fim de maio, o ano anterior (época da entrega);
 * depois disso, o ano corrente, como prévia.
 */
export function anoDaDeclaracao(hoje: string): number {
  const m = DATA.exec(hoje);
  if (!m) throw new PerfilInvalido("Data de hoje inválida.");
  const ano = Number(m[1]);
  return Number(m[2]) <= 5 ? ano - 1 : ano;
}
