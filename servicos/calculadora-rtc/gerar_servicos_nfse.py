"""Gera packages/regras/dados/servicos-nfse.json a partir do banco oficial da calculadora RTC.

Para cada item da lista de serviços da LC 116 (o "código de tributação nacional" da NFS-e), traz as
NBS correlacionadas pela Receita, os indicadores de operação (cIndOp) e a situação e a classificação
tributária do IBS e da CBS (CST e cClassTrib). Reproduz as consultas do NfseService da calculadora
oficial (IndicadorOperacaoRepository), na mesma data de referência.

Uso: python -I gerar_servicos_nfse.py <calculadora-pro.db> <data AAAA-MM-DD> <commit> <saida.json>
"""
import json, sqlite3, sys

banco, data, commit, saida = sys.argv[1:5]
con = sqlite3.connect(f"file:{banco}?mode=ro", uri=True)
vig = lambda p: f":d BETWEEN {p}_INICIO_VIGENCIA AND COALESCE({p}_FIM_VIGENCIA, :d)"

versao = con.execute(
    "SELECT * FROM VERSAO_BASE_DADO ORDER BY 1 DESC LIMIT 1").fetchone()
colunas = [c[0] for c in con.execute("SELECT * FROM VERSAO_BASE_DADO LIMIT 0").description]
versao = dict(zip(colunas, versao))

itens_lc = {cd: desc for cd, desc in con.execute(
    f"SELECT LSLC_CD, LSLC_DESCRICAO FROM LISTA_SERVICOS_LC_116 WHERE {vig('LSLC')}", {"d": data})}

linhas = con.execute(f"""
    SELECT c.CNIL_LSLC_CD, c.CNIL_NBS_CD, n.NBS_DESCRICAO,
           io.IOIC_CD, io.IOIC_TIPO_OPERACAO, io.IOIC_LOCAL_INCIDENCIA,
           c.CNIL_IN_PS_ONEROSA, c.CNIL_IN_ADQ_EXTERIOR,
           st.SITR_CD, st.SITR_DESCRICAO, ct.CLTR_CD, ct.CLTR_DESCRICAO
      FROM CLASSIF_NBS_INDOP_LC c
      JOIN NBS n ON n.NBS_CD = c.CNIL_NBS_CD
      JOIN INDICADOR_OPERACAO_IBS_CBS io ON io.IOIC_ID = c.CNIL_IOIC_ID
      JOIN CLASSIFICACAO_TRIBUTARIA ct ON ct.CLTR_ID = c.CNIL_CLTR_ID
      JOIN SITUACAO_TRIBUTARIA st ON st.SITR_ID = ct.CLTR_SITR_ID
     WHERE {vig('c.CNIL')} AND {vig('n.NBS')} AND {vig('io.IOIC')}
       AND {vig('ct.CLTR')} AND {vig('st.SITR')} AND io.IOIC_TIPO_OPERACAO IS NOT NULL
     ORDER BY c.CNIL_LSLC_CD, c.CNIL_NBS_CD, io.IOIC_CD, ct.CLTR_CD
""", {"d": data}).fetchall()

def chave_item(cd):
    return [int(p) for p in cd.split(".")]

itens, indicadores, classificacoes = {}, {}, {}
for (lc, nbs, nbs_desc, cind, tipo, local, _onerosa, _exterior, cst, cst_desc, ccl, ccl_desc) in linhas:
    item = itens.setdefault(lc, {"codigo": lc, "descricao": " ".join((itens_lc.get(lc) or "").split()), "nbs": {}})
    n = item["nbs"].setdefault(nbs, {"codigo": nbs, "descricao": " ".join(nbs_desc.split()), "cIndOp": [], "cClassTrib": []})
    if cind not in n["cIndOp"]:
        n["cIndOp"].append(cind)
    if ccl not in n["cClassTrib"]:
        n["cClassTrib"].append(ccl)
    indicadores.setdefault(cind, {"tipoOperacao": " ".join(tipo.split()), "localIncidencia": local})
    classificacoes.setdefault(ccl, {"cst": cst, "cstDescricao": " ".join(cst_desc.split()),
                                    "descricao": " ".join(ccl_desc.split())})

saida_json = {
    "fonte": "Calculadora oficial da Reforma Tributária do Consumo (Receita Federal), github.com/ReceitaFederal/calculadora-rtc-regime-regular",
    "commit": commit,
    "versaoBase": {"versao": versao["VRBD_VERSAO_BASE_DADO"], "data": versao["VRBD_DATA"][:10], "descricao": versao["VRBD_DESCRICAO"]},
    "dataReferencia": data,
    "indicadores": dict(sorted(indicadores.items())),
    "classificacoes": dict(sorted(classificacoes.items())),
    "itens": [{**i, "nbs": list(i["nbs"].values())} for _, i in sorted(itens.items(), key=lambda kv: chave_item(kv[0]))],
}
with open(saida, "w", encoding="utf-8") as f:
    json.dump(saida_json, f, ensure_ascii=False, separators=(",", ":"))
    f.write("\n")
print(len(saida_json["itens"]), "itens,", sum(len(i["nbs"]) for i in saida_json["itens"]), "pares item/NBS")
