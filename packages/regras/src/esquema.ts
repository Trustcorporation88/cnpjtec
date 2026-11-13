import { z } from "zod";

/** Situação da regra no ordenamento. */
export const StatusRegra = z.enum([
  "EM_VIGOR",
  "EFEITO_FUTURO",
  "PENDENTE",
  "ANUNCIADO",
  "A_CONFIRMAR",
  "ESTIMATIVA",
]);

/** Até onde a fonte foi conferida por nós. */
export const Conferencia = z.enum([
  "OFICIAL",
  "SECUNDARIA",
  "NAO_CONFERIDA",
  "SEM_NORMA",
]);

export const TrilhaRegra = z.enum(["A", "B", "C", "D", "E", "TODAS"]);

const DataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const DecimalTexto = z.string().regex(/^\d+(\.\d+)?$/);

export const Regra = z
  .object({
    id: z.string().regex(/^R\d{2}$/),
    trilhas: z.array(TrilhaRegra).min(1),
    regra: z.string().min(10),
    vigenciaInicio: DataIso.nullable(),
    vigenciaFim: DataIso.nullable(),
    fonte: z.string().min(3),
    status: StatusRegra,
    conferencia: Conferencia,
    observacao: z.string().optional(),
  })
  .strict();

const Parametro = z
  .object({ valor: DecimalTexto, regra: z.string().regex(/^R\d{2}$/) })
  .strict();

export const Parametros = z
  .object({
    /** Limite anual de receita bruta do MEI, por ano-calendário. */
    limiteMeiAnual: z.record(z.string().regex(/^\d{4}$/), Parametro),
    /** Fração do limite do MEI que define o teto do nanoempreendedor. */
    fracaoLimiteNano: Parametro,
    /** Fração da receita de transporte de passageiros e entrega que entra no teste do nano. */
    fracaoReceitaTransporteEntrega: Parametro,
    /** Salário mínimo por ano-calendário, base do INSS do MEI. */
    salarioMinimo: z.record(z.string().regex(/^\d{4}$/), Parametro),
    fracaoInssMei: Parametro,
    icmsMei: Parametro,
    issMei: Parametro,
  })
  .strict();

export const BaseDeRegras = z
  .object({
    versao: z.string(),
    atualizadoEm: DataIso,
    parametros: Parametros,
    regras: z.array(Regra).min(1),
  })
  .strict();

export type Regra = z.infer<typeof Regra>;
export type Parametros = z.infer<typeof Parametros>;
export type BaseDeRegras = z.infer<typeof BaseDeRegras>;
export type StatusRegra = z.infer<typeof StatusRegra>;
export type Conferencia = z.infer<typeof Conferencia>;
