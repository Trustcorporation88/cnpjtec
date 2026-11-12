import { classificar, type Perfil } from "@cnpjtec/motor-regras";
import { baseDeRegras, buscarRegra } from "@cnpjtec/regras";
import { describe, expect, it } from "vitest";
import { montarDiagnostico, textoDaPendencia, textoDaTrilha, textoDoAlerta } from "./index";

const parametros = baseDeRegras.parametros;
const pf = (extra: Partial<Perfil> & Pick<Perfil, "atividades">): Perfil => ({
  anoCalendario: 2027,
  vinculo: "conta_propria",
  temMei: false,
  uf: "SP",
  ...extra,
});

const todosOsTextos = [
  ...Object.values(textoDaTrilha).flatMap((t) => [
    t.titulo,
    t.resumo,
    ...t.fazerAgora.map((f) => f.texto),
    ...t.naoPrecisa.map((f) => f.texto),
  ]),
  ...Object.values(textoDoAlerta).map((a) => a.texto),
  ...Object.values(textoDaPendencia),
];

describe("textos", () => {
  it("não usam travessão", () => {
    for (const texto of todosOsTextos) expect(texto).not.toMatch(/[—–]/);
  });

  it("nunca prometem emitir ou retirar o CNPJ técnico", () => {
    for (const texto of todosOsTextos) {
      expect(texto.toLowerCase()).not.toMatch(/(emitimos|retiramos|tiramos) (o |seu )?cnpj/);
    }
  });

  it("toda regra citada em frase existe na base", () => {
    const ids = Object.values(textoDaTrilha).flatMap((t) =>
      [...t.fazerAgora, ...t.naoPrecisa].flatMap((f) => (f.regra ? [f.regra] : [])),
    );
    for (const id of [...ids, ...Object.keys(textoDaPendencia)]) {
      expect(() => buscarRegra(id)).not.toThrow();
    }
  });
});

describe("datas nas frases", () => {
  const vigencias = (id: string): string[] => {
    const r = buscarRegra(id);
    return [r.vigenciaInicio, r.vigenciaFim].flatMap((iso) => {
      if (!iso) return [];
      const [ano, mes, dia] = iso.split("-");
      return [`${Number(dia)}/${Number(mes)}/${ano}`];
    });
  };
  const frasesComRegra = [
    ...Object.values(textoDaTrilha).flatMap((t) => [...t.fazerAgora, ...t.naoPrecisa]),
    { texto: textoDoAlerta.REMESSA_VEDADA_SEM_CADESP.texto, regra: "R24" },
  ].filter((f): f is { texto: string; regra: string } => Boolean(f.regra));

  it("toda data citada bate com a vigência da regra da frase", () => {
    for (const frase of frasesComRegra) {
      for (const data of frase.texto.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? []) {
        expect(vigencias(frase.regra), `${frase.regra}: ${frase.texto}`).toContain(data);
      }
    }
  });

  it("nenhum texto traz valor em reais fixo", () => {
    for (const texto of todosOsTextos) expect(texto).not.toMatch(/R\$\s?\d/);
  });
});

describe("diagnóstico", () => {
  it("nano motorista: fora dos impostos novos, com a pendência da comissão", () => {
    const d = montarDiagnostico(
      classificar(
        pf({ atividades: [{ tipo: "transporte_passageiros", receitaBrutaAnual: "144000" }] }),
        parametros,
      ),
    );
    expect(d.titulo).toBe("Você está fora dos impostos novos.");
    expect(d.semDefinicao.map((f) => f.regra)).toContain("R09");
    expect(d.naoPrecisa.some((f) => f.regra === "R07")).toBe(true);
  });

  it("pessoa física acima do limite: diz que o CNPJ técnico é da Receita e gratuito", () => {
    const d = montarDiagnostico(
      classificar(pf({ atividades: [{ tipo: "servico", receitaBrutaAnual: "70000" }] }), parametros),
    );
    expect(d.fazerAgora.map((f) => f.texto).join(" ")).toMatch(/Receita Federal e é gratuito/);
    expect(d.semDefinicao.map((f) => f.regra)).toEqual(expect.arrayContaining(["R12", "R13"]));
  });

  it("MEI revendedor sem inscrição: CADESP aparece no que fazer agora", () => {
    const d = montarDiagnostico(
      classificar(
        pf({
          temMei: true,
          inscricaoEstadualAtiva: false,
          atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "60000" }],
        }),
        parametros,
      ),
    );
    expect(d.fazerAgora.map((f) => f.texto).join(" ")).toMatch(/CADESP/);
    expect(d.regras.map((r) => r.id)).toContain("R25");
  });

  it("marca como em revisão a regra que não foi conferida na fonte oficial", () => {
    const d = montarDiagnostico(
      classificar(pf({ atividades: [{ tipo: "servico", receitaBrutaAnual: "10000" }] }), parametros),
    );
    const r07 = d.regras.find((r) => r.id === "R07");
    expect(r07?.emRevisao).toBe(true);
  });

  it("revenda fora de SP vai para o contador", () => {
    const d = montarDiagnostico(
      classificar(
        pf({ uf: "PR", atividades: [{ tipo: "revenda_mercadoria", receitaBrutaAnual: "10000" }] }),
        parametros,
      ),
    );
    expect(d.comContador).toHaveLength(1);
  });

  it("não repete frases quando há duas trilhas", () => {
    const d = montarDiagnostico(
      classificar(
        pf({
          temMei: true,
          inscricaoEstadualAtiva: true,
          atividades: [
            { tipo: "servico", receitaBrutaAnual: "20000" },
            { tipo: "revenda_mercadoria", receitaBrutaAnual: "30000" },
          ],
        }),
        parametros,
      ),
    );
    const textos = d.fazerAgora.map((f) => f.texto);
    expect(new Set(textos).size).toBe(textos.length);
    expect(d.titulo).toBe("Você é MEI, presta serviço e vende produtos.");
  });
});
