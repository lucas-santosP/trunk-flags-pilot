# Branch Envs Pilot

Piloto pessoal do **Modelo R: ambientes montados a partir de PRs** para 3 ambientes (dev, homol, production). App fictício, sem nenhum código, configuração ou dado de empresa.

O piloto anterior (Modelo T, trunk-based + feature flags) está preservado na tag `modelo-t-final` e na branch `archive/modelo-t`.

- Setup das contas: [docs/SETUP.md](docs/SETUP.md)
- Roteiro de cenários: [docs/PILOT.md](docs/PILOT.md)

## Ideia central

`main` é produção. `env/dev` e `env/homol` **não são branches de trabalho**: um robô as recria do zero sempre que algo muda.

```text
env/dev   = main + PRs com review aprovado (as de homol primeiro)
env/homol = main + PRs com label "homol"
prod      = main (cada merge gera uma release que aguarda aprovação)
```

Ninguém faz PR para dev ou homol. **Uma PR por feature, sempre contra `main`.**

| Quero...                          | Faço                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| colocar a feature em dev          | abrir a PR (não draft) e ter o review aprovado                                             |
| colocar a feature em homol        | aplicar o label `homol` e aprovar o deploy no GitHub                                       |
| tirar a feature de dev            | converter a PR em draft                                                                    |
| tirar a feature de homol          | remover o label `homol`                                                                    |
| atualizar a feature nos ambientes | dar push na branch da PR (o robô remonta)                                                  |
| levar a feature para produção     | merge da PR (exige `homol-published`) e aprovar o deploy                                   |
| hotfix direto para produção       | label `hotfix` (só techlead): dispensa homol; CI, review e aprovação de produção continuam |
| fazer rollback                    | _Actions → Rollback production_ (a partir da `main`, informando a tag)                     |

## Regras do robô (_Deploy dev_ e _Deploy homol_)

1. **Quem entra:** PRs abertas contra `main`, não draft, do próprio repo, com CI verde e review aprovado (`ENV_REQUIRE_APPROVED_REVIEW=false` desliga a exigência de review, útil quando se está sozinho). CI pendente fica "aguardando".
2. **Ordem:** ordem de entrada no ambiente.
   - **homol:** pela ordem em que o label `homol` foi aplicado. Quem já está em homol não sai por causa de quem chegou depois.
   - **dev:** primeiro as PRs de homol (na mesma ordem de homol), depois as demais pela data da aprovação do review (ou de criação, sem review obrigatório). Assim dev é sempre um superconjunto de homol. Consequência: uma PR que recebe o label `homol` passa na frente em dev e, se conflitar, tira de dev uma PR que já estava lá.
3. **Conflito:** a PR que chega depois é pulada. O robô comenta na PR com quem ela conflita e marca o status vermelho. O ambiente sobe sem ela.
4. **Build quebrado na combinação:** o robô confirma que a `main` sozinha builda e adiciona as PRs uma por vez, na ordem de entrada. Só fica de fora quem quebra o build somada às anteriores; as PRs que chegaram depois dela continuam entrando. O robô comenta nas removidas.
5. **Aprovação de homol:** só quando entra código novo (PR nova ou commit novo). Quando só sai PR (merge, label removido), sobe sozinho. Quando só muda a lista de PRs puladas (ex.: uma PR nova conflita ou quebra o build), também sobe sozinho, para registrar o motivo no manifesto, no status e no cartão da PR. Commit na main que não passou por homol também exige aprovação.
6. **Status `homol-published`:** fica verde no commit da PR quando ele entra num deploy de homol. É check obrigatório para o merge. Significa "este commit está publicado em homol", **não** "validado pelo QA". Um push novo zera o status até a próxima montagem, e a PR que sai de homol (label removido, draft) volta para pendente. Em dev, o mesmo vale para `dev-published` (informativo, não obrigatório).
7. **Dev opcional:** dev existe se o repositório tem `.github/workflows/deploy-dev.yml`. Projeto sem dev: apague esse arquivo (o cartão da PR deixa de mostrar a linha de dev).
8. **Hotfix:** ao aplicar o label `hotfix`, o robô marca `homol-published` do **commit atual** como "dispensado (hotfix por @fulano)", sem passar por homol. Roda só no evento do label (job `trigger`), nunca nos deploys. Um push depois do label não herda a dispensa: o techlead precisa reaplicar o label, como um review descartado por push novo. Só vale se quem aplicou tem papel `maintain` ou `admin` (configurável em `HOTFIX_ALLOWED_ROLES`); senão o robô remove o label e comenta. Remover o label volta o status para pendente. Depois do merge, dev e homol recebem a correção ao serem remontados sobre a `main`, **sem** pedir aprovação de homol (o commit de hotfix não conta como "entrou na main sem passar por homol"). Use como exceção: para incidente, prefira rollback e corrija pelo caminho normal.
9. **Cartão de status da PR:** o robô mantém um único comentário por PR com a tabela dev / homol / merge / produção e o próximo passo (aplicar o label `homol`, aprovar o deploy, fazer o merge). Quando um deploy pede aprovação, a linha mostra "⏳ aguardando aprovação · [Revisar e aprovar]" com o link do run. O comentário é editado a cada etapa (sem notificações novas).

As branches `env/dev` e `env/homol` são publicadas para inspeção (`git checkout env/homol`) e contêm `env-manifest.json` com o que foi montado. A atualização delas é best-effort: o `GITHUB_TOKEN` não pode publicar mudanças em `.github/workflows`, então uma PR que mexe em workflow não atualiza a branch (o deploy acontece normalmente).

## Produção

- Cada merge na `main` cria a tag `vX.Y.Z` (patch, ou `minor`/`major` com o label `release:minor`/`release:major` na PR) como pre-release, e o deploy aguarda aprovação no environment `production`.
- Merges seguidos substituem a release pendente: o aprovador aprova uma vez a mais nova, que contém tudo.
- A linha "produção" do cartão de cada PR da release mostra "⏳ release vX aguardando aprovação · [Revisar e aprovar]" e depois "🚀 em produção". Com releases substituídas, a PR é atualizada para a versão mais nova (a lista vai da última release publicada até o commit atual).
- Merge na `main` **não** sobe sozinho: a aprovação do deploy é o gate de produção, como no processo atual da empresa.

## Painel de ambientes

Dev e homol mostram uma matriz **PR × ambiente** (✓ no ar, ⚠ pulada com motivo, … aguardando CI, — fora).

- Cada ambiente montado publica `/manifest.json`. Produção publica **apenas** `/version.json` (`environment`, `version`, `sha`).
- O painel **não existe em produção**: o código fica atrás de `__APP_ENV__ !== 'production'` (removido do bundle pelo Vite) e o `check:production-bundle` falha o CI e o deploy se o build de produção contiver o painel ou o manifesto.
- Os títulos das PRs aparecem em dev e homol. Na empresa, esses ambientes precisam ser internos (ou protegidos).

## Workflows

| Workflow                  | Gatilho                                                               | O que faz                                                                                                |
| ------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ci.yml`                  | PR                                                                    | format, lint, typecheck, testes, builds, checagem de prod                                                |
| `deploy-dev.yml`          | push na main, fim do CI, manual ou disparo do trigger                 | monta dev via `_deploy-env.yml` (opcional por projeto)                                                   |
| `deploy-homol.yml`        | push na main, fim do CI, manual ou disparo do trigger                 | monta homol via `_deploy-env.yml`                                                                        |
| `trigger-deploy-envs.yml` | evento na PR (label, draft, abertura, fechamento sem merge) ou review | dispara `deploy-dev.yml` (se existir) e `deploy-homol.yml` na `main`                                     |
| `_deploy-env.yml`         | só chamado por `deploy-dev.yml` e `deploy-homol.yml` (prefixo `_`)    | planeja, monta, builda, decide aprovação, publica e reporta                                              |
| `deploy-production.yml`   | push na main                                                          | tag + pre-release + deploy de produção com aprovação                                                     |
| `rollback-production.yml` | manual, a partir da `main`, com a tag como parâmetro                  | redeploy de uma tag em produção (pede `ROLLBACK`), marca a tag como Latest e as PRs revertidas no cartão |

## Scripts

| Script                                            | Uso                                                         |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `bun run env:plan <env> <saída>`                  | lista candidatas, puladas e aguardando (lê a API do GitHub) |
| `bun run env:assemble <plano> <manifesto>`        | monta e builda com remoção automática                       |
| `bun run env:approval <manifesto> <url-anterior>` | decide se há mudança e se precisa aprovação                 |
| `bun run env:publish <manifesto> <versão>`        | atualiza `env/<env>`, status e comentários                  |
| `bun run check:production-bundle`                 | garante que o build de produção não tem painel/manifesto    |
| `bun run release:next-version <bump>`             | próxima tag                                                 |

Os scripts de montagem rodam a partir de uma cópia feita **da main** antes de montar: uma PR não consegue alterar as regras que a avaliam.

## Segurança (registro)

- O código das PRs é buildado num job **sem secrets e com token só de leitura**. O token do Cloudflare só existe no job de deploy, que publica o `dist` já pronto.
- Só entram PRs do próprio repositório (forks são ignorados) e com review aprovado.
- Todo deploy de dev e homol roda com a ref `main` (os environments só aceitam `main`). Eventos de PR (label, draft, review etc.) apenas disparam `deploy-dev.yml` e `deploy-homol.yml` na `main` via `trigger-deploy-envs.yml`: a montagem nunca roda vinculada à PR, então a PR mostra só o check `trigger` e os status `dev-published`/`homol-published`, sem jobs cancelados ou pulados.
- Os `.env.<ambiente>` contêm só URLs fictícias (`.invalid`).
