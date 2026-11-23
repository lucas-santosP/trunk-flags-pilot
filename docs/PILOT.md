# Roteiro do piloto

Objetivo: sentir na prática se o Modelo T resolve os problemas do modelo atual (3 PRs por feature, branches `-dev`/`-homol`, divergência entre homol e main) e quanto custa operá-lo.

Pré-requisito: [SETUP.md](SETUP.md) concluído, com o smoke test verde.

Para cada cenário, anote no final deste arquivo:

- quantas PRs e branches foram necessárias (comparando com o modelo atual);
- se houve conflito;
- o que foi estranho ou confuso.

---

## Cenário 1: duas features em paralelo, só uma aprovada

Simula o caso mais comum: dois devs, duas PRs independentes, homol aprova só uma.

1. Crie `feat/rodape-novo` com a flag `rodapeNovo` (dev/homol `true`, produção `false`). Ela troca um rodapé simples por um novo, usando `<Feature>`.
2. Crie `feat/tema-escuro-toggle` com a flag `temaToggle`, mesmas regras.
3. Abra as 2 PRs contra `main` e faça o merge das duas. Confirme que dev mostra as duas.
4. Rode `release-homol` (`minor`) e aprove. Homol mostra as duas.
5. Finja que o tester **aprovou `rodapeNovo` e reprovou `temaToggle`**.
6. Abra uma PR isolada mudando só `rodapeNovo` para `true` em `flags/production.json`. Merge → `release-homol` → `promote-prod` na nova tag.
7. Verifique em produção: rodapé novo **visível**, toggle de tema **invisível** (o código está lá, desligado).

Observe: nenhuma branch `-dev`/`-homol`, nenhum conflito, e a feature reprovada não bloqueou a aprovada.

Teste extra: abra uma PR que ativa `temaToggle` em produção **e** altera um arquivo em `src/`. O CI deve reprovar com "PR isolada".

## Cenário 2: feature grande em validação longa

Simula o caso que hoje gera as branches por ambiente.

1. Crie `feat/painel-grande` com a flag `painelGrande`. Faça **3 PRs pequenas** ao longo de alguns dias, todas atrás da mesma flag (não precisa terminar a feature para mergear).
2. Entre essas PRs, crie e entregue em produção **outras 2 features pequenas** (repetindo o cenário 1).
3. Verifique que `painelGrande` nunca bloqueou nada e nunca exigiu branch extra.

Observe: as branches de feature vivem horas ou poucos dias, não semanas, e o conflito fica restrito a quem mexe no mesmo arquivo.

## Cenário 3: ativação em produção

Coberto no passo 6 do cenário 1. Repita com a flag de exemplo `bannerBoasVindas`:

1. PR mudando só `flags/production.json` → `"bannerBoasVindas": true`.
2. Merge → `release-homol` → `promote-prod`.
3. Confira a Release no GitHub: as notas geradas listam a PR de ativação.

## Cenário 4: hotfix

### 4a. Padrão: fix-forward por main

1. Introduza um "bug" visível em produção (ex.: texto errado no cabeçalho) e leve até produção.
2. Enquanto isso, deixe em `main` pelo menos uma feature com flag desligada em produção.
3. Corrija o bug em uma PR → merge → `release-homol` (`patch`) → `promote-prod`.
4. Confirme: a correção chegou e a feature desligada continuou invisível.

### 4b. Exceção: branch de hotfix a partir da tag

Use quando `main` tiver algo que não pode ir para produção nem desligado.

1. Suponha que produção está em `vA.B.C` e `main` está à frente.
2. Crie a branch a partir da tag:

   ```bash
   git switch --create hotfix/texto-cabecalho vA.B.C
   ```

3. Corrija, faça o commit e o push da branch `hotfix/*`.
4. Rode `release-homol` escolhendo a branch `hotfix/texto-cabecalho` (`patch`). Ele gera `vA.B.(C+1)` a partir da tag mais próxima dessa branch.
5. Aprove homol → `promote-prod` a partir da nova tag.
6. Leve o fix para `main` com cherry-pick em uma PR normal:

   ```bash
   git switch --create fix/texto-cabecalho origin/main
   git cherry-pick <sha-do-fix>
   ```

Observe: o `promote-prod` aceita a tag de hotfix (ela passou por homol) e o guard anti-regressão não bloqueia.

## Cenário 5: remoção automática de flag

1. Depois de ativar `rodapeNovo` em produção (cenário 1), rode _Actions → Flags cleanup → Run workflow_ com `flag = rodapeNovo` (não precisa esperar 14 dias).
2. Abra a PR criada pelo bot. Feche e reabra a PR para disparar o CI (limitação do `GITHUB_TOKEN`).
3. Revise o diff: a flag sai dos 4 JSONs, o `<Feature>` vira só o componente novo e o rodapé antigo é apagado.
4. Teste o caso difícil: crie uma flag usada de forma "criativa" (ex.: `const ligado = useFlag('x')` passado como prop para outro componente). Rode a remoção e veja o que o codemod resolve sozinho e o que sobra para fazer à mão, apontado pelo `tsc` ou pelo review.

Para testar localmente, antes do workflow:

```bash
bun run flags:stale -- --min-days=0
bun run flags:remove rodapeNovo
bun run typecheck && bun run lint && bun run test
git restore . && git clean -fd src
```

## Cenário 6: rollback

### 6a. Desligar a flag

1. Com uma feature ativa em produção, abra uma PR isolada voltando a flag para `false` em `production.json`.
2. Merge → `release-homol` → `promote-prod`. Meça o tempo total.

### 6b. Voltar uma versão inteira

1. Rode `promote-prod` a partir de uma tag **mais antiga** que a atual. O guard deve **bloquear**.
2. Rode de novo com `allow_rollback = true`. Deve passar (após a aprovação).

Observe: o 6a é o rollback normal no Modelo T. O 6b é emergência. Com flags lidas no build, os dois levam minutos. Flags em runtime (opção B, fora deste piloto) levariam segundos.

---

## Diário do piloto

| Cenário | PRs (atual vs T) | Branches (atual vs T) | Conflitos | Tempo | Estranhezas |
| ------- | ---------------- | --------------------- | --------- | ----- | ----------- |
| 1       |                  |                       |           |       |             |
| 2       |                  |                       |           |       |             |
| 3       |                  |                       |           |       |             |
| 4a      |                  |                       |           |       |             |
| 4b      |                  |                       |           |       |             |
| 5       |                  |                       |           |       |             |
| 6       |                  |                       |           |       |             |

## Perguntas para decidir depois do piloto

- O custo de criar e usar flags é menor que o de manter branches `-dev`/`-homol`?
- Ativar em produção via PR + release + promote é rápido o suficiente, ou é preciso flags em runtime?
- O codemod resolveu a maioria das remoções sem trabalho manual?
- O tester consegue entender o que está ligado em homol? O painel "Flags neste build" ajuda?
- O que precisaria mudar para levar ao `web-sales-portal` (S3 + CloudFront, GitHub Environments da empresa)?
