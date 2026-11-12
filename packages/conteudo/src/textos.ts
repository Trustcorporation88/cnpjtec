import type { CodigoAlerta, Lacuna, Trilha } from "@cnpjtec/motor-regras";

/**
 * Textos em linguagem simples. Cada frase que afirma uma obrigação aponta a regra que a sustenta.
 * Nenhum valor em reais aparece escrito aqui: limites vêm do resultado do motor.
 * Data escrita em frase com regra precisa bater com a vigência da regra. Há teste para isso.
 */

export interface Frase {
  texto: string;
  regra?: string;
}

export interface TextoDaTrilha {
  /** Frase curta da placa, em resposta a "em que situação eu estou?". */
  titulo: string;
  resumo: string;
  fazerAgora: Frase[];
  naoPrecisa: Frase[];
}

export const textoDaTrilha: Record<Trilha, TextoDaTrilha> = {
  FORA_DO_ALCANCE: {
    titulo: "Isso não é com você.",
    resumo:
      "Quem só trabalha como empregado não entra nas regras novas de CNPJ e nota fiscal. Elas valem para quem trabalha por conta própria.",
    fazerAgora: [{ texto: "Nada. Se um dia você começar a trabalhar por conta própria, volte aqui." }],
    naoPrecisa: [
      { texto: "Não precisa de CNPJ, de MEI nem de nota fiscal por causa do seu emprego.", regra: "R01" },
    ],
  },
  A_NANO: {
    titulo: "Você está fora dos impostos novos.",
    resumo:
      "Pelo que você contou, em 2027 você fica abaixo do limite do nanoempreendedor. Nanoempreendedor é o nome que a lei dá a quem trabalha por conta própria e ganha pouco. Quem está nessa faixa não paga os dois impostos novos, o IBS e a CBS.",
    fazerAgora: [
      {
        texto:
          "Anote todo mês quanto você recebeu. O limite vale para o ano inteiro e, se você passar dele, sua situação muda.",
        regra: "R02",
      },
    ],
    naoPrecisa: [
      {
        texto: "Não precisa de CNPJ nem de nota fiscal dos impostos novos até 31/12/2028.",
        regra: "R07",
      },
      { texto: "Não precisa abrir empresa nem pagar alguém para tirar CNPJ para você." },
    ],
  },
  B_PF_CONTRIBUINTE: {
    titulo: "Você vai precisar de um CNPJ de pessoa física.",
    resumo:
      "Pelo que você contou, você passa do limite do nanoempreendedor e não tem MEI. A partir de 1/1/2027, quem está assim precisa de um CNPJ ligado ao próprio CPF, que muita gente chama de CNPJ técnico, e de nota fiscal eletrônica. Esse CNPJ não é uma empresa e não é MEI.",
    fazerAgora: [
      {
        texto:
          "Não abra empresa por causa disso. O CNPJ técnico é dado pela Receita Federal e é gratuito.",
        regra: "R11",
      },
      {
        texto:
          "Compare com virar MEI. Para muita gente o MEI sai mais simples, mas depende do tipo de trabalho e de quanto você ganha.",
      },
      { texto: "Anote todo mês quanto você recebeu e guarde os comprovantes." },
    ],
    naoPrecisa: [{ texto: "Não precisa pagar ninguém para receber o CNPJ técnico." }],
  },
  C_MEI_SERVICO: {
    titulo: "Você é MEI e continua MEI.",
    resumo:
      "Pelo que você contou, você fica dentro do limite do MEI em 2027. Suas obrigações continuam sendo as do MEI.",
    fazerAgora: [
      { texto: "Pague a guia mensal do MEI (o DAS) em dia." },
      { texto: "Confirme em janeiro que você continua no regime do MEI.", regra: "R21" },
      { texto: "Anote todo mês quanto você recebeu, para a declaração anual do MEI." },
    ],
    naoPrecisa: [{ texto: "Não precisa de CNPJ técnico. Você já tem o CNPJ do MEI." }],
  },
  D_MEI_REVENDA: {
    titulo: "Você é MEI e vende produtos.",
    resumo:
      "Pelo que você contou, você fica dentro do limite do MEI em 2027. Quem compra produtos para revender tem obrigações a mais com o estado.",
    fazerAgora: [
      { texto: "Pague a guia mensal do MEI (o DAS) em dia." },
      { texto: "Confirme em janeiro que você continua no regime do MEI.", regra: "R21" },
    ],
    naoPrecisa: [{ texto: "Não precisa de CNPJ técnico. Você já tem o CNPJ do MEI." }],
  },
  E_ME_EPP: {
    titulo: "Você passou do limite do MEI.",
    resumo:
      "Pelo que você contou, o que você recebe no ano fica acima do limite do MEI. Isso tem solução, mas o caminho depende de quanto passou e de quando. É um caso para olhar com um contador.",
    fazerAgora: [
      { texto: "Fale com um contador antes de fazer qualquer mudança no seu MEI." },
      { texto: "Separe quanto você recebeu em cada mês do ano." },
    ],
    naoPrecisa: [],
  },
};

export const textoDoAlerta: Record<CodigoAlerta, { secao: "fazerAgora"; texto: string }> = {
  CADESP_OBRIGATORIO: {
    secao: "fazerAgora",
    texto:
      "Peça a inscrição estadual do seu MEI (o cadastro do estado de São Paulo, chamado CADESP). Para o MEI, o pedido é feito no Portal do Empreendedor e não tem taxa.",
  },
  CADESP_NAO_CONSULTADO: {
    secao: "fazerAgora",
    texto:
      "Descubra se o seu MEI tem inscrição estadual (o cadastro do estado de São Paulo, chamado CADESP). Quem revende produtos precisa ter.",
  },
  REVENDA_PF_CONTRIBUINTE_ICMS: {
    secao: "fazerAgora",
    texto:
      "Atenção com a revenda: em São Paulo, quem compra para revender sempre deve o imposto estadual (ICMS) e precisa de inscrição no estado antes de começar, mesmo sendo pessoa física.",
  },
  REMESSA_VEDADA_SEM_CADESP: {
    secao: "fazerAgora",
    texto:
      "Regularize antes do próximo pedido: desde 1/7/2026 a marca não pode mandar produto para revenda a quem não tem inscrição estadual em São Paulo. Veja com um contador o melhor caminho. Muita gente resolve abrindo um MEI e pedindo a inscrição por ele.",
  },
  INTERMEDIACAO_ANALISAR_COMO_SERVICO: {
    secao: "fazerAgora",
    texto:
      "Como você recebe comissão e não compra o produto, seu caso é tratado como serviço, e não como revenda. Confira no seu contrato se é isso mesmo.",
  },
  MEI_ACIMA_DO_LIMITE: {
    secao: "fazerAgora",
    texto: "Não deixe para o fim do ano. Quanto antes você tratar o excesso, menor o custo.",
  },
  REGISTRAR_VENDAS_PF: {
    secao: "fazerAgora",
    texto:
      "A partir de 2027, anote cada venda ou serviço feito para pessoa física. Para esse cliente a declaração anual do MEI pode valer como documento fiscal, então a anotação precisa estar em dia. Para empresa, a nota fiscal continua.",
  },
  GUARDAR_NOTAS_DE_COMPRA: {
    secao: "fazerAgora",
    texto:
      "Guarde por cinco anos as notas das compras que você fez da marca. Elas provam de onde veio o produto.",
  },
  ISS_MUNICIPAL_A_VERIFICAR: {
    secao: "fazerAgora",
    texto:
      "Pergunte na prefeitura da sua cidade se o seu serviço precisa de cadastro e de nota fiscal de serviço. Essa regra é de cada cidade.",
  },
  ACOMPANHAR_CNPJ_TECNICO: {
    secao: "fazerAgora",
    texto:
      "Acompanhe o aviso oficial da Receita sobre o CNPJ técnico. Mantenha seu CPF regular e sua conta gov.br funcionando.",
  },
};

/** Texto das pendências que o motor pode apontar. Para as demais, vale o texto da própria regra. */
export const textoDaPendencia: Record<string, string> = {
  R08: "Você começou no meio do ano. O governo ainda não deixou claro se o limite diminui na mesma proporção. Fizemos a conta proporcional, que é a mais cuidadosa.",
  R09: "Ainda não está definido se a taxa que o aplicativo desconta entra na conta. Fizemos a conta com o valor cheio das corridas, que é o mais cuidadoso.",
  R10: "Ainda não está definido a partir de que dia a pessoa deixa de ser nanoempreendedor quando passa do limite no meio do ano.",
  R12: "O governo anunciou que parte das exigências de nota pode ficar para março de 2027, mas não disse para quem.",
  R13: "A Receita ainda não publicou o passo a passo do CNPJ técnico: como ele chega, quando e por onde.",
  R30: "A regra de nota de serviço da sua cidade ainda não está no nosso sistema.",
};

export const textoDaLacuna: Record<Lacuna, string> = {
  ICMS_UF_NAO_COBERTA:
    "Ainda não temos as regras de revenda do seu estado. Por enquanto só cobrimos São Paulo. Um contador precisa olhar o seu caso.",
};

export const rotuloDoStatus: Record<string, string> = {
  EM_VIGOR: "Já vale",
  EFEITO_FUTURO: "Vale a partir da data indicada",
  PENDENTE: "Ainda sem definição",
  ANUNCIADO: "Anunciado, sem norma publicada",
  A_CONFIRMAR: "Em conferência",
};
