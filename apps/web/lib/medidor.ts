import { textoDaPendencia } from "@cnpjtec/conteudo";
import { medirLimite, type ResultadoDoMedidor } from "@cnpjtec/motor-regras";
import { baseDeRegras, buscarRegra } from "@cnpjtec/regras";
import { z } from "zod";
import { TIPOS_DE_ATIVIDADE } from "./respostas";
import { citar, type RegraNaTela } from "./regras-tela";

/** Anos que o medidor sabe avaliar: os que têm limite do MEI cadastrado. */
export function anosDisponiveis(): number[] {
  return Object.keys(baseDeRegras.parametros.limiteMeiAnual).map(Number).sort();
}

export const PedidoDoMedidor = z
  .object({
    anoCalendario: z.number().int(),
    temMei: z.boolean(),
    mesInicio: z.number().int().min(1).max(12).default(1),
    receitas: z
      .array(
        z
          .object({
            mes: z.number().int().min(1).max(12),
            tipo: z.enum(TIPOS_DE_ATIVIDADE),
            valor: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
          })
          .strict(),
      )
      .min(1)
      .max(12 * TIPOS_DE_ATIVIDADE.length),
  })
  .strict();

export type PedidoDoMedidor = z.infer<typeof PedidoDoMedidor>;

export interface RespostaDoMedidor {
  resultado: ResultadoDoMedidor;
  semDefinicao: { texto: string; regra: string }[];
  regras: RegraNaTela[];
  versaoDasRegras: string;
}

export function medir(pedido: PedidoDoMedidor): RespostaDoMedidor {
  const resultado = medirLimite(pedido, baseDeRegras.parametros);
  return {
    resultado,
    semDefinicao: resultado.pendencias.map((id) => ({
      texto: textoDaPendencia[id] ?? buscarRegra(id).regra,
      regra: id,
    })),
    regras: citar([...resultado.regrasAplicadas, ...resultado.pendencias]),
    versaoDasRegras: baseDeRegras.versao,
  };
}
