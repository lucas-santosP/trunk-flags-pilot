# Roteiro do piloto (Modelo R)

Objetivo: verificar se montar dev e homol a partir de PRs elimina os conflitos de branches de ambiente e as PRs de promoção, e quanto custa operar.

Pré-requisito: [SETUP.md](SETUP.md), seção "Modelo R", concluída.

Para cada cenário, anote no diário no final:

- quantas PRs e cliques foram necessários (comparando com o modelo atual de 3 PRs);
- se houve conflito e como foi resolvido;
- o que foi estranho ou confuso.

As features dos cenários são fictícias. Exemplos de mudanças pequenas: trocar o texto do banner, adicionar um rodapé, mudar a cor do cartão.

---

## Cenário 1: feature normal

1. Branch `feat/rodape` a partir da `main`, PR contra `main`.
2. CI verde → o robô monta **dev** com a PR. Confira o painel em dev: `#N ✓ no ar` em dev.
3. Aplique o label `homol` → o robô pede aprovação do deploy de homol. Veja o resumo do run (PRs incluídas e motivo da aprovação) e aprove.
4. Na PR, o status `homol-published` fica verde.
5. Merge → _Deploy production_ cria a tag e aguarda aprovação → aprove.
6. Observe que homol e dev são remontados **sem pedir aprovação** (a PR saiu das PRs e passou a vir da main).

## Cenário 2: duas features em homol, só uma vai para produção

1. Duas PRs (`feat/a`, `feat/b`) com o label `homol`, mexendo em arquivos diferentes.
2. As duas aparecem em homol.
3. Merge só da `feat/b` → produção recebe só B. A continua em homol.
4. Remova o label de A → homol remontado sem A, **sem aprovação** (só saiu código).

## Cenário 3: conflito entre duas PRs

1. `feat/c` e `feat/d` alteram **a mesma linha** do banner.
2. Label `homol` em C, depois em D.
3. Esperado: C entra, D é pulada. Comentário em D: "conflita com #C em ...". Status `homol-published` vermelho em D.
4. Resolva: faça o merge de C, atualize D com a `main` e dê push → D entra na próxima montagem (pede aprovação: código novo).

## Cenário 4: build quebrado só na combinação

1. `feat/e` renomeia um componente (ex.: `DigitalCard` → `MemberCard`) e atualiza o `app.tsx`.
2. `feat/f`, criada antes de E, adiciona um segundo uso de `DigitalCard` em outro arquivo.
3. Cada uma tem CI verde sozinha. Label `homol` em E, depois em F.
4. Esperado: o build de homol falha com as duas, o robô remove F (a última que entrou) e comenta "build falha com esta PR somada a #E".

## Cenário 5: hotfix

1. `fix/texto-banner` com a correção. Label `homol` → aprova homol → valida.
2. Merge → aprova produção.
3. Observe que dev e homol recebem a correção ao serem remontados sobre a nova `main`: não há propagação manual.

Pergunta para o diário: quanto tempo do push à produção, contando as 2 aprovações?

## Cenário 6: reprovação em homol

1. PR com label `homol`, QA "reprova".
2. Remova o label → homol volta ao estado anterior sem a feature, sem aprovação. O status `homol-published` da PR volta para pendente e o merge fica bloqueado.
3. Corrija com push e reaplique o label.

## Cenário 7: rollback

1. _Actions → Rollback production_, em "Use workflow from" escolha uma tag anterior, digite `ROLLBACK`, aprove.
2. Confira o `/version.json` de produção e a coluna "prod" do painel em homol.
3. Próximo merge na `main` sobe normalmente a versão nova.

## Cenário 8: garantia de que o painel não vaza para produção

1. Abra uma PR que mude o guard em `src/app.tsx` para renderizar o `EnvPanel` sempre.
2. Esperado: o `check:production-bundle` falha o CI.

---

## Diário

"Cliques" = ações humanas equivalentes (abrir PR, label, aprovar, merge), sem contar resolução de conflito. Nos testes automatizados de 27/11, as aprovações foram feitas pela API com a conta do dono do repo.

| Data       | Cenário                         | PRs              | Cliques | Conflitos                 | Observações                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------- | ---------------- | ------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-26 | 1. Feature normal               | #8, #10          | 5       | —                         | Fluxo completo. Motivou o cartão de status (#12, #13) e a separação dos workflows (#18).                                                                                                                                                                                                                                                      |
| 2026-11-26 | 3. Conflito entre PRs           | #16, #17         | 9       | 1 (mesma linha do rodapé) | Label aplicado primeiro na #17 inverteu a ordem: em dev, PR de homol passa na frente (decisão: manter). Conflito resolvido na própria branch após o merge da outra. Ajustes em #18.                                                                                                                                                           |
| 2026-11-27 | 4. Build quebrado na combinação | #19 (E), #20 (F) | 8       | 0 textuais, 1 de build    | **2 bugs corrigidos na #21**: PR pulada não era reportada quando o ambiente não mudava; regra "remover a mais recente" tirava PRs inocentes (#21). Depois do merge de E, o próprio CI de F quebrou (TS2307) e o autor corrigiu o import.                                                                                                      |
| 2026-11-27 | 6. Reprovação em homol          | #20              | 3       | —                         | Remover o label: homol sem aprovação, `homol-published` → pending, cartão ⬜ "fora", merge bloqueado. Push + label → volta com aprovação.                                                                                                                                                                                                     |
| 2026-11-27 | 2. Duas features, uma vai       | #20, #22 (G)     | 5       | —                         | Produção recebeu só G (`v0.1.19`); homol remontado sem aprovação. #20 fechada sem merge saiu de dev e homol.                                                                                                                                                                                                                                  |
| 2026-11-27 | 8. Painel em produção           | #23              | 1       | —                         | CI falhou em `check:production-bundle` ("o painel de ambientes vazou para produção"); PR pulada em dev por CI vermelho.                                                                                                                                                                                                                       |
| 2026-11-27 | 7. Rollback                     | —                | 2       | —                         | `v0.1.19` → `v0.1.18` em produção. O rollback marcou a `v0.1.18` como Latest; a release seguinte (`v0.1.20`) recalculou as PRs a partir dela e atualizou o cartão da #22. Entre o rollback e a `v0.1.20`, o cartão da #22 ainda dizia "em produção na v0.1.19" (corrigido: o rollback marca as PRs revertidas). Restaurado pelo merge da #24. |

### Achados em aberto

- **Proposta pendente:** trava no deploy de produção contra publicar versão mais antiga que a que está no ar (fora do rollback).
- **Não testado:** review obrigatório (`ENV_REQUIRE_APPROVED_REVIEW` e "most recent push" ligados) exige uma segunda conta; projeto sem dev (apagar `deploy-dev.yml`).
