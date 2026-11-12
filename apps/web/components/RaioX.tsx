"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { lerValor } from "@/lib/dinheiro";
import type { RespostaDoRaioX } from "@/lib/respostas";
import { Resultado } from "./Resultado";

type TipoAtividade =
  | "transporte_passageiros"
  | "entrega_de_bens"
  | "servico"
  | "revenda_mercadoria"
  | "intermediacao_comissao";
type SimNao = "sim" | "nao" | "nao_sei";

interface Estado {
  vinculo?: "somente_empregado" | "conta_propria";
  temMei?: SimNao;
  tipos: TipoAtividade[];
  valores: Partial<Record<TipoAtividade, string>>;
  uf: string;
  inscricaoEstadual?: SimNao;
}

const ATIVIDADES: { tipo: TipoAtividade; rotulo: string; exemplo?: string; nome: string; dica: string }[] = [
  {
    tipo: "transporte_passageiros",
    rotulo: "Levo passageiros por aplicativo",
    nome: "as corridas",
    dica: "Coloque o valor total das corridas, antes de tirar gasolina e a taxa do aplicativo.",
  },
  {
    tipo: "entrega_de_bens",
    rotulo: "Faço entregas",
    nome: "as entregas",
    dica: "Coloque o valor total das entregas, antes de tirar gasolina e a taxa do aplicativo.",
  },
  {
    tipo: "servico",
    rotulo: "Presto serviço",
    exemplo: "Manicure, diarista, pedreiro, aula, conserto e outros",
    nome: "os seus serviços",
    dica: "Coloque tudo o que entra, antes de tirar os gastos.",
  },
  {
    tipo: "revenda_mercadoria",
    rotulo: "Compro produtos para revender",
    exemplo: "Natura, Avon, bebidas, roupas e outros",
    nome: "as suas vendas",
    dica: "Coloque o total das vendas, e não o lucro.",
  },
  {
    tipo: "intermediacao_comissao",
    rotulo: "Vendo por comissão, sem comprar o produto",
    nome: "as comissões",
    dica: "Coloque o total de comissão que você recebe.",
  },
];

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

type Passo =
  | { id: "vinculo" }
  | { id: "temMei" }
  | { id: "tipos" }
  | { id: "valor"; tipo: TipoAtividade }
  | { id: "uf" }
  | { id: "inscricao" };

function passosPara(estado: Estado): Passo[] {
  const passos: Passo[] = [{ id: "vinculo" }];
  if (estado.vinculo !== "conta_propria") return passos;
  passos.push({ id: "temMei" }, { id: "tipos" });
  for (const tipo of estado.tipos) passos.push({ id: "valor", tipo });
  passos.push({ id: "uf" });
  if (estado.temMei === "sim" && estado.tipos.includes("revenda_mercadoria") && estado.uf === "SP") {
    passos.push({ id: "inscricao" });
  }
  return passos;
}

const SIM_NAO: { valor: SimNao; rotulo: string }[] = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
  { valor: "nao_sei", rotulo: "Não sei" },
];

export function RaioX({ ano }: { ano: number }) {
  const [estado, setEstado] = useState<Estado>({ tipos: [], valores: {}, uf: "SP" });
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<RespostaDoRaioX | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  const passos = useMemo(() => passosPara(estado), [estado]);
  const passo = passos[Math.min(indice, passos.length - 1)] as Passo;
  const ultimo = estado.vinculo !== undefined && indice >= passos.length - 1;

  function irPara(novo: number) {
    setErro(null);
    setIndice(novo);
    requestAnimationFrame(() => titulo.current?.focus());
  }

  function validar(): string | null {
    switch (passo.id) {
      case "vinculo":
        return estado.vinculo ? null : "Escolha uma das opções.";
      case "temMei":
        return estado.temMei ? null : "Escolha uma das opções.";
      case "tipos":
        return estado.tipos.length > 0 ? null : "Marque pelo menos uma opção.";
      case "valor":
        return lerValor(estado.valores[passo.tipo] ?? "") === null
          ? "Digite um valor em reais, só com números. Exemplo: 2500"
          : null;
      case "uf":
        return null;
      case "inscricao":
        return estado.inscricaoEstadual ? null : "Escolha uma das opções.";
    }
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const corpo =
        estado.vinculo === "somente_empregado"
          ? { vinculo: estado.vinculo }
          : {
              vinculo: estado.vinculo,
              temMei: estado.temMei,
              atividades: estado.tipos.map((tipo) => ({
                tipo,
                mediaMensal: lerValor(estado.valores[tipo] ?? "") ?? "0",
              })),
              uf: estado.uf,
              ...(passos.some((p) => p.id === "inscricao")
                ? { inscricaoEstadual: estado.inscricaoEstadual }
                : {}),
            };
      const r = await fetch("/api/raio-x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) {
        const problema = (await r.json().catch(() => null)) as { detail?: string } | null;
        setErro(problema?.detail ?? "Não deu para montar o resultado. Tente de novo.");
        return;
      }
      setResposta((await r.json()) as RespostaDoRaioX);
      requestAnimationFrame(() => window.scrollTo({ top: 0 }));
    } catch {
      setErro("Sem conexão com a internet. Confira o sinal e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  function aoContinuar(evento: FormEvent) {
    evento.preventDefault();
    const problema = validar();
    if (problema) return setErro(problema);
    if (ultimo) void enviar();
    else irPara(indice + 1);
  }

  function recomecar() {
    setResposta(null);
    setEstado({ tipos: [], valores: {}, uf: "SP" });
    irPara(0);
  }

  if (resposta) return <Resultado resposta={resposta} aoRecomecar={recomecar} />;

  const atividade = passo.id === "valor" ? ATIVIDADES.find((a) => a.tipo === passo.tipo) : undefined;

  return (
    <form className="pergunta" onSubmit={aoContinuar} noValidate>
      {indice === 0 && (
        <p className="abertura">
          Em {ano} mudam as regras de imposto para quem trabalha por conta própria. Responda poucas
          perguntas e veja o que vale para você. É de graça e não precisa de cadastro.
        </p>
      )}
      <p className="progresso">
        Pergunta {indice + 1}
        {estado.vinculo === "conta_propria" ? ` de ${passos.length}` : ""}
      </p>

      <fieldset aria-describedby={erro ? "erro" : undefined}>
        <legend>
          <h1 ref={titulo} tabIndex={-1}>
            {passo.id === "vinculo" && "Como você ganha o seu dinheiro hoje?"}
            {passo.id === "temMei" && "Você tem MEI?"}
            {passo.id === "tipos" && "O que você faz para ganhar dinheiro?"}
            {passo.id === "valor" && `Quanto você recebe por mês com ${atividade?.nome}, em média?`}
            {passo.id === "uf" && "Em que estado você trabalha?"}
            {passo.id === "inscricao" && "O seu MEI tem inscrição estadual?"}
          </h1>
        </legend>

        {passo.id === "vinculo" && (
          <div className="opcoes">
            <Opcao
              nome="vinculo"
              marcado={estado.vinculo === "conta_propria"}
              aoMarcar={() => setEstado({ ...estado, vinculo: "conta_propria" })}
              rotulo="Trabalho por conta própria"
              exemplo="Vale também para quem tem emprego e faz um extra"
            />
            <Opcao
              nome="vinculo"
              marcado={estado.vinculo === "somente_empregado"}
              aoMarcar={() => setEstado({ ...estado, vinculo: "somente_empregado" })}
              rotulo="Só tenho emprego"
              exemplo="Carteira assinada ou concurso, sem nenhum extra"
            />
          </div>
        )}

        {passo.id === "temMei" && (
          <>
            <p className="dica">
              MEI é o cadastro de microempreendedor. Quem tem paga uma guia fixa todo mês.
            </p>
            <div className="opcoes">
              {SIM_NAO.map((o) => (
                <Opcao
                  key={o.valor}
                  nome="temMei"
                  marcado={estado.temMei === o.valor}
                  aoMarcar={() => setEstado({ ...estado, temMei: o.valor })}
                  rotulo={o.rotulo}
                />
              ))}
            </div>
          </>
        )}

        {passo.id === "tipos" && (
          <>
            <p className="dica">Pode marcar mais de uma.</p>
            <div className="opcoes">
              {ATIVIDADES.map((a) => (
                <Opcao
                  key={a.tipo}
                  tipo="checkbox"
                  nome="tipos"
                  marcado={estado.tipos.includes(a.tipo)}
                  aoMarcar={() =>
                    setEstado({
                      ...estado,
                      tipos: estado.tipos.includes(a.tipo)
                        ? estado.tipos.filter((t) => t !== a.tipo)
                        : ATIVIDADES.map((x) => x.tipo).filter(
                            (t) => t === a.tipo || estado.tipos.includes(t),
                          ),
                    })
                  }
                  rotulo={a.rotulo}
                  {...(a.exemplo ? { exemplo: a.exemplo } : {})}
                />
              ))}
            </div>
          </>
        )}

        {passo.id === "valor" && atividade && (
          <>
            <p className="dica">{atividade.dica}</p>
            <label className="campo-valor">
              <span aria-hidden="true">R$</span>
              <input
                key={atividade.tipo}
                inputMode="decimal"
                autoComplete="off"
                aria-label="Valor por mês, em reais"
                placeholder="0"
                value={estado.valores[atividade.tipo] ?? ""}
                onChange={(e) =>
                  setEstado({
                    ...estado,
                    valores: { ...estado.valores, [atividade.tipo]: e.target.value },
                  })
                }
              />
              <span>por mês</span>
            </label>
          </>
        )}

        {passo.id === "uf" && (
          <label className="campo-uf">
            <span className="dica">Algumas regras mudam de um estado para outro.</span>
            <select value={estado.uf} onChange={(e) => setEstado({ ...estado, uf: e.target.value })}>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        )}

        {passo.id === "inscricao" && (
          <>
            <p className="dica">
              É um cadastro no estado, diferente do CNPJ. Em São Paulo ele se chama CADESP.
            </p>
            <div className="opcoes">
              {SIM_NAO.map((o) => (
                <Opcao
                  key={o.valor}
                  nome="inscricao"
                  marcado={estado.inscricaoEstadual === o.valor}
                  aoMarcar={() => setEstado({ ...estado, inscricaoEstadual: o.valor })}
                  rotulo={o.rotulo}
                />
              ))}
            </div>
          </>
        )}
      </fieldset>

      {erro && (
        <p id="erro" className="erro" role="alert">
          {erro}
        </p>
      )}

      <div className="acoes">
        <button type="submit" className="principal" disabled={enviando}>
          {enviando ? "Montando o resultado" : ultimo ? "Ver o meu resultado" : "Continuar"}
        </button>
        {indice > 0 && (
          <button type="button" className="secundario" onClick={() => irPara(indice - 1)}>
            Voltar
          </button>
        )}
      </div>
    </form>
  );
}

function Opcao(props: {
  nome: string;
  tipo?: "radio" | "checkbox";
  marcado: boolean;
  aoMarcar: () => void;
  rotulo: string;
  exemplo?: string;
}) {
  return (
    <label className="opcao" data-marcado={props.marcado}>
      <input
        type={props.tipo ?? "radio"}
        name={props.nome}
        checked={props.marcado}
        onChange={props.aoMarcar}
      />
      <span>
        <strong>{props.rotulo}</strong>
        {props.exemplo && <small>{props.exemplo}</small>}
      </span>
    </label>
  );
}
