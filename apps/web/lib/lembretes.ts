import { prepararDeclaracao, type Venda } from "@cnpjtec/motor-regras";
import { baseDeRegras } from "@cnpjtec/regras";
import { mostrarValor } from "./dinheiro";
import { MESES } from "./declaracao";

/** Quem pediu lembretes, com as vendas do caderno (ano corrente e anterior). */
export interface Assinante {
  telefone: string;
  das: boolean;
  declaracao: boolean;
  limite: boolean;
  vendas: Venda[];
}

/** Um lembrete a enviar. A chave impede que o mesmo lembrete saia duas vezes. */
export interface Lembrete {
  chave: string;
  texto: string;
}

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RODAPE = "Para não receber mais, mande *parar lembretes*.";

/**
 * Lembretes devidos hoje para uma pessoa. Puro: a data vem de fora e o resultado não depende de
 * relógio nem de banco. Janelas de vários dias com chave única fazem o lembrete sair uma vez só,
 * mesmo que o disparo de um dia falhe.
 */
export function lembretesDoDia(a: Assinante, hoje: string, site: string): Lembrete[] {
  const m = DATA.exec(hoje);
  if (!m) throw new Error("Data inválida.");
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const lista: Lembrete[] = [];

  // DAS: vence no dia 20 (regra R32). Aviso a partir do dia 15, uma vez por mês.
  if (a.das && dia >= 15 && dia <= 20) {
    const competencia = mes === 1 ? `dezembro de ${ano - 1}` : `${MESES[mes - 2]} de ${ano}`;
    lista.push({
      chave: `das:${ano}-${String(mes).padStart(2, "0")}`,
      texto: [
        `*Lembrete do ProContador:* a guia do MEI (DAS) de ${competencia} vence no dia 20/${String(mes).padStart(2, "0")}.`,
        "",
        "Mande *2* aqui para eu consultar o que está pago e o que está em aberto, ou gere a guia de graça no PGMEI. (regra R32)",
        "",
        RODAPE,
      ].join("\n"),
    });
  }

  // Declaração anual: até 31 de maio (regra R33). Aviso em março e de novo a partir de 15 de maio.
  if (a.declaracao && (mes === 3 || (mes === 5 && dia >= 15))) {
    const anoDeclarado = ano - 1;
    const d = prepararDeclaracao({ vendas: a.vendas, anoCalendario: anoDeclarado, hoje }, baseDeRegras.parametros);
    const valores =
      d.quantidadeDeVendas > 0
        ? `Pelo seu caderno, a receita bruta de ${anoDeclarado} foi de ${mostrarValor(d.receitaTotal)}.`
        : `Não há vendas anotadas em ${anoDeclarado}. Se você não faturou, a declaração sai com R$ 0,00.`;
    lista.push({
      chave: `dasn:${anoDeclarado}:${mes === 3 ? "mar" : "mai"}`,
      texto: [
        `*Lembrete do ProContador:* a declaração anual do MEI de ${anoDeclarado} vai até 31/05/${ano}.${mes === 5 ? " Falta pouco." : ""}`,
        "",
        valores,
        `Mande *declaração* para ver os valores prontos para copiar, ou abra ${site}/declaracao (regra R33).`,
        "",
        RODAPE,
      ].join("\n"),
    });
  }

  // Limite do MEI no ano corrente: aviso ao passar de 80% e ao passar de 100%.
  if (a.limite && a.vendas.some((v) => v.data.startsWith(`${ano}-`))) {
    const d = prepararDeclaracao({ vendas: a.vendas, anoCalendario: ano, hoje }, baseDeRegras.parametros);
    const total = Number(d.receitaTotal);
    const limite = Number(d.limite);
    const parte = Math.floor((total / limite) * 100);
    if (d.faixa !== "dentro") {
      lista.push({
        chave: `limite100:${ano}`,
        texto: [
          `*Atenção:* pelo seu caderno, você já vendeu ${mostrarValor(d.receitaTotal)} em ${ano} e passou do limite do MEI (${mostrarValor(d.limite)}).`,
          "",
          d.faixa === "excesso_ate_20"
            ? `Passando até 20%, você paga uma guia a mais sobre o excesso e deixa de ser MEI em 1º de janeiro de ${ano + 1}. (regra R38)`
            : `Acima de 20%, você deixa de ser MEI desde janeiro de ${ano}. (regra R38)`,
          `Fale com um contador antes de vender mais: ${site}/ajuda`,
          "",
          RODAPE,
        ].join("\n"),
      });
    } else if (parte >= 80) {
      lista.push({
        chave: `limite80:${ano}`,
        texto: [
          `*Lembrete do ProContador:* pelo seu caderno, você já usou ${parte}% do limite do MEI em ${ano} (${mostrarValor(d.receitaTotal)} de ${mostrarValor(d.limite)}).`,
          "",
          `Mande *minhas vendas* para ver a projeção do ano, ou abra ${site}/limite (regra ${d.regrasAplicadas[1]}).`,
          "",
          RODAPE,
        ].join("\n"),
      });
    }
  }

  return lista;
}

export const TEXTO_LEMBRETES_LIGADOS = [
  "*Lembretes ligados.* Eu aviso aqui:",
  "• alguns dias antes do dia 20, quando vence a guia do MEI (DAS);",
  "• em março e em maio, sobre a declaração anual;",
  "• quando suas vendas anotadas passarem de 80% e de 100% do limite do MEI.",
  "",
  "Para parar, mande *parar lembretes*.",
].join("\n");

/** Entende "lembretes", "quero lembretes", "parar lembretes" e parecidos. */
export function comandoDeLembretes(texto: string): "ligar" | "desligar" | null {
  if (/^(parar|cancelar|desligar|desativar|sair dos|nao quero|nao quero mais)( os)? (lembretes?|avisos?)$/.test(texto)) return "desligar";
  if (/^((quero|ligar|ativar|receber)( os)? )?(lembretes?|avisos?)$/.test(texto)) return "ligar";
  return null;
}
