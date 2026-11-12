import type { Resultado, Trilha } from "@cnpjtec/motor-regras";
import { buscarRegra } from "@cnpjtec/regras";
import {
  rotuloDoStatus,
  textoDaLacuna,
  textoDaPendencia,
  textoDaTrilha,
  textoDoAlerta,
  type Frase,
} from "./textos";

export * from "./textos";

export interface RegraCitada {
  id: string;
  regra: string;
  fonte: string;
  status: string;
  rotuloDoStatus: string;
  /** Verdadeiro quando a fonte ainda não foi conferida no texto oficial. */
  emRevisao: boolean;
}

export interface Diagnostico {
  trilhas: Trilha[];
  titulo: string;
  resumo: string;
  fazerAgora: Frase[];
  naoPrecisa: Frase[];
  /** O que o governo ainda não definiu e pode mudar este resultado. */
  semDefinicao: Frase[];
  /** O que precisa de um contador porque ainda não há regra cadastrada. */
  comContador: Frase[];
  numeros: {
    receitaBrutaTotal: string;
    receitaComputadaNano: string;
    limiteNano: string;
    limiteMei: string;
  };
  regras: RegraCitada[];
}

function semRepetir(frases: Frase[]): Frase[] {
  const vistas = new Set<string>();
  return frases.filter((f) => (vistas.has(f.texto) ? false : (vistas.add(f.texto), true)));
}

/** Monta o diagnóstico em linguagem simples a partir do resultado do motor. Não decide nada. */
export function montarDiagnostico(resultado: Resultado): Diagnostico {
  const [principal, ...demais] = resultado.trilhas;
  if (!principal) throw new Error("Resultado sem trilha.");

  const base = textoDaTrilha[principal];
  const fazerAgora: Frase[] = [...base.fazerAgora];
  const naoPrecisa: Frase[] = [...base.naoPrecisa];
  for (const trilha of demais) {
    fazerAgora.push(...textoDaTrilha[trilha].fazerAgora);
    naoPrecisa.push(...textoDaTrilha[trilha].naoPrecisa);
  }
  for (const alerta of resultado.alertas) {
    fazerAgora.push({ texto: textoDoAlerta[alerta.codigo].texto, regra: alerta.regra });
  }

  const semDefinicao: Frase[] = resultado.pendencias.map((id) => ({
    texto: textoDaPendencia[id] ?? buscarRegra(id).regra,
    regra: id,
  }));
  const comContador: Frase[] = resultado.lacunas.map((l) => ({ texto: textoDaLacuna[l] }));

  const ids = new Set<string>([
    ...resultado.regrasAplicadas,
    ...resultado.pendencias,
    ...resultado.alertas.map((a) => a.regra),
    ...[...fazerAgora, ...naoPrecisa].flatMap((f) => (f.regra ? [f.regra] : [])),
  ]);
  const regras: RegraCitada[] = [...ids].sort().map((id) => {
    const r = buscarRegra(id);
    return {
      id: r.id,
      regra: r.regra,
      fonte: r.fonte,
      status: r.status,
      rotuloDoStatus: rotuloDoStatus[r.status] ?? r.status,
      emRevisao: r.conferencia !== "OFICIAL" && r.conferencia !== "SEM_NORMA",
    };
  });

  const titulo =
    principal === "C_MEI_SERVICO" && demais.includes("D_MEI_REVENDA")
      ? "Você é MEI, presta serviço e vende produtos."
      : base.titulo;

  return {
    trilhas: resultado.trilhas,
    titulo,
    resumo: base.resumo,
    fazerAgora: semRepetir(fazerAgora),
    naoPrecisa: semRepetir(naoPrecisa),
    semDefinicao,
    comContador,
    numeros: {
      receitaBrutaTotal: resultado.receitaBrutaTotal,
      receitaComputadaNano: resultado.receitaComputadaNano,
      limiteNano: resultado.limiteNano,
      limiteMei: resultado.limiteMei,
    },
    regras,
  };
}
