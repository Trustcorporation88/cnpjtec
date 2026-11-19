import { buscarServicos, tabelaDeServicos } from "@cnpjtec/regras/servicos";
import { limpar } from "./conversa";

export const AJUDA_CODIGOS = [
  "*Códigos da nota de serviço (IBS e CBS, a partir de 2027)*",
  "",
  "Mande *código* e o que você faz. Exemplos:",
  "• código manicure",
  "• código conserto de celular",
  "• código 6.01 (o código de tributação nacional que você já usa)",
  "",
  "Eu busco na tabela oficial da Receita o código de tributação nacional, a NBS, o CST, o cClassTrib e o indicador de operação.",
].join("\n");

/** Texto da busca quando a mensagem pede os códigos da nota, ou null. */
export function pedidoDeCodigos(recebido: string): string | null {
  const t = limpar(recebido);
  const m = /^(?:codigos?|nbs|cclasstrib|classificacao)(?: da nota de servico| da nota| da nfse)?(?: de| do| da| para| pra)?\s+(.+)$/.exec(t);
  return m ? m[1]!.trim() : null;
}

/** Resposta curta para o WhatsApp, com até três serviços. */
export function textoDosCodigos(consulta: string, site: string): string {
  const resultados = buscarServicos(consulta, 3);
  if (resultados.length === 0) {
    return `Não achei "${consulta}" na tabela da Receita. Tente uma palavra mais simples (por exemplo, "limpeza") ou o código de tributação nacional, como 6.01. Também dá para buscar em ${site}/nota-de-servico`;
  }
  const linhas = [`*Códigos para "${consulta}"* (tabela oficial da Receita, base ${tabelaDeServicos.versaoBase.versao})`];
  resultados.forEach((r, i) => {
    const geral = r.tributacao[0]!;
    linhas.push(
      "",
      `*${i + 1}. ${r.nbs.descricao}*`,
      `• Código de tributação nacional: ${r.item.codigo}`,
      `• NBS: ${r.nbs.codigo}`,
      `• CST ${geral.cst} e cClassTrib ${geral.cClassTrib} (${geral.cstDescricao.toLowerCase()})${r.tributacao.length > 1 ? `, há mais ${r.tributacao.length - 1} opção para casos especiais` : ""}`,
      `• Indicador de operação: ${r.operacoes.map((o) => `${o.cIndOp} (imposto para: ${o.localIncidencia.toLowerCase()})`).join(" ou ")}`,
    );
  });
  linhas.push(
    "",
    `Detalhes e botão de copiar: ${site}/nota-de-servico`,
    "Se você é MEI, o IBS e a CBS seguem dentro do DAS fixo. Na dúvida entre duas opções, fale com um contador antes de emitir.",
  );
  return linhas.join("\n");
}
