# Setup das contas (GitHub + Cloudflare)

Tudo na sua **conta pessoal**. Nunca use tokens, contas ou repositórios da empresa neste piloto.

## 0. Ajustes locais antes do primeiro push

1. Troque `SEU_USUARIO_GITHUB` pelo seu usuário do GitHub em:
   - `.github/CODEOWNERS`
   - `flags/registry.json`
2. Se quiser outro nome de projeto no Cloudflare, anote: ele vira a variável `CF_PAGES_PROJECT`.

## 1. Cloudflare

1. Crie uma conta gratuita em `dash.cloudflare.com` (não exige cartão para Pages).
2. Copie o **Account ID**: no dashboard, em _Workers & Pages_ (ou na página de visão geral da conta), aparece na barra lateral.
3. Crie o projeto Pages pelo CLI, a partir da pasta do repo:

   ```bash
   bunx wrangler login
   bunx wrangler pages project create trunk-flags-pilot --production-branch main
   ```

   O nome precisa ser único em `pages.dev`. Se `trunk-flags-pilot` estiver ocupado, use outro (ex.: `trunk-flags-pilot-<sufixo>`).

4. Crie o **API token** com menor privilégio: _My Profile → API Tokens → Create Token → Custom token_:
   - Permissions: `Account` → `Cloudflare Pages` → `Edit`
   - Account Resources: `Include` → sua conta
   - TTL: defina uma data de expiração (ex.: 90 dias)
   - Copie o token **direto para o secret do GitHub** (passo 2.4). Não salve em arquivo, não commite.

URLs resultantes:

- produção: `https://<projeto>.pages.dev`
- homol: `https://homol.<projeto>.pages.dev`
- dev: `https://dev.<projeto>.pages.dev`

As URLs de alias são públicas. Para o piloto com app fictício isso é aceitável. Se quiser restringir, o Cloudflare Access (Zero Trust) protege por e-mail no plano gratuito.

## 2. GitHub

1. Crie um repositório **público** vazio (sem README, sem .gitignore) na sua conta. Público porque _required reviewers_ em Environments é gratuito apenas em repo público. Confirme na documentação do GitHub no momento do setup: regras de plano mudam.
2. Primeiro push:

   ```bash
   git add -A
   git commit -m "chore: scaffold trunk flags pilot"
   git remote add origin https://github.com/<usuario>/trunk-flags-pilot.git
   git push -u origin main
   ```

   O `deploy-dev` vai rodar e falhar até os passos abaixo estarem prontos. Basta rodar de novo depois (_Actions → Deploy dev → Re-run_).

3. **Settings → Actions → General → Workflow permissions**:
   - `Read and write permissions`
   - marque `Allow GitHub Actions to create and approve pull requests` (necessário para o `flags-cleanup`)

4. **Settings → Secrets and variables → Actions**:
   - Secret `CLOUDFLARE_API_TOKEN`: token do passo 1.4
   - Variable `CLOUDFLARE_ACCOUNT_ID`: Account ID do passo 1.2
   - Variable `CF_PAGES_PROJECT`: nome do projeto Pages

5. **Settings → Environments** (crie os 3):

   | Environment  | Required reviewers | Deployment branches and tags            |
   | ------------ | ------------------ | --------------------------------------- |
   | `dev`        | nenhum             | Selected: branch `main`                 |
   | `homol`      | você               | Selected: branches `main`, `hotfix/*`   |
   | `production` | você               | Selected: **tag** `v*` (nenhuma branch) |
   - Deixe `Prevent self-review` desmarcado (você é o único aprovador).
   - A regra de `production` aceitar só tags `v*` é o que garante, no próprio GitHub, que só versões taggeadas chegam em produção.

6. **Settings → Rules → Rulesets**:
   - Ruleset de branch para `main`:
     - `Require a pull request before merging`. Approvals = 0 se estiver sozinho (o GitHub não deixa aprovar a própria PR). Com uma segunda conta, use 1 e marque `Require review from Code Owners`.
     - `Require status checks to pass`: adicione `checks` (aparece depois da primeira PR).
     - `Block force pushes`.
   - Ruleset de tag para `v*`: `Restrict updates` e `Restrict deletions`. Tags de versão ficam imutáveis. Não restrinja _creation_, senão o workflow não consegue criar a tag.

## 3. Smoke test do pipeline

1. _Actions → Deploy dev_: verde. Abra a URL de dev: badge `dev`, banner novo, flag `ON`.
2. _Actions → Release homol → Run workflow_ (branch `main`, bump `minor`): cria `v0.1.0` e uma pre-release em _Releases_. Aprove o deploy. Na URL de homol: badge `homol`, versão `v0.1.0`, banner novo.
3. _Actions → Promote to production → Run workflow_, escolhendo em **Use workflow from** a tag `v0.1.0`. Aprove. Na URL de produção: badge `production`, **saudação antiga** (flag `OFF`). A Release `v0.1.0` vira `Latest`.

Se os 3 passos funcionarem, siga para [PILOT.md](PILOT.md).

## Segurança (registro)

- O token do Cloudflare tem escopo apenas de Pages Edit na sua conta e com expiração. Revogue ao final do piloto.
- Os secrets ficam apenas no GitHub. Nenhum arquivo do repo contém credenciais. Os `.env.<ambiente>` têm só URLs fictícias (`.invalid`).
- Na adoção pela empresa, o equivalente seria OIDC da AWS com roles por ambiente, em vez de chave estática.
