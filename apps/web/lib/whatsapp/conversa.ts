import { AJUDA_CODIGOS } from "./codigos";
import { cnpjValido, configuracaoDas } from "../das/procontador";
import { comandoDoCaderno, type Pendente } from "./caderno";
import { lerValor, mostrarValor } from "../dinheiro";
import { diagnosticar, TIPOS_DE_ATIVIDADE, type Respostas } from "../respostas";

/**
 * Conversa guiada do WhatsApp. Só números como resposta, sem IA: o motor de regras decide,
 * aqui apenas fazemos as perguntas e devolvemos o diagnóstico em texto curto.
 */

type Tipo = (typeof TIPOS_DE_ATIVIDADE)[number];
type SimNao = "sim" | "nao" | "nao_sei";

export type Etapa = "menu" | "das_cnpj" | "consentir_conta" | "vinculo" | "temMei" | "atividade" | "valor" | "outra" | "uf" | "ie";

export interface Estado {
  etapa: Etapa;
  vinculo?: "somente_empregado" | "conta_propria";
  temMei?: SimNao;
  atividades: { tipo: Tipo; mediaMensal: string }[];
  tipoAtual?: Tipo;
  uf?: string;
  /** Venda ou nota esperando o "sim" para criar a conta. */
  pendente?: Pendente;
}

export interface Resposta {
  /** Estado a guardar para a próxima mensagem. Indefinido encerra a conversa. */
  estado: Estado | undefined;
  mensagens: string[];
  /** Trabalho a fazer depois de responder, fora da conversa (consulta demorada). */
  acao?: { tipo: "consultar_das"; cnpj: string };
}

const PGMEI =
  "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao";

const ATIVIDADES: Record<Tipo, { rotulo: string; nome: string; dica: string }> = {
  transporte_passageiros: {
    rotulo: "Levo passageiros por aplicativo",
    nome: "as corridas",
    dica: "Some tudo, antes de tirar gasolina e a taxa do aplicativo.",
  },
  entrega_de_bens: {
    rotulo: "Faço entregas",
    nome: "as entregas",
    dica: "Some tudo, antes de tirar gasolina e a taxa do aplicativo.",
  },
  servico: {
    rotulo: "Presto serviço (manicure, diarista, pedreiro, aula)",
    nome: "os seus serviços",
    dica: "Some tudo o que entra, antes de tirar os gastos.",
  },
  revenda_mercadoria: {
    rotulo: "Compro produtos para revender (Natura, Avon, bebidas, roupas)",
    nome: "as suas vendas",
    dica: "Coloque o total das vendas, e não o lucro.",
  },
  intermediacao_comissao: {
    rotulo: "Vendo por comissão, sem comprar o produto",
    nome: "as comissões",
    dica: "Coloque o total de comissão que você recebe.",
  },
};

const UFS = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "),
);

function site(): string {
  return (process.env.SITE_URL ?? "https://app.procontador.com.br").replace(/\/$/, "");
}

function menu(comIa = process.env.ANTHROPIC_API_KEY ? true : false): string {
  return [
    "Olá! Aqui é o ProContador. Eu explico, em palavras simples, o que você precisa fazer com o governo para trabalhar por conta própria.",
    "",
    "Responda só com o número:",
    "1. Fazer o Raio-X (leva 2 minutos)",
    "2. Boleto do DAS (guia mensal do MEI)",
    "3. Entender o CNPJ técnico",
    "4. Anotar vendas e ver o limite do MEI",
    "5. Códigos da nota de serviço (IBS e CBS, 2027)",
    ...(comIa ? ["", "Ou escreva a sua dúvida do seu jeito."] : []),
    "",
    "Mande 0 a qualquer momento para voltar a este menu, ou sair para encerrar.",
  ].join("\n");
}

const PERGUNTA_VINCULO = [
  "Você ganha dinheiro por conta própria?",
  "",
  "1. Sim, trabalho por conta própria (aplicativo, venda, serviço)",
  "2. Não, só tenho emprego de carteira assinada",
].join("\n");

const PERGUNTA_MEI = ["Você já tem MEI?", "", "1. Sim", "2. Não", "3. Não sei"].join("\n");

function perguntaAtividade(jaTem: Tipo[]): { texto: string; opcoes: Tipo[] } {
  const opcoes = TIPOS_DE_ATIVIDADE.filter((t) => !jaTem.includes(t));
  const linhas = opcoes.map((t, i) => `${i + 1}. ${ATIVIDADES[t].rotulo}`);
  const titulo = jaTem.length === 0 ? "Como você ganha dinheiro?" : "Qual é o outro jeito que você ganha dinheiro?";
  return { texto: [titulo, "", ...linhas].join("\n"), opcoes };
}

function perguntaValor(tipo: Tipo): string {
  const a = ATIVIDADES[tipo];
  return [
    `Quanto entra por mês, em média, com ${a.nome}?`,
    a.dica,
    "",
    "Digite só o valor. Exemplo: 2500 ou 2.500,00",
  ].join("\n");
}

const PERGUNTA_OUTRA = ["Você ganha dinheiro de outro jeito também?", "", "1. Sim", "2. Não"].join("\n");
const PERGUNTA_UF = "Em qual estado você trabalha? Digite a sigla. Exemplo: SP";
const PERGUNTA_IE = [
  "Você tem inscrição estadual ativa? Ela aparece no cadastro de quem vende produtos (no estado de SP, é o CADESP).",
  "",
  "1. Sim",
  "2. Não",
  "3. Não sei",
].join("\n");

const NAO_ENTENDI = "Não entendi. Responda só com o número de uma das opções.";

function simNao(texto: string): SimNao | null {
  return texto === "1" ? "sim" : texto === "2" ? "nao" : texto === "3" ? "nao_sei" : null;
}

/** Tira acentos, espaços extras e pontuação final, para comparar respostas curtas. */
export function limpar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[.!?]+$/, "")
    .toLowerCase();
}

function lista(titulo: string, itens: string[], maximo: number): string[] {
  if (itens.length === 0) return [];
  const mostrados = itens.slice(0, maximo).map((t) => `• ${t}`);
  return ["", titulo, ...mostrados];
}

/** Texto final do Raio-X, curto o bastante para uma mensagem de WhatsApp. */
export function textoDoResultado(respostas: Respostas): string {
  const r = diagnosticar(respostas);
  const d = r.diagnostico;
  const linhas = [
    `*${d.titulo}*`,
    d.resumo,
    ...lista("*O que fazer agora*", d.fazerAgora.map((f) => f.texto), 5),
    ...lista("*O que você não precisa fazer*", d.naoPrecisa.map((f) => f.texto), 3),
    ...lista("*Ainda sem definição do governo*", d.semDefinicao.map((f) => f.texto), 2),
    ...lista("*Vale falar com um contador*", d.comContador.map((f) => f.texto), 2),
  ];
  if (respostas.vinculo === "conta_propria") {
    linhas.push(
      "",
      `Na conta: ${mostrarValor(d.numeros.receitaBrutaTotal)} por ano. Limite do MEI: ${mostrarValor(d.numeros.limiteMei)}.`,
    );
  }
  linhas.push(
    "",
    ...r.observacoes,
    "",
    `Veja o resultado completo, com as leis citadas: ${site()}`,
    "",
    "Mande 0 para voltar ao menu.",
  );
  return linhas.join("\n");
}

function concluir(estado: Estado, inscricaoEstadual?: SimNao): Resposta {
  const respostas: Respostas = {
    vinculo: estado.vinculo ?? "conta_propria",
    atividades: estado.atividades,
    uf: estado.uf ?? "SP",
    ...(estado.temMei ? { temMei: estado.temMei } : {}),
    ...(inscricaoEstadual ? { inscricaoEstadual } : {}),
  };
  return { estado: { etapa: "menu", atividades: [] }, mensagens: [textoDoResultado(respostas)] };
}

const VOLTAR = new Set(["0", "menu", "inicio", "voltar", "procontador", "oi", "ola", "bom dia", "boa tarde", "boa noite"]);

/** Pedido do boleto escrito com palavras, no lugar do número 2. */
export function pedeBoletoDoDas(recebido: string): boolean {
  return /\b(das|boleto|guia)\b/.test(limpar(recebido));
}

/** Verdadeiro quando, no menu, o texto não é uma opção nem um comando: vira pergunta livre. */
export function ehPerguntaLivre(estado: Estado | undefined, recebido: string): boolean {
  if (!estado || estado.etapa !== "menu") return false;
  const texto = limpar(recebido);
  if (VOLTAR.has(texto) || texto === "sair" || texto === "encerrar") return false;
  if (/^\d{1,2}$/.test(texto)) return false;
  if (pedeBoletoDoDas(recebido)) return false;
  if (comandoDoCaderno(recebido)) return false;
  return texto.length >= 4;
}

/** Recebe o texto de uma mensagem e o estado guardado; devolve o que responder e o novo estado. */
export function responder(anterior: Estado | undefined, recebido: string): Resposta {
  const texto = limpar(recebido);

  if (texto === "sair" || texto === "encerrar") {
    return {
      estado: undefined,
      mensagens: ["Pronto, você saiu do ProContador. Para voltar, mande *procontador*."],
    };
  }

  if (!anterior || VOLTAR.has(texto)) {
    return { estado: { etapa: "menu", atividades: [] }, mensagens: [menu()] };
  }

  const estado: Estado = { ...anterior, atividades: [...anterior.atividades] };
  if (estado.etapa === "menu" && pedeBoletoDoDas(recebido)) return responder(estado, "2");

  switch (estado.etapa) {
    case "menu": {
      if (texto === "5") return { estado, mensagens: [AJUDA_CODIGOS] };
      if (texto === "1") {
        return { estado: { etapa: "vinculo", atividades: [] }, mensagens: [PERGUNTA_VINCULO] };
      }
      if (texto === "2" && configuracaoDas()) {
        return {
          estado: { etapa: "das_cnpj", atividades: [] },
          mensagens: [
            [
              "Mande o CNPJ do seu MEI (14 números). Eu consulto no PGMEI, o programa oficial da Receita, o que está pago e o que está em aberto neste ano.",
              "",
              "Não precisa de senha. Nunca passe a sua senha gov.br para ninguém.",
            ].join("\n"),
          ],
        };
      }
      if (texto === "2") {
        return {
          estado,
          mensagens: [
            [
              "A guia do MEI (DAS) sai no programa oficial da Receita, o PGMEI. Não precisa de senha, só do número do CNPJ (14 números, estão no certificado do MEI e em qualquer guia antiga).",
              "",
              PGMEI,
              "",
              `Passo a passo com figuras: ${site()}/das`,
              "",
              "Cuidado: ninguém do ProContador pede a sua senha gov.br. Nunca passe a senha por mensagem.",
              "",
              "Mande 0 para voltar ao menu.",
            ].join("\n"),
          ],
        };
      }
      if (texto === "3") {
        return {
          estado,
          mensagens: [
            [
              "O CNPJ técnico é o cadastro para quem trabalha por conta própria e ganha pouco, abaixo da metade do limite do MEI. A ideia é que essa pessoa fique registrada sem virar empresa e sem pagar a guia do MEI.",
              "",
              "Parte das regras ainda depende da Receita Federal. Faça o Raio-X (opção 1 do menu) para saber se você se encaixa, e veja o caminho e o que já dá para fazer hoje:",
              `${site()}/cnpj-tecnico`,
              "",
              "Mande 0 para voltar ao menu.",
            ].join("\n"),
          ],
        };
      }
      return { estado, mensagens: [NAO_ENTENDI, menu()] };
    }

    case "consentir_conta":
      return { estado: { etapa: "menu", atividades: [] }, mensagens: [menu()] };

    case "das_cnpj": {
      const cnpj = cnpjValido(recebido);
      if (!cnpj) {
        return {
          estado,
          mensagens: ["Esse CNPJ não confere. Mande os 14 números, do jeito que estão no certificado do MEI. Ou mande 0 para voltar."],
        };
      }
      return {
        estado: { etapa: "menu", atividades: [] },
        mensagens: ["Certo. Estou consultando o PGMEI agora. Leva de 1 a 5 minutos, e eu te mando o resultado aqui."],
        acao: { tipo: "consultar_das", cnpj },
      };
    }

    case "vinculo": {
      if (texto === "2") {
        estado.vinculo = "somente_empregado";
        return concluir(estado);
      }
      if (texto === "1") {
        estado.vinculo = "conta_propria";
        estado.etapa = "temMei";
        return { estado, mensagens: [PERGUNTA_MEI] };
      }
      return { estado, mensagens: [NAO_ENTENDI, PERGUNTA_VINCULO] };
    }

    case "temMei": {
      const v = simNao(texto);
      if (!v) return { estado, mensagens: [NAO_ENTENDI, PERGUNTA_MEI] };
      estado.temMei = v;
      estado.etapa = "atividade";
      return { estado, mensagens: [perguntaAtividade([]).texto] };
    }

    case "atividade": {
      const { texto: pergunta, opcoes } = perguntaAtividade(estado.atividades.map((a) => a.tipo));
      const escolha = opcoes[Number(texto) - 1];
      if (!/^\d+$/.test(texto) || !escolha) return { estado, mensagens: [NAO_ENTENDI, pergunta] };
      estado.tipoAtual = escolha;
      estado.etapa = "valor";
      return { estado, mensagens: [perguntaValor(escolha)] };
    }

    case "valor": {
      const tipo = estado.tipoAtual;
      if (!tipo) return { estado: { etapa: "menu", atividades: [] }, mensagens: [menu()] };
      const valor = lerValor(recebido.trim());
      if (!valor || Number(valor) <= 0) {
        return {
          estado,
          mensagens: ["Não consegui ler esse valor. Digite só o número. Exemplo: 2500 ou 2.500,00"],
        };
      }
      estado.atividades.push({ tipo, mediaMensal: valor });
      delete estado.tipoAtual;
      if (estado.atividades.length >= TIPOS_DE_ATIVIDADE.length) {
        estado.etapa = "uf";
        return { estado, mensagens: [PERGUNTA_UF] };
      }
      estado.etapa = "outra";
      return { estado, mensagens: [PERGUNTA_OUTRA] };
    }

    case "outra": {
      if (texto === "1") {
        estado.etapa = "atividade";
        return { estado, mensagens: [perguntaAtividade(estado.atividades.map((a) => a.tipo)).texto] };
      }
      if (texto === "2") {
        estado.etapa = "uf";
        return { estado, mensagens: [PERGUNTA_UF] };
      }
      return { estado, mensagens: [NAO_ENTENDI, PERGUNTA_OUTRA] };
    }

    case "uf": {
      const uf = texto.toUpperCase();
      if (!UFS.has(uf)) return { estado, mensagens: ["Não reconheci esse estado. Digite a sigla. Exemplo: SP"] };
      estado.uf = uf;
      if (estado.atividades.some((a) => a.tipo === "revenda_mercadoria")) {
        estado.etapa = "ie";
        return { estado, mensagens: [PERGUNTA_IE] };
      }
      return concluir(estado);
    }

    case "ie": {
      const v = simNao(texto);
      if (!v) return { estado, mensagens: [NAO_ENTENDI, PERGUNTA_IE] };
      return concluir(estado, v);
    }
  }
}
