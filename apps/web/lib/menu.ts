/** Os grupos do menu completo. A ordem é a da jornada: descobrir, cuidar do dia a dia, cadastros, ajuda. */
export const GRUPOS_DO_MENU = [
  {
    titulo: "Descobrir",
    links: [
      { href: "/minha-situacao", texto: "Minha situação em 2027" },
      { href: "/simulador", texto: "Comparar nano, MEI e empresa" },
      { href: "/limite", texto: "Meu limite do ano" },
      { href: "/sair-do-mei", texto: "Quanto custa sair do MEI" },
    ],
  },
  {
    titulo: "Dia a dia",
    links: [
      { href: "/caderno", texto: "Caderno de vendas" },
      { href: "/das", texto: "Guia do MEI (DAS)" },
      { href: "/declaracao", texto: "Declaração anual do MEI" },
      { href: "/nota-de-servico", texto: "Códigos da nota de serviço" },
      { href: "/cofre", texto: "Cofre de notas" },
    ],
  },
  {
    titulo: "Cadastros",
    links: [
      { href: "/abrir-mei", texto: "Abrir MEI" },
      { href: "/cnpj-tecnico", texto: "CNPJ técnico" },
      { href: "/cadesp", texto: "Inscrição estadual (SP)" },
    ],
  },
  {
    titulo: "Ajuda",
    links: [
      { href: "/assistente", texto: "Perguntar à assistente" },
      { href: "/ajuda", texto: "Falar com um contador" },
      { href: "/conta", texto: "Minha conta" },
    ],
  },
] as const;
