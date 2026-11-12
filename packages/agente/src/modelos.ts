/**
 * Roteamento de modelos por tipo de tarefa.
 *
 * Os identificadores vêm de variáveis de ambiente, com os padrões abaixo conferidos em
 * 12/11/2026 em platform.claude.com/docs/en/models/overview. Conferir de novo a cada fase.
 */
export type Tarefa = "triagem" | "extracao" | "conversa" | "revisao" | "legislacao";

const PADRAO: Record<Tarefa, string> = {
  triagem: "claude-haiku-5-5",
  extracao: "claude-haiku-5-5",
  conversa: "claude-sonnet-5-5",
  revisao: "claude-opus-5-5",
  legislacao: "claude-opus-5-5",
};

const VARIAVEL: Record<Tarefa, string> = {
  triagem: "MODELO_TRIAGEM",
  extracao: "MODELO_EXTRACAO",
  conversa: "MODELO_CONVERSA",
  revisao: "MODELO_REVISAO",
  legislacao: "MODELO_LEGISLACAO",
};

/** Devolve o modelo da tarefa, lendo a variável de ambiente e caindo no padrão. */
export function modeloPara(
  tarefa: Tarefa,
  ambiente: Record<string, string | undefined> = {},
): string {
  const configurado = ambiente[VARIAVEL[tarefa]];
  return configurado && configurado.trim() !== "" ? configurado.trim() : PADRAO[tarefa];
}
