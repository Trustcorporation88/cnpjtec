import type { Metadata } from "next";
import Link from "next/link";
import { ANO_AVALIADO, diagnosticar, Respostas } from "@/lib/respostas";
import { linkDoWhatsapp, numeroPublicoDoWhatsapp } from "@/lib/whatsapp/evolution";

// Lido a cada visita: o botão do WhatsApp só aparece quando o número público estiver configurado.
export const dynamic = "force-dynamic";

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

const PERFIS_DA_ABERTURA = [
  { perfil: "motorista", rotulo: "Motorista de aplicativo", exemplo: "Uber, 99, inDrive" },
  { perfil: "entregador", rotulo: "Entregador", exemplo: "iFood, Rappi, Loggi" },
  { perfil: "servico", rotulo: "Presto serviço", exemplo: "Manicure, diarista, pedreiro" },
  { perfil: "revenda", rotulo: "Revendo produtos", exemplo: "Natura, Avon, Boticário" },
  { perfil: "mei", rotulo: "Já tenho MEI", exemplo: "Guia, limite, declaração" },
] as const;

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
  { nome: "Guia do MEI", texto: "Como tirar a guia do mês no site da Receita, de graça e sem senha.", href: "/das" },
  { nome: "Declaração anual", texto: "Os números da declaração anual do MEI, tirados do seu caderno de vendas.", href: "/declaracao" },
  { nome: "Códigos da nota de serviço", texto: "Os códigos certos para a sua nota de serviço, da tabela oficial da Receita.", href: "/nota-de-servico" },
  { nome: "Cofre de notas", texto: "Guarde as notas das compras da marca e prove de onde veio cada produto.", href: "/cofre" },
  { nome: "Se eu sair do MEI", texto: "Quanto você vai pagar por mês se passar do limite e deixar de ser MEI.", href: "/sair-do-mei" },
];

export default function Inicio() {
  const placa = exemploDaPlaca();
  const whatsapp = numeroPublicoDoWhatsapp();
  const linkWhatsapp = whatsapp ? linkDoWhatsapp(whatsapp) : null;

  return (
    <div className="inicio">
      <section className="abertura-inicio" aria-labelledby="titulo-inicio">
        <div className="faixa">
          <div className="abertura-texto">
            <h1 id="titulo-inicio">Em {ANO_AVALIADO} o imposto muda. Veja se muda para você.</h1>
            <p className="abertura-sub">Toque no que você faz:</p>
            <ul className="perfis">
              {PERFIS_DA_ABERTURA.map((p) => (
                <li key={p.perfil}>
                  <Link href={`/minha-situacao?perfil=${p.perfil}`}>
                    <strong>{p.rotulo}</strong>
                    <span>{p.exemplo}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {linkWhatsapp && (
              <a className="botao-whatsapp" href={linkWhatsapp} target="_blank" rel="noopener">
                <IconeWhatsapp />
                Prefiro pelo WhatsApp
              </a>
            )}
            <p className="abertura-garantias">
              De graça e sem cadastro. Nunca pedimos senha do gov.br.{" "}
              <Link href="/assistente">Tem uma dúvida? Pergunte aqui.</Link>
            </p>
          </div>

          <figure className="vitrine" aria-labelledby="vitrine-legenda">
            <figcaption id="vitrine-legenda" className="vitrine-legenda">
              Um resultado de verdade, feito agora pelo site
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

      <section className="secao secao-clara" aria-labelledby="titulo-duvidas">
        <div className="faixa duas-colunas">
          <div>
            <h2 id="titulo-duvidas">As dúvidas de {ANO_AVALIADO}, respondidas uma a uma</h2>
            <p>O imposto muda em 2027, mas cada caso é um caso. Toque na sua dúvida e veja a resposta, com a lei de onde ela saiu.</p>
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
              <strong>Toque no que você faz</strong>
              <span>Escolha o seu trabalho e diga quanto entra por mês. Sem documento e sem senha.</span>
            </li>
            <li>
              <strong>Veja o que muda para você</strong>
              <span>O que fazer agora, o que você não precisa fazer e o que o governo ainda não decidiu. Cada item mostra a lei.</span>
            </li>
            <li>
              <strong>Fique em dia o ano todo</strong>
              <span>Anote suas vendas, tire a guia do MEI, faça a declaração do ano e receba lembretes no WhatsApp.</span>
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
              <dd>Os códigos da nota e as contas do imposto novo vêm das calculadoras oficiais da Receita Federal.</dd>
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
          <div className="abertura-acoes">
            <Link className="botao-principal" href="/minha-situacao">
              Ver o que muda para mim
            </Link>
            {linkWhatsapp && (
              <a className="botao-whatsapp" href={linkWhatsapp} target="_blank" rel="noopener">
                <IconeWhatsapp />
                Chamar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function IconeWhatsapp() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"
      />
    </svg>
  );
}
