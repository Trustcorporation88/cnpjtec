import type { Declaracao } from "@cnpjtec/motor-regras";
import { mostrarValor } from "./dinheiro";

/** Serviço oficial da declaração anual do MEI no gov.br, com o caminho até o Portal do Simples e o app MEI. */
export const SERVICO_DASN = "https://www.gov.br/pt-br/servicos/declarar-receita-bruta-anual-para-o-mei";

export const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "fevereiro", "fevereiro e abril", "fevereiro, abril e maio". */
export function listarMeses(meses: number[]): string {
  const nomes = meses.map((m) => MESES[m - 1]!);
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

function dataBr(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** Frase sobre o prazo, conforme a data de hoje. */
export function fraseDoPrazo(d: Declaracao): string {
  const prazo = dataBr(d.prazo);
  if (d.situacao === "ano_em_curso") {
    return `${d.anoCalendario} ainda não acabou, então estes números são uma prévia. A entrega abre em janeiro de ${d.anoCalendario + 1} e vai até ${prazo}.`;
  }
  if (d.situacao === "no_prazo") return `Entregue até ${prazo}. Depois disso há multa.`;
  return `O prazo acabou em ${prazo}. Entregue o quanto antes: a multa mínima é de R$ 50,00 e cai pela metade se for paga em até 30 dias.`;
}

/** Aviso sobre o limite do MEI, ou nulo quando ficou dentro. */
export function fraseDoLimite(d: Declaracao): string | null {
  if (d.faixa === "excesso_ate_20") {
    return `Você passou do limite do MEI (${mostrarValor(d.limite)}) em ${mostrarValor(d.excedente)}. A declaração ainda é aceita, mas gera uma guia a mais sobre o que passou, e você deixa de ser MEI em 1º de janeiro de ${d.anoCalendario + 1}. Fale com um contador antes de entregar.`;
  }
  if (d.faixa === "excesso_acima_20") {
    return `Você passou do limite do MEI (${mostrarValor(d.limite)}) em mais de 20%. Nesse caso a declaração de MEI não é aceita e você deixa de ser MEI desde janeiro de ${d.anoCalendario}. Procure um contador agora.`;
  }
  return null;
}

/** Frase sobre os meses fechados sem nenhuma venda anotada, ou nulo. */
export function fraseDosMeses(d: Declaracao): string | null {
  const n = d.mesesSemAnotacao.length;
  if (n === 0 || d.quantidadeDeVendas === 0) return null;
  return `${n === 1 ? "Não há venda anotada em" : "Não há vendas anotadas em"} ${listarMeses(d.mesesSemAnotacao)}. Se vendeu nesses meses, anote antes de declarar: a declaração é de tudo o que entrou, com ou sem nota.`;
}

/** Resposta completa para o WhatsApp. {site} é trocado pelo endereço do site. */
export function textoDaDeclaracao(d: Declaracao, site: string): string {
  const linhas = [`*Declaração anual do MEI de ${d.anoCalendario}* (DASN-SIMEI)`, fraseDoPrazo(d), ""];
  if (d.quantidadeDeVendas === 0) {
    linhas.push(
      `Não há vendas anotadas em ${d.anoCalendario}. Se você não faturou nada, a declaração é entregue mesmo assim, com R$ 0,00.`,
    );
  } else {
    linhas.push(
      "Pelo seu caderno, os valores são:",
      `• Receita bruta total: *${mostrarValor(d.receitaTotal)}*`,
      `• Dessa receita, comércio e indústria: *${mostrarValor(d.receitaComercio)}*`,
      `• Serviços, só para conferir: ${mostrarValor(d.receitaServicos)}`,
    );
  }
  const limite = fraseDoLimite(d);
  if (limite) linhas.push("", `*Atenção:* ${limite} ${site}/ajuda`);
  const meses = fraseDosMeses(d);
  if (meses) linhas.push("", meses);
  if (d.vendasParaEmpresa > 0) {
    linhas.push(
      "",
      `${d.vendasParaEmpresa} ${d.vendasParaEmpresa === 1 ? "venda foi" : "vendas foram"} para empresa. Confira se a nota de cada uma foi emitida.`,
    );
  }
  linhas.push(
    "",
    "A declaração também pergunta se você teve empregado. Isso o caderno não sabe, responda na hora.",
    "",
    `A entrega é de graça, no Portal do Simples Nacional ou no app MEI. Passo a passo e versão para imprimir: ${site}/declaracao`,
  );
  return linhas.join("\n");
}
