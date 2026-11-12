import DecimalBase from "decimal.js";
import type {
  Alerta,
  Atividade,
  Lacuna,
  ParametrosDoMotor,
  Perfil,
  Resultado,
  TipoAtividade,
  Trilha,
} from "./tipos";

const Decimal = DecimalBase.clone({ precision: 40 });
type Decimal = InstanceType<typeof Decimal>;

/** Falta na base de regras um parâmetro necessário. O motor nunca supõe valor. */
export class ParametroAusente extends Error {}

/** O perfil informado não pode ser avaliado. */
export class PerfilInvalido extends Error {}

const TRANSPORTE_E_ENTREGA: ReadonlySet<TipoAtividade> = new Set([
  "transporte_passageiros",
  "entrega_de_bens",
]);

const SERVICOS: ReadonlySet<TipoAtividade> = new Set([
  "transporte_passageiros",
  "entrega_de_bens",
  "servico",
  "intermediacao_comissao",
]);

function formatar(valor: Decimal): string {
  return valor.decimalPlaces() <= 2 ? valor.toFixed(2) : valor.toString();
}

function lerReceita(atividade: Atividade): Decimal {
  let valor: Decimal;
  try {
    valor = new Decimal(atividade.receitaBrutaAnual);
  } catch {
    throw new PerfilInvalido(`Receita inválida na atividade ${atividade.tipo}.`);
  }
  if (!valor.isFinite() || valor.isNegative()) {
    throw new PerfilInvalido(`Receita inválida na atividade ${atividade.tipo}.`);
  }
  return valor;
}

function mesesDeAtividade(perfil: Perfil): number {
  const meses = perfil.mesesDeAtividadeNoAno ?? 12;
  if (!Number.isInteger(meses) || meses < 1 || meses > 12) {
    throw new PerfilInvalido("Meses de atividade no ano deve ser um inteiro de 1 a 12.");
  }
  return meses;
}

function limiteMeiDoAno(parametros: ParametrosDoMotor, ano: number): { valor: Decimal; regra: string } {
  const parametro = parametros.limiteMeiAnual[String(ano)];
  if (!parametro) {
    throw new ParametroAusente(
      `Não há limite do MEI cadastrado para ${ano}. Cadastre a regra antes de avaliar esse ano.`,
    );
  }
  return { valor: new Decimal(parametro.valor), regra: parametro.regra };
}

/**
 * Classifica a pessoa nas trilhas do produto e aponta alertas, regras usadas e pendências.
 *
 * Função pura: não lê banco, relógio nem rede. Todos os valores legais chegam em `parametros`.
 * As comparações usam o valor exato, sem arredondar. O limite do nano é "inferior a",
 * então receita computada igual ao limite não enquadra.
 */
export function classificar(perfil: Perfil, parametros: ParametrosDoMotor): Resultado {
  const meses = mesesDeAtividade(perfil);
  const limiteAnual = limiteMeiDoAno(parametros, perfil.anoCalendario);
  const limiteMei = limiteAnual.valor.times(meses).dividedBy(12);
  const limiteNano = limiteMei.times(parametros.fracaoLimiteNano.valor);
  const fracaoApp = new Decimal(parametros.fracaoReceitaTransporteEntrega.valor);

  const regras = new Set<string>();
  const pendencias = new Set<string>();
  const alertas: Alerta[] = [];
  const lacunas: Lacuna[] = [];
  const trilhas: Trilha[] = [];

  let bruta = new Decimal(0);
  let computada = new Decimal(0);
  const tipos = new Set<TipoAtividade>();
  for (const atividade of perfil.atividades) {
    const receita = lerReceita(atividade);
    tipos.add(atividade.tipo);
    bruta = bruta.plus(receita);
    computada = computada.plus(
      TRANSPORTE_E_ENTREGA.has(atividade.tipo) ? receita.times(fracaoApp) : receita,
    );
  }

  const montar = (): Resultado => ({
    trilhas,
    receitaBrutaTotal: formatar(bruta),
    receitaComputadaNano: formatar(computada),
    limiteMei: formatar(limiteMei),
    limiteNano: formatar(limiteNano),
    regrasAplicadas: [...regras].sort(),
    pendencias: [...pendencias].sort(),
    alertas,
    lacunas,
  });

  if (perfil.vinculo === "somente_empregado") {
    trilhas.push("FORA_DO_ALCANCE");
    regras.add("R01");
    return montar();
  }

  if (perfil.atividades.length === 0) {
    throw new PerfilInvalido("Informe ao menos uma atividade para quem trabalha por conta própria.");
  }

  const revende = tipos.has("revenda_mercadoria");
  const prestaServico = [...tipos].some((t) => SERVICOS.has(t));
  const usaAplicativo = [...tipos].some((t) => TRANSPORTE_E_ENTREGA.has(t));
  const emSaoPaulo = perfil.uf.toUpperCase() === "SP";
  const proporcional = meses < 12;

  if (perfil.temMei) {
    regras.add(limiteAnual.regra);
    if (bruta.greaterThan(limiteMei)) {
      // A regra de excesso do MEI ainda não está na base. Por ora o caso vai para atendimento humano.
      trilhas.push("E_ME_EPP");
      alertas.push({ codigo: "MEI_ACIMA_DO_LIMITE", regra: limiteAnual.regra });
      return montar();
    }
    if (prestaServico) trilhas.push("C_MEI_SERVICO");
    if (revende) {
      trilhas.push("D_MEI_REVENDA");
      regras.add("R22");
      alertas.push({ codigo: "GUARDAR_NOTAS_DE_COMPRA", regra: "R22" });
      if (emSaoPaulo) {
        regras.add("R25");
        if (perfil.inscricaoEstadualAtiva === false) {
          alertas.push({ codigo: "CADESP_OBRIGATORIO", regra: "R25" });
        } else if (perfil.inscricaoEstadualAtiva === undefined) {
          alertas.push({ codigo: "CADESP_NAO_CONSULTADO", regra: "R25" });
        }
      } else {
        lacunas.push("ICMS_UF_NAO_COBERTA");
      }
    }
    if (perfil.anoCalendario >= 2027) {
      regras.add("R18");
      if (prestaServico) regras.add("R19");
      if (revende) regras.add("R20");
      alertas.push({ codigo: "REGISTRAR_VENDAS_PF", regra: "R18" });
    }
    return montar();
  }

  // Pessoa física sem MEI.
  regras.add(parametros.fracaoLimiteNano.regra);
  regras.add(limiteAnual.regra);
  if (usaAplicativo) {
    regras.add(parametros.fracaoReceitaTransporteEntrega.regra);
    pendencias.add("R09");
  }
  if (proporcional) pendencias.add("R08");

  const dentroDoLimite = computada.lessThan(limiteNano);
  if (dentroDoLimite && perfil.optouRegimeRegular !== true) {
    trilhas.push("A_NANO");
    regras.add("R03");
    regras.add("R07");
  } else {
    trilhas.push("B_PF_CONTRIBUINTE");
    regras.add("R01");
    regras.add("R11");
    pendencias.add("R12");
    pendencias.add("R13");
    if (!dentroDoLimite) pendencias.add("R10");
    alertas.push({ codigo: "ACOMPANHAR_CNPJ_TECNICO", regra: "R11" });
  }

  if (revende) {
    regras.add("R23");
    alertas.push({ codigo: "REVENDA_PF_CONTRIBUINTE_ICMS", regra: "R23" });
    if (emSaoPaulo) {
      if (perfil.inscricaoEstadualAtiva !== true) {
        regras.add("R24");
        alertas.push({ codigo: "REMESSA_VEDADA_SEM_CADESP", regra: "R24" });
      }
    } else {
      lacunas.push("ICMS_UF_NAO_COBERTA");
    }
  }
  if (tipos.has("intermediacao_comissao")) {
    alertas.push({ codigo: "INTERMEDIACAO_ANALISAR_COMO_SERVICO", regra: "R01" });
  }
  if (prestaServico) {
    pendencias.add("R30");
    alertas.push({ codigo: "ISS_MUNICIPAL_A_VERIFICAR", regra: "R30" });
  }

  return montar();
}
