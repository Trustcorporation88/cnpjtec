import { montarDiagnostico, type Diagnostico } from "@cnpjtec/conteudo";
import { classificar, receitaAnualDeMedia, type Perfil } from "@cnpjtec/motor-regras";
import { baseDeRegras } from "@cnpjtec/regras";
import { z } from "zod";

/** Ano que o Raio-X avalia. Não é valor legal: é a escolha do produto para esta versão. */
export const ANO_AVALIADO = Number(process.env.ANO_AVALIADO ?? 2027);

export const TIPOS_DE_ATIVIDADE = [
  "transporte_passageiros",
  "entrega_de_bens",
  "servico",
  "revenda_mercadoria",
  "intermediacao_comissao",
] as const;

const SimNao = z.enum(["sim", "nao", "nao_sei"]);

export const Respostas = z
  .object({
    vinculo: z.enum(["somente_empregado", "conta_propria"]),
    temMei: SimNao.optional(),
    atividades: z
      .array(
        z
          .object({
            tipo: z.enum(TIPOS_DE_ATIVIDADE),
            mediaMensal: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
          })
          .strict(),
      )
      .max(TIPOS_DE_ATIVIDADE.length)
      .default([]),
    uf: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default("SP"),
    inscricaoEstadual: SimNao.optional(),
  })
  .strict()
  .refine((r) => new Set(r.atividades.map((a) => a.tipo)).size === r.atividades.length, {
    message: "Cada tipo de atividade só pode aparecer uma vez.",
  })
  .refine((r) => r.vinculo === "somente_empregado" || r.atividades.length > 0, {
    message: "Informe ao menos uma atividade.",
  });

export type Respostas = z.infer<typeof Respostas>;

export interface RespostaDoRaioX {
  ano: number;
  versaoDasRegras: string;
  diagnostico: Diagnostico;
  /** Avisos sobre como as respostas foram interpretadas. */
  observacoes: string[];
}

/** Converte as respostas do questionário em perfil, roda o motor e monta o diagnóstico. */
export function diagnosticar(respostas: Respostas): RespostaDoRaioX {
  const observacoes: string[] = [];
  if (respostas.temMei === "nao_sei") {
    observacoes.push(
      "Você não soube dizer se tem MEI. Fizemos a conta como se não tivesse. Se descobrir que tem, refaça as perguntas.",
    );
  }
  observacoes.push(
    `A conta considera o ano inteiro de ${ANO_AVALIADO}, com a média mensal que você informou.`,
  );

  const perfil: Perfil = {
    anoCalendario: ANO_AVALIADO,
    vinculo: respostas.vinculo,
    temMei: respostas.temMei === "sim",
    uf: respostas.uf,
    atividades: respostas.atividades.map((a) => ({
      tipo: a.tipo,
      receitaBrutaAnual: receitaAnualDeMedia(a.mediaMensal, 12),
    })),
    ...(respostas.inscricaoEstadual === "sim" ? { inscricaoEstadualAtiva: true } : {}),
    ...(respostas.inscricaoEstadual === "nao" ? { inscricaoEstadualAtiva: false } : {}),
  };

  const resultado = classificar(perfil, baseDeRegras.parametros);
  return {
    ano: ANO_AVALIADO,
    versaoDasRegras: baseDeRegras.versao,
    diagnostico: montarDiagnostico(resultado),
    observacoes,
  };
}
