import type { Metadata } from "next";
import Link from "next/link";
import { ANO_AVALIADO, diagnosticar, Respostas } from "@/lib/respostas";

export const metadata: Metadata = {
  title: "ProContador: o imposto de quem trabalha por conta própria, com a lei na mão",
  description:
    "Descubra em 3 minutos o que muda para você em 2027: nanoempreendedor, MEI, CNPJ técnico, nota fiscal e inscrição estadual. De graça e sem cadastro.",
};

/**
 * O exemplo da abertura é calculado pelo motor de regras, igual ao que a pessoa recebe no fim do
 * questionário. Se a regra mudar, a placa muda junto.
 */
const EXEMPLO = { profissao: "Manicure", media: "R$ 2.400 por mês" };

function exemploDaPlaca() {
  const r = diagnosticar(
    Respostas.parse({
      vinculo: "conta_propria",
      temMei: "nao",
      atividades: [{ tipo: "servico", mediaMensal: "2400.00" }],
      uf: "SP",
    }),
  );
  const fonte = new Map(r.diagnostico.regras.map((x) => [x.id, x.fonte]));
  // Só regras que já valem ou têm data marcada: ponto em aberto não vai para a vitrine.
  const firme = new Set(r.diagnostico.regras.filter((x) => x.status === "EM_VIGOR" || x.status === "EFEITO_FUTURO").map((x) => x.id));
  const itens = [...r.diagnostico.naoPrecisa, ...r.diagnostico.fazerAgora]
    .filter((i) => i.regra && firme.has(i.regra))
    .slice(0, 3)
    .map((i) => ({ texto: i.texto, regra: i.regra!, fonte: fonte.get(i.regra!) ?? "" }));
  return { titulo: r.diagnostico.titulo, itens };
}

const PUBLICOS = [
  {
    quem: "Motorista e entregador de aplicativo",
    pergunta: "Uber, 99, iFood: o que a Reforma cobra de quem roda por aplicativo?",
    href: "/minha-situacao",
  },
  {
    quem: "Diarista, manicure e quem presta serviço",
    pergunta: "Preciso de CNPJ, de nota fiscal ou de cadastro na prefeitura?",
    href: "/minha-situacao",
  },
  {
    quem: "Revendedora Natura, Avon e outras marcas",
    pergunta: "Revenda precisa de inscrição estadual? E as notas de compra?",
    href: "/cadesp",
  },
  {
    quem: "MEI perto do limite",
    pergunta: "Se eu passar do limite, quanto vou pagar como empresa?",
    href: "/sair-do-mei",
  },
];

const DUVIDAS = [
  { pergunta: "Vou precisar de CNPJ técnico?", href: "/cnpj-tecnico" },
  { pergunta: "O MEI continua valendo para mim?", href: "/simulador" },
  { pergunta: "Quanto ainda posso faturar este ano?", href: "/limite" },
  { pergunta: "Que código vai na minha nota de serviço?", href: "/nota-de-servico" },
  { pergunta: "Quando entrego a declaração anual do MEI?", href: "/declaracao" },
  { pergunta: "Revendo cosméticos em SP. Preciso de inscrição estadual?", href: "/cadesp" },
];

const FERRAMENTAS = [
  { nome: "Caderno de vendas", texto: "Anote o que entrou no mês, pelo site ou pelo WhatsApp, e veja o limite do ano.", href: "/caderno" },
  { nome: "Guia do MEI", texto: "O passo a passo para gerar o DAS pelo canal oficial da Receita, sem pagar nada e sem senha.", href: "/das" },
  { nome: "Declaração anual", texto: "Os valores da DASN-SIMEI tirados do seu caderno de vendas, prontos para copiar.", href: "/declaracao" },
  { nome: "Códigos da nota de serviço", texto: "Código nacional, NBS e classificação da Reforma, direto da tabela oficial da Receita.", href: "/nota-de-servico" },
  { nome: "Cofre de notas", texto: "Guarde as notas das compras da marca e prove de onde veio cada produto.", href: "/cofre" },
  { nome: "Saída do MEI", texto: "Compare a guia do MEI com a de empresa no Simples Nacional, mês a mês.", href: "/sair-do-mei" },
];

export default function Inicio() {
  const placa = exemploDaPlaca();

  return (
    <div className="inicio">
      <section className="abertura-inicio" aria-labelledby="titulo-inicio">
        <div className="faixa">
          <div className="abertura-texto">
            <h1 id="titulo-inicio">
              O imposto de quem trabalha por conta própria, explicado com a lei na mão.
            </h1>
            <p className="abertura-sub">
              Em {ANO_AVALIADO} chegam a CBS e o IBS. Responda poucas perguntas e veja o que vale para você:
              nanoempreendedor, MEI, CNPJ técnico, nota fiscal e inscrição estadual.
            </p>
            <div className="abertura-acoes">
              <Link className="botao-principal" href="/minha-situacao">
                Descobrir minha situação
              </Link>
              <Link className="botao-secundario" href="/assistente">
                Perguntar à assistente
              </Link>
            </div>
            <p className="abertura-garantias">
              De graça. Sem cadastro. Leva 3 minutos. Nunca pedimos senha do gov.br.
            </p>
          </div>

          <figure className="vitrine" aria-labelledby="vitrine-legenda">
            <figcaption id="vitrine-legenda" className="vitrine-legenda">
              Resultado real, calculado agora pelo nosso motor de regras
            </figcaption>
            <p className="vitrine-perfil">
              {EXEMPLO.profissao}, {EXEMPLO.media}, sem MEI, em São Paulo
            </p>
            <p className="vitrine-titulo">{placa.titulo}</p>
            <ul className="vitrine-itens">
              {placa.itens.map((i) => (
                <li key={i.regra + i.texto}>
                  <span>{i.texto}</span>
                  <small>
                    Regra {i.regra} ({i.fonte})
                  </small>
                </li>
              ))}
            </ul>
          </figure>
        </div>
      </section>

      <section className="secao" aria-labelledby="titulo-publicos">
        <div className="faixa">
          <h2 id="titulo-publicos">Feito para quem não tem tempo de entender de imposto</h2>
          <ul className="publicos">
            {PUBLICOS.map((p) => (
              <li key={p.quem}>
                <Link href={p.href}>
                  <strong>{p.quem}</strong>
                  <span>{p.pergunta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="secao secao-clara" aria-labelledby="titulo-duvidas">
        <div className="faixa duas-colunas">
          <div>
            <h2 id="titulo-duvidas">As dúvidas de {ANO_AVALIADO}, respondidas uma a uma</h2>
            <p>
              A Reforma Tributária muda a vida de quem trabalha por conta própria, mas cada caso é um caso. Aqui você
              vai direto na sua pergunta, e cada resposta mostra a lei de onde ela saiu.
            </p>
          </div>
          <ul className="duvidas">
            {DUVIDAS.map((d) => (
              <li key={d.pergunta}>
                <Link href={d.href}>{d.pergunta}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="secao" aria-labelledby="titulo-como">
        <div className="faixa">
          <h2 id="titulo-como">Como funciona</h2>
          <ol className="passos">
            <li>
              <strong>Conte como você trabalha</strong>
              <span>O que você faz, quanto entra por mês e se já tem MEI. Nada de documento ou senha.</span>
            </li>
            <li>
              <strong>Veja o que vale para você</strong>
              <span>O que fazer agora, o que você não precisa fazer e o que o governo ainda não definiu, com a regra citada em cada item.</span>
            </li>
            <li>
              <strong>Fique em dia o ano todo</strong>
              <span>Caderno de vendas, guia do MEI, declaração anual e lembretes pelo WhatsApp, quando você pedir.</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="secao secao-clara" aria-labelledby="titulo-ferramentas">
        <div className="faixa">
          <h2 id="titulo-ferramentas">Ferramentas para o dia a dia</h2>
          <ul className="ferramentas">
            {FERRAMENTAS.map((f) => (
              <li key={f.nome}>
                <Link href={f.href}>
                  <strong>{f.nome}</strong>
                  <span>{f.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="secao" aria-labelledby="titulo-confianca">
        <div className="faixa duas-colunas">
          <h2 id="titulo-confianca">Por que dá para confiar</h2>
          <dl className="confianca">
            <div>
              <dt>Toda resposta tem fonte</dt>
              <dd>Cada orientação aponta a regra e a lei de onde saiu, como a Lei Complementar 214/2025. Nada de achismo.</dd>
            </div>
            <div>
              <dt>Revisado por contador</dt>
              <dd>As regras passam pela conferência de um contador com registro no CRC.</dd>
            </div>
            <div>
              <dt>Tabelas oficiais da Receita</dt>
              <dd>Os códigos da nota e os cálculos da Reforma vêm das calculadoras oficiais publicadas pela Receita Federal.</dd>
            </div>
            <div>
              <dt>Seus dados são seus</dt>
              <dd>Sem conta, nada fica guardado. Com conta, você baixa ou apaga tudo quando quiser, como manda a LGPD.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="chamada-final" aria-labelledby="titulo-chamada">
        <div className="faixa">
          <h2 id="titulo-chamada">Saiba hoje o que muda para você em {ANO_AVALIADO}.</h2>
          <Link className="botao-principal" href="/minha-situacao">
            Descobrir minha situação
          </Link>
        </div>
      </section>
    </div>
  );
}
