/**
 * Contrato das ferramentas que o agente pode chamar pela API da Anthropic (tool use).
 *
 * Este arquivo define só o contrato. A implementação de cada ferramenta fica no servidor
 * e é a única parte que toca motor de regras, banco e integrações oficiais.
 */

/** O que a ferramenta faz no mundo. Decide o nível de confirmação exigido. */
export type Efeito =
  /** Só lê. Pode ser chamada livremente. */
  | "leitura"
  /** Grava dado do usuário dentro do produto. */
  | "registro"
  /** Gera efeito oficial ou financeiro fora do produto. Exige confirmação registrada. */
  | "oficial";

export interface EsquemaObjeto {
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required: string[];
  additionalProperties: false;
}

export interface Ferramenta {
  name: string;
  description: string;
  input_schema: EsquemaObjeto;
  efeito: Efeito;
  exigeConfirmacao: boolean;
}

const texto = (description: string) => ({ type: "string", description });
const decimal = (description: string) => ({
  type: "string",
  pattern: "^\\d+(\\.\\d{1,2})?$",
  description,
});
const competencia = { type: "string", pattern: "^\\d{4}-\\d{2}$", description: "Mês no formato AAAA-MM." };

function ferramenta(
  name: string,
  efeito: Efeito,
  description: string,
  properties: Record<string, Record<string, unknown>>,
  required: string[],
): Ferramenta {
  return {
    name,
    description,
    efeito,
    exigeConfirmacao: efeito === "oficial",
    input_schema: { type: "object", properties, required, additionalProperties: false },
  };
}

export const ferramentas: Ferramenta[] = [
  ferramenta(
    "buscar_regra",
    "leitura",
    "Devolve o texto, a fonte, a vigência e o status de uma regra pelo identificador. Use antes de afirmar qualquer obrigação.",
    { id: texto("Identificador da regra, como R07.") },
    ["id"],
  ),
  ferramenta(
    "classificar_situacao",
    "leitura",
    "Roda o motor de regras com o perfil atual da pessoa e devolve trilhas, alertas, regras usadas, pendências e lacunas. É a única fonte para dizer em que situação a pessoa está.",
    {},
    [],
  ),
  ferramenta(
    "calcular_limite",
    "leitura",
    "Devolve quanto a pessoa já faturou no ano, o limite aplicável e quanto falta, calculados pelo motor.",
    { ano: { type: "integer", description: "Ano-calendário." } },
    ["ano"],
  ),
  ferramenta(
    "simular_regime",
    "leitura",
    "Compara continuar como nano, virar MEI ou ir para o regime regular, com os valores calculados pelo motor.",
    { receitaAnualEstimada: decimal("Receita bruta estimada para o ano.") },
    ["receitaAnualEstimada"],
  ),
  ferramenta(
    "atualizar_perfil",
    "registro",
    "Grava no perfil um dado que a pessoa informou ou confirmou, como atividade, receita, UF ou se tem MEI.",
    {
      campo: {
        type: "string",
        enum: ["vinculo", "temMei", "uf", "municipio", "atividade", "mesesDeAtividadeNoAno", "optouRegimeRegular"],
      },
      valor: texto("Valor informado pela pessoa."),
    },
    ["campo", "valor"],
  ),
  ferramenta(
    "consultar_cnpj",
    "leitura",
    "Consulta a situação cadastral e a opção pelo SIMEI de um CNPJ em fonte oficial.",
    { cnpj: texto("CNPJ com 14 dígitos.") },
    ["cnpj"],
  ),
  ferramenta(
    "consultar_cadesp",
    "leitura",
    "Consulta na Sefaz-SP se o CNPJ tem inscrição estadual e qual a situação.",
    { cnpj: texto("CNPJ com 14 dígitos.") },
    ["cnpj"],
  ),
  ferramenta(
    "listar_das_em_aberto",
    "leitura",
    "Lista as guias DAS do MEI em aberto ou em atraso.",
    {},
    [],
  ),
  ferramenta(
    "gerar_das",
    "oficial",
    "Gera a guia DAS do MEI de um mês e devolve o código de barras e o PDF.",
    { competencia },
    ["competencia"],
  ),
  ferramenta(
    "preparar_dasn",
    "leitura",
    "Monta o rascunho da DASN-SIMEI com as receitas registradas e devolve o resumo para conferência.",
    { ano: { type: "integer", description: "Ano-calendário da declaração." } },
    ["ano"],
  ),
  ferramenta(
    "transmitir_dasn",
    "oficial",
    "Transmite a DASN-SIMEI já conferida pela pessoa.",
    { ano: { type: "integer", description: "Ano-calendário da declaração." } },
    ["ano"],
  ),
  ferramenta(
    "emitir_nfse",
    "oficial",
    "Emite uma NFS-e no emissor nacional com os dados conferidos pela pessoa.",
    {
      tomadorDocumento: texto("CPF ou CNPJ de quem contratou o serviço."),
      tomadorNome: texto("Nome de quem contratou o serviço."),
      valor: decimal("Valor do serviço."),
      descricao: texto("Descrição do serviço prestado."),
    },
    ["tomadorDocumento", "tomadorNome", "valor", "descricao"],
  ),
  ferramenta(
    "registrar_venda",
    "registro",
    "Registra uma venda ou serviço no controle da pessoa, para o relatório mensal e a DASN-SIMEI.",
    {
      data: { type: "string", format: "date", description: "Data da venda." },
      valor: decimal("Valor recebido."),
      tipo: { type: "string", enum: ["mercadoria", "servico"] },
      compradorTemCnpj: { type: "boolean", description: "Se quem comprou é empresa." },
      descricao: texto("O que foi vendido."),
    },
    ["data", "valor", "tipo", "compradorTemCnpj"],
  ),
  ferramenta(
    "guardar_documento",
    "registro",
    "Guarda no Cofre de Provas um documento enviado pela pessoa, com os campos lidos e já confirmados por ela.",
    {
      arquivoId: texto("Identificador do arquivo recebido."),
      tipo: {
        type: "string",
        enum: ["nfe_compra", "danfe", "pedido", "comprovante_pagamento", "das_pago", "extrato_aplicativo", "outro"],
      },
    },
    ["arquivoId", "tipo"],
  ),
  ferramenta(
    "buscar_no_cofre",
    "leitura",
    "Procura documentos e totais no Cofre de Provas da pessoa.",
    { pergunta: texto("O que procurar, em linguagem comum.") },
    ["pergunta"],
  ),
  ferramenta(
    "emitir_passaporte",
    "registro",
    "Gera o Passaporte Fiscal da pessoa, com QR de validade curta, a partir das consultas mais recentes.",
    {},
    [],
  ),
  ferramenta(
    "acompanhar_cnpj_tecnico",
    "registro",
    "Coloca a pessoa no acompanhamento do CNPJ técnico, para avisar quando o canal oficial da Receita abrir.",
    {},
    [],
  ),
  ferramenta(
    "agendar_lembrete",
    "registro",
    "Agenda um aviso para a pessoa, como vencimento do DAS ou prazo da DASN-SIMEI.",
    {
      data: { type: "string", format: "date", description: "Dia do aviso." },
      assunto: texto("Do que se trata o aviso."),
    },
    ["data", "assunto"],
  ),
  ferramenta(
    "chamar_contador",
    "registro",
    "Passa a conversa para um contador, com o resumo do caso. Use quando não houver regra, quando houver lacuna ou quando a pessoa pedir.",
    { motivo: texto("Por que o caso precisa de um contador.") },
    ["motivo"],
  ),
];
