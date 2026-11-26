# Setup das contas (GitHub + Cloudflare)

Tudo na sua **conta pessoal**. Nunca use tokens, contas ou repositórios da empresa neste piloto.

O Cloudflare (projeto Pages, token e Account ID) e os secrets/variáveis básicos já foram configurados no piloto do Modelo T e continuam valendo. Abaixo está só o que muda para o Modelo R. O setup completo original está na tag `modelo-t-final`.

## Modelo R: checklist

### 1. Labels (_Issues → Labels_)

| Label           | Uso                                    |
| --------------- | -------------------------------------- |
| `homol`         | coloca a PR em homol                   |
| `release:minor` | o merge desta PR gera uma versão minor |
| `release:major` | o merge desta PR gera uma versão major |

### 2. Variáveis (_Settings → Secrets and variables → Actions → Variables_)

| Variável                      | Valor no piloto | Por quê                                                          |
| ----------------------------- | --------------- | ---------------------------------------------------------------- |
| `ENV_REQUIRE_APPROVED_REVIEW` | `false`         | o GitHub não deixa você aprovar a própria PR; na empresa, omitir |
| `ENV_DEV_ENABLED`             | (omitir)        | só defina `false` em projetos sem dev                            |

`CF_PAGES_PROJECT`, `CLOUDFLARE_ACCOUNT_ID` e o secret `CLOUDFLARE_API_TOKEN` continuam como estão.

### 3. Environments (_Settings → Environments_)

| Environment  | Required reviewers | Deployment branches and tags                 | Situação                   |
| ------------ | ------------------ | -------------------------------------------- | -------------------------- |
| `dev`        | nenhum             | Selected: branch `main`                      | já existe                  |
| `homol`      | você               | Selected: branch `main` (remover `hotfix/*`) | ajustar                    |
| `homol-sync` | **nenhum**         | Selected: branch `main`                      | **criar**                  |
| `production` | você               | Selected: branch `main` **e** tag `v*`       | ajustar (adicionar `main`) |

- `homol-sync` é o environment usado quando a remontagem de homol **não traz código novo** (decisão 8). O robô escolhe entre `homol` e `homol-sync`.
- `production` passa a aceitar `main` porque o deploy agora nasce do merge (push na `main`). A tag `v*` continua para o rollback.

### 4. Pull requests (_Settings → General → Pull Requests_)

- Marque só **Allow squash merging** (desmarque merge commit e rebase).
- Em "Default commit message" do squash, escolha **Pull request title**: o histórico da `main` fica `título (#N)`, que o painel lê.
- Opcional: **Automatically delete head branches**.

### 5. Ruleset da `main` (_Settings → Rules → Rulesets_)

- `Require status checks to pass`: `checks` **e** `homol-published`.
  - `homol-published` só aparece na lista depois do primeiro deploy de homol. Se não aparecer, digite o nome.
- **Não** marque `Require branches to be up to date before merging`.
- Mantenha `Require a pull request` e `Block force pushes`.

### 6. Branches `env/*`

Não precisam de ruleset no piloto. O robô faz force-push nelas. Se quiser impedir push humano, crie um ruleset para `env/*` com `Restrict updates` e verifique se o GitHub permite adicionar o GitHub Actions na lista de bypass na sua conta. Se não permitir, deixe sem ruleset (o robô não conseguiria atualizar).

### 7. Primeira execução

1. Faça o merge da PR do Modelo R.
2. Aprove o deploy de produção (_Release production_).
3. _Actions → Env sync_ roda pelo push na `main`. A primeira montagem de homol pede aprovação (primeiro deploy montado).
4. Abra `https://homol.<projeto>.pages.dev/manifest.json` e `https://<projeto>.pages.dev/version.json` para conferir.
5. Abra `https://<projeto>.pages.dev`: **não** pode haver painel. Abra homol: painel com a matriz.

Depois siga o [PILOT.md](PILOT.md).

## Segurança (registro)

- O token do Cloudflare tem escopo apenas de Pages Edit na sua conta e com expiração. Revogue ao final do piloto.
- O código das PRs é buildado sem acesso ao token do Cloudflare (job separado, token do GitHub só de leitura).
- Na adoção pela empresa: OIDC da AWS com roles por ambiente em vez de chave estática; dev e homol internos, porque o painel mostra títulos de PR.
