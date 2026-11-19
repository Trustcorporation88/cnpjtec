# Calculadoras oficiais da Reforma Tributária (Receita Federal)

Três serviços internos do projeto cnpjtec no Railway, montados a partir do código aberto (MIT)
publicado pela Receita Federal. Cada Dockerfile fixa o commit usado, para a imagem ser reproduzível.

| Serviço | Dockerfile | Endereço interno | O que faz |
|---|---|---|---|
| `rtc-regime-regular` | `Dockerfile.regime-regular` | `http://rtc-regime-regular.railway.internal:8080/api` | Cálculo de CBS, IBS e IS, tabelas oficiais (CST, cClassTrib, NBS, NCM), XML |
| `rtc-simples-nacional` | `Dockerfile.simples-nacional` | `http://rtc-simples-nacional.railway.internal:8080/api` | CBS e IBS no Simples Nacional e catálogo de atividades (cAtivSN) |
| `rtc-danfse` | `Dockerfile.danfse` | `http://rtc-danfse.railway.internal:8080` | PDF da NFS-e (DANFSe) a partir do XML |

O banco SQLite das calculadoras é montado no build por `montar_banco.py`, que aplica os scripts
oficiais (`flyway/sql` do repositório do regime regular) na mesma ordem e com as mesmas transações
do Flyway. O repositório do Simples não traz scripts próprios: as tabelas do Simples estão nos
scripts do regime regular (V0049 a V0051).

Para atualizar: troque o commit no `ARG` do Dockerfile, publique e confira `GET /api/versao`.
Nenhum serviço tem domínio público; o site fala com eles pela rede privada do Railway.
