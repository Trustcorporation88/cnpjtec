/** Valor monetário ou fração como texto decimal, nunca número de ponto flutuante. */
export type DecimalTexto = string;

export type Trilha =
  | "FORA_DO_ALCANCE"
  | "A_NANO"
  | "B_PF_CONTRIBUINTE"
  | "C_MEI_SERVICO"
  | "D_MEI_REVENDA"
  | "E_ME_EPP";

export type TipoAtividade =
  | "transporte_passageiros"
  | "entrega_de_bens"
  | "servico"
  | "revenda_mercadoria"
  | "intermediacao_comissao";

export interface Atividade {
  tipo: TipoAtividade;
  /** Receita bruta do ano-calendário nessa atividade. */
  receitaBrutaAnual: DecimalTexto;
}

export interface Perfil {
  anoCalendario: number;
  /** "somente_empregado": toda a renda vem de emprego. "conta_propria": tem atividade própria. */
  vinculo: "somente_empregado" | "conta_propria";
  temMei: boolean;
  uf: string;
  atividades: Atividade[];
  /** Meses de atividade no ano, de 1 a 12. Ausente significa o ano inteiro. */
  mesesDeAtividadeNoAno?: number;
  /** Situação da inscrição estadual. Ausente significa que ainda não foi consultada. */
  inscricaoEstadualAtiva?: boolean;
  /** Pessoa física que escolheu o regime regular de IBS/CBS. */
  optouRegimeRegular?: boolean;
}

/** Parâmetros legais, sempre vindos da base de regras. */
export interface ParametrosDoMotor {
  limiteMeiAnual: Record<string, { valor: DecimalTexto; regra: string }>;
  fracaoLimiteNano: { valor: DecimalTexto; regra: string };
  fracaoReceitaTransporteEntrega: { valor: DecimalTexto; regra: string };
}

export type CodigoAlerta =
  | "CADESP_OBRIGATORIO"
  | "CADESP_NAO_CONSULTADO"
  | "REVENDA_PF_CONTRIBUINTE_ICMS"
  | "REMESSA_VEDADA_SEM_CADESP"
  | "INTERMEDIACAO_ANALISAR_COMO_SERVICO"
  | "MEI_ACIMA_DO_LIMITE"
  | "REGISTRAR_VENDAS_PF"
  | "GUARDAR_NOTAS_DE_COMPRA"
  | "ISS_MUNICIPAL_A_VERIFICAR"
  | "ACOMPANHAR_CNPJ_TECNICO";

export interface Alerta {
  codigo: CodigoAlerta;
  /** Regra que sustenta o alerta. */
  regra: string;
}

/** Situação que o motor reconhece mas para a qual ainda não há regra cadastrada. */
export type Lacuna = "ICMS_UF_NAO_COBERTA";

export interface Resultado {
  trilhas: Trilha[];
  /** Soma das receitas brutas informadas. */
  receitaBrutaTotal: DecimalTexto;
  /** Receita que entra no teste do nano, depois da fração de transporte e entrega. */
  receitaComputadaNano: DecimalTexto;
  limiteMei: DecimalTexto;
  limiteNano: DecimalTexto;
  /** Regras usadas para chegar ao resultado. */
  regrasAplicadas: string[];
  /** Regras pendentes ou a confirmar que podem mudar este resultado. */
  pendencias: string[];
  alertas: Alerta[];
  /** O que o motor não soube avaliar por falta de regra. A interface deve mostrar e chamar um contador. */
  lacunas: Lacuna[];
}
