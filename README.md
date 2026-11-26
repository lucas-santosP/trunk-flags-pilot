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

| Quero...                          | Faço                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| colocar a feature em dev          | abrir a PR (não draft) e ter o review aprovado             |
| colocar a feature em homol        | aplicar o label `homol` e aprovar o deploy no GitHub       |
| tirar a feature de dev            | converter a PR em draft                                    |
| tirar a feature de homol          | remover o label `homol`                                    |
| atualizar a feature nos ambientes | dar push na branch da PR (o robô remonta)                  |
| levar a feature para produção     | merge da PR (exige `homol-published`) e aprovar o deploy   |
| fazer rollback                    | _Actions → Rollback production_ a partir de uma tag antiga |

## Regras do robô (`env-sync`)

1. **Quem entra:** PRs abertas contra `main`, não draft, do próprio repo, com CI verde e review aprovado (`ENV_REQUIRE_APPROVED_REVIEW=false` desliga a exigência de review, útil quando se está sozinho). CI pendente fica "aguardando".
2. **Ordem:** ordem de entrada no ambiente (homol: quando o label foi aplicado; dev: PRs de homol primeiro, depois pela data da aprovação). Quem já está no ambiente não sai por causa de quem chegou depois.
3. **Conflito:** a PR que chega depois é pulada. O robô comenta na PR com quem ela conflita e marca o status vermelho. O ambiente sobe sem ela.
4. **Build quebrado na combinação:** o robô remove as PRs na ordem inversa de entrada até o build passar e comenta nas removidas.
5. **Aprovação de homol:** só quando entra código novo (PR nova ou commit novo). Quando só sai PR (merge, label removido), sobe sozinho. Commit na main que não passou por homol também exige aprovação.
6. **Status `homol-published`:** fica verde no commit da PR quando ele entra num deploy de homol. É check obrigatório para o merge. Significa "este commit está publicado em homol", **não** "validado pelo QA". Um push novo zera o status até a próxima montagem, e a PR que sai de homol (label removido, draft) volta para pendente. Em dev, o mesmo vale para `dev-published` (informativo, não obrigatório).
7. **Dev opcional:** `ENV_DEV_ENABLED=false` desliga a montagem de dev.
8. **Cartão de status da PR:** o robô mantém um único comentário por PR com a tabela dev / homol / merge / produção e o próximo passo (aplicar o label `homol`, aprovar o deploy, fazer o merge). Quando um deploy pede aprovação, a linha mostra "⏳ aguardando aprovação · [Revisar e aprovar]" com o link do run. O comentário é editado a cada etapa (sem notificações novas).

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

| Workflow             | Gatilho                                                           | O que faz                                                   |
| -------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `ci.yml`             | PR                                                                | format, lint, typecheck, testes, builds, checagem de prod   |
| `env-sync.yml`       | push na main, label, draft, review, fim do CI, PR fechada, manual | monta dev e homol via `env-deploy.yml`                      |
| `env-sync-relay.yml` | evento na PR (label, draft, abertura, fechamento) ou review       | dispara o `env-sync` na `main`                              |
| `env-deploy.yml`     | chamado pelo `env-sync`                                           | planeja, monta, builda, decide aprovação, publica e reporta |
| `release-prod.yml`   | push na main                                                      | tag + pre-release + deploy de produção com aprovação        |
| `rollback-prod.yml`  | manual, a partir de uma tag                                       | redeploy de uma tag antiga em produção (pede `ROLLBACK`)    |

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
- Todo deploy de dev e homol roda com a ref `main` (os environments só aceitam `main`). Eventos de PR (label, draft, review etc.) apenas disparam o `env-sync` na `main` via `env-sync-relay.yml`: a montagem nunca roda vinculada à PR, então a PR mostra só o check `relay` e os status `dev-published`/`homol-published`, sem jobs cancelados ou pulados.
- Os `.env.<ambiente>` contêm só URLs fictícias (`.invalid`).
