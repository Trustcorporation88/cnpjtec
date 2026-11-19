"""Monta o banco SQLite da calculadora RTC aplicando os scripts oficiais na ordem do Flyway."""
import re, sqlite3, sys, pathlib
raiz = pathlib.Path(sys.argv[1]); destino = sys.argv[2]
def ordem(p):
    m = re.match(r"V(\d+)__", p.name); return int(m.group(1)) if m else 0
arquivos = [raiz/"criacao/beforeMigrate.sql", raiz/"criacao/B0001__sistema_tributario_completo.sql"]
arquivos += sorted((raiz/"manutencao").glob("V*__*.sql"), key=ordem)
arquivos += [raiz/"criacao/afterMigrate.sql"]
con = sqlite3.connect(destino, isolation_level=None)
for a in arquivos:
    try:
        texto = a.read_text(encoding="utf-8")
        callback = a.name in ("beforeMigrate.sql", "afterMigrate.sql")
        # Como o Flyway: cada migração roda numa transação, salvo as que mexem em PRAGMA foreign_keys.
        if callback or re.search(r"PRAGMA\s+foreign_keys", texto, re.I):
            con.executescript(texto)
        else:
            con.executescript("BEGIN;\n" + texto + "\nCOMMIT;")
    except Exception as e:
        print("ERRO", a.name, e); sys.exit(1)
print("ok", len(arquivos), "scripts")
for t in ["ATIVIDADE_SIMPLES_NACIONAL","CLASSIFICACAO_TRIBUTARIA","VERSAO_BASE_DADO"]:
    print(t, con.execute(f"select count(*) from {t}").fetchone()[0])
