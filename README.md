# Trunk Flags Pilot

Piloto pessoal do **Modelo T: trunk-based development + feature flags** para 3 ambientes (dev, homol, production). App fictício, sem nenhum código, configuração ou dado de empresa.

- Setup das contas: [docs/SETUP.md](docs/SETUP.md)
- Roteiro de cenários do piloto: [docs/PILOT.md](docs/PILOT.md)

## Fluxo

```text
feat/x ──PR──▶ main ──auto──▶ dev
                 │
   release-homol (gera tag vX.Y.Z + GitHub pre-release) ──aprovação──▶ homol
                                                                         │ tester valida
   promote-prod (rodado a partir da tag) ──aprovação──▶ production ──▶ Release vira "latest"
```

| Ambiente   | Origem                              | Gate                | URL                                 |
| ---------- | ----------------------------------- | ------------------- | ----------------------------------- |
| dev        | todo push em `main`                 | só o review da PR   | `https://dev.<projeto>.pages.dev`   |
| homol      | workflow `release-homol` (cria tag) | aprovação no GitHub | `https://homol.<projeto>.pages.dev` |
| production | workflow `promote-prod` (na tag)    | aprovação no GitHub | `https://<projeto>.pages.dev`       |

Regras fixas:

- Só existe `main` + branches curtas de feature. **Uma PR por feature, sempre contra `main`.**
- `promote-prod` só aceita uma tag que já teve deploy com sucesso em homol, e bloqueia regressão acidental (rollback exige marcar `allow_rollback`).
- Hotfix padrão: fix-forward por `main`. Exceção: branch `hotfix/*` criada a partir da tag de produção (ver [docs/PILOT.md](docs/PILOT.md), cenário 4).

## Feature flags

Arquivos em `flags/`:

| Arquivo           | Conteúdo                                                                            |
| ----------------- | ----------------------------------------------------------------------------------- |
| `registry.json`   | Metadados de cada flag: `type` (`release`/`ops`), `owner`, `created`, `description` |
| `dev.json`        | `true`/`false` por flag no build de dev                                             |
| `homol.json`      | idem para homol                                                                     |
| `production.json` | idem para produção (protegido por CODEOWNERS)                                       |

As flags são lidas **no build** (`vite.config.ts` injeta o JSON do ambiente). Mudar uma flag = PR + deploy.

### Criar uma feature com flag

1. Adicione a flag em `flags/registry.json` e nos 3 JSONs de ambiente:
   - `dev.json` e `homol.json`: `true`
   - `production.json`: `false` (o CI reprova se nascer `true`)
2. No código, use **apenas** a API de `src/flags`:

   ```tsx
   <Feature flag="novoCheckout" fallback={<CheckoutAtual />}>
     <NovoCheckout />
   </Feature>
   ```

   ```ts
   const novoCheckout = useFlag('novoCheckout')
   ```

   O tipo `FlagName` é gerado de `registry.json`: nome errado não compila. O ESLint proíbe ler os JSONs ou `__FLAGS__` fora de `src/flags`.

3. Abra a PR contra `main`.

### Ativar em produção

PR **isolada** alterando só `flags/production.json` (`false` → `true`). O CI reprova se a PR misturar ativação com código. Depois do merge: `release-homol` → `promote-prod`.

### Remoção (automática)

O workflow `flags-cleanup` roda toda segunda-feira. Ele detecta release flags `true` em todos os ambientes há 14 dias ou mais (a data vem do `git log` de `production.json`) e abre uma PR por flag rodando o codemod `scripts/flags-remove.ts`. O codemod:

- remove a flag dos 4 JSONs;
- troca `<Feature flag="x">` pelos children;
- troca `useFlag('x')` / `isFlagEnabled('x')` por `true` e simplifica `if`/ternário/`&&`;
- apaga o componente do `fallback` quando ele não tem outros usos.

Nada é mergeado sozinho: um humano revisa a PR. O que o codemod não resolver, o `tsc` aponta (a flag some do tipo `FlagName`). Flags `type: "ops"` (kill switches permanentes) nunca são removidas automaticamente.

## Scripts

| Comando                                          | O que faz                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `bun dev`                                        | App local com flags de dev                                             |
| `bun run build:<env>`                            | Build com as flags e `.env.<env>` do ambiente                          |
| `bun run flags:check`                            | Consistência dos JSONs; com `BASE_REF=origin/main` valida regras de PR |
| `bun run flags:stale`                            | Lista flags prontas para remoção (`--min-days=N`, `--json`)            |
| `bun run flags:remove <flag>`                    | Codemod de remoção (local)                                             |
| `bun run lint` / `typecheck` / `test` / `format` | Qualidade                                                              |

## Workflows

| Arquivo             | Gatilho                          | Faz                                                                               |
| ------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `ci.yml`            | PR para `main`                   | flags:check, format, lint, typecheck, testes, build homol e produção              |
| `deploy-dev.yml`    | push em `main`                   | build dev → Cloudflare Pages alias `dev`                                          |
| `release-homol.yml` | manual (em `main` ou `hotfix/*`) | calcula versão, cria tag + pre-release, deploy homol com aprovação                |
| `promote-prod.yml`  | manual **a partir de uma tag**   | valida homol + anti-regressão, deploy produção com aprovação, Release vira latest |
| `flags-cleanup.yml` | segunda 12:00 UTC + manual       | abre PRs de remoção de flags                                                      |
# trunk-flags-pilot
