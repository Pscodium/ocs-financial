# Feature: Financial Transactions (Frontend)

## Contexto e motivação

Hoje o dashboard financeiro trabalha com duas categorias fixas por mês:

- **Entradas & Saldos** (`income`) — salário, adiantamento etc.
- **Despesas & Contas** (`bills`) — contas fixas/recorrentes do mês, agrupadas em categorias (Contas casa, Contas Distribuição...).

Falta um terceiro conceito: **gasto pontual/avulso do dia a dia** (ex.: um lanche, uma compra impulsiva, um Uber) que não é uma "conta" nem merece virar categoria. Isso é a feature **Transactions**.

Diferença chave:
- **Conta (bill)** = compromisso mensal recorrente, parte do orçamento planejado.
- **Transaction** = gasto pontual de um dia específico dentro do mês, fora do planejamento de contas.

Separar os dois dá visibilidade real de "quanto gastei além do que já estava programado".

## Feature flag

- Nome: `financial_transactions`
- Já existe no backend/plano do usuário. Falta o front reconhecer.
- **Não é uma flag de rota/aba** como as existentes em `lib/feature-flags.ts` (`TabRoute`/`TAB_TO_FEATURE`, que controlam abas de `/budgets`, `/investments`, etc.). É uma flag de **seção dentro da Dashboard** (`/`), não uma rota nova.
- Backend (`GET /financial/identity`) já trata e retorna essa flag no feature map, junto das demais — confirmado. Front não precisa esperar mudança de contrato nesse endpoint.
- Precisa ser adicionada em:
  - `lib/feature-flags.ts` → incluir `"financial_transactions"` na union `FeatureName` (linhas 3-9) e em `KNOWN_FEATURES` (linhas 14-20), para passar por `isKnownFeature()` no mapeamento vindo da API.
  - Como não é uma tab, **não** entra em `TAB_TO_FEATURE`/`TabFeatureAccess`. Precisamos de um jeito de consumir o flag bruto (booleano) direto do feature map, não via `usePlanFeatures().featureAccess[route]`.
  - Caminho definido: expor no retorno de `/api/feature-access` (`app/api/feature-access/route.ts`) um campo extra ao lado de `access`, ex. `{ access: TabFeatureAccess, flags: { financial_transactions: boolean } }`, construído a partir do mesmo `featureMap` já resolvido por `fetchFeaturesByIdentity` (hoje esse mapa é usado só para gerar `TabFeatureAccess` e descartado — passar a devolver também o mapa cru, ou pelo menos as chaves não-tab). `usePlanFeatures()` passa a retornar também esse `flags` (ou criar hook irmão `useFeatureFlag(name)` que lê do mesmo cache/query).

## Onde a feature aparece na UI

No `app/page.tsx` (Dashboard), dentro da mesma área hoje ocupada pelas seções "Entradas & Saldos" (linha ~463) e "Despesas & Contas" (linha ~563) — **não** é uma aba do `AppTabs` (`components/app-tabs.tsx`), é uma seção adicional na própria página `/`.

Comportamento dinâmico, discreto, sem virar "mais uma categoria":

1. **Se a flag `financial_transactions` está desabilitada**: seção não aparece, nada muda.
2. **Se habilitada e o mês atual JÁ TEM transações registradas**: renderiza um bloco/card de "Transações" — visualmente diferenciado das duas seções existentes (não é `CategoryCard`), estilo mais leve/dinâmico (ex.: lista compacta, tags de data, cor de destaque própria — não verde de income nem vermelho de despesa fixa, sugestão: um terceiro tom, tipo âmbar/roxo, para reforçar que é "outra métrica").
3. **Se habilitada e o mês atual NÃO tem transações ainda**: no lugar do bloco, aparece um **botão discreto** tipo "Registrar transação" / "+ Gasto pontual" — baixo destaque visual (ghost/outline, não um card cheio), convidando a ação sem poluir o dashboard.
4. Registro deve ser **rápido**: idealmente um modal/drawer simples com poucos campos (descrição, valor, data do gasto dentro do mês, tag opcional com autocomplete de tags já usadas), sem fluxo de múltiplas etapas — abre com um clique no botão, salva com um clique.

## Modelo de dados (frontend)

Novo tipo em `lib/types.ts`, seguindo o padrão de `Bill`/`Budget`/`Investment` já existentes:

```ts
interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // data específica do gasto, dentro do mês (ISO date)
  createdAt: string;
  tag?: string; // texto livre, categorização leve (ex: "lazer", "comida")
}
```

`tag` é texto livre (não enum), mas o registro rápido deve sugerir tags já usadas pelo usuário no mês/histórico (autocomplete simples a partir de `transactions[].tag` já existentes), para não exigir digitação toda vez e ainda manter alguma consistência nas tags usadas.

`MonthData` (linhas 23-31) ganha campo opcional novo:

```ts
transactions?: Transaction[];
```

Seguindo o mesmo padrão de `budgets`, `investments`, `goals`, `subscriptions` — dado embutido no documento do mês, não uma entidade separada com sua própria query key.

## Impacto no cálculo do dashboard

Toda a lógica de totais vive em `hooks/use-finance.ts`. Pontos que precisam mudar:

- `getGrandTotal()` (580-583) e `getGrandPaid()` (585-588) somam hoje só `bills` de categorias. **Transações NÃO devem entrar nesse somatório** — são conceitualmente diferentes de "conta mensal planejada". Misturar quebraria a separação que é o próprio objetivo da feature.
- Em vez disso, criar novos getters dedicados:
  - `getTransactionsTotal()` → soma `transactions[].amount` do mês atual.
  - Transação é **sempre paga** no momento do registro (confirmado) — gasto já realizado, sem estado pendente. Não precisa de lógica paid/pending como `bills`; não entra em "Pago"/"Pendente" dos cards de topo.
- `getSobra()` (605-607) hoje é `getIncomeTotal() - getMyShare()`. Precisa descontar também as transações do mês: `getSobra() = getIncomeTotal() - getMyShare() - getTransactionsTotal()`, já que gasto pontual também sai do saldo disponível real.
- `SummaryCards` (`components/summary-cards.tsx`) — os cards "Saldo em Conta" e "Sobra do Mês" precisam refletir o desconto das transações. Considerar se vale adicionar um indicador/tooltip explicando "inclui X gasto em transações avulsas" para não confundir o usuário sobre por que a sobra caiu sem mexer em contas.
- `app/page.tsx:238-269` — onde os totais são computados e passados a `SummaryCards`, precisa incluir `transactionsTotal` no cálculo de `sobra` antes de passar adiante.
- Considerar se `MonthlyChart` (linhas 680-692, evolução financeira) deve incorporar transações na série histórica — recomendado sim, como uma linha/barra separada, para manter a distinção visual entre "gasto planejado" e "gasto avulso".

## API client (frontend)

Seguir exatamente o padrão de `budgets`/`investments`/`goals`/`subscriptions` em `lib/api.ts` (linhas 775-884):

```
GET    /months/{monthKey}/transactions
POST   /months/{monthKey}/transactions
PUT    /months/{monthKey}/transactions/:id
DELETE /months/{monthKey}/transactions/:id
```

Novas funções no objeto `api`: `getTransactions`, `createTransaction`, `updateTransaction`, `deleteTransaction`, usando `fetchWithAuth` como as demais.

## Escopo do que muda no front (resumo)

1. `lib/feature-flags.ts` — adicionar `financial_transactions` a `FeatureName`/`KNOWN_FEATURES`.
2. Mecanismo de leitura de flag "solta" (não-tab) — novo hook ou extensão de `usePlanFeatures`.
3. `lib/types.ts` — nova interface `Transaction`, campo `transactions?` em `MonthData`.
4. `lib/api.ts` — CRUD de transactions.
5. `hooks/use-finance.ts` — `getTransactionsTotal()`, ajuste em `getSobra()`.
6. `app/page.tsx` — nova seção condicional (bloco de transações OU botão "Registrar transação"), reposicionada onde hoje está a área vazia entre as duas colunas (ver captura de tela do usuário — área abaixo de "Entradas & Saldos" no layout de 2 colunas).
7. Novo componente `components/transactions-section.tsx` (ou nome similar) com estilo próprio, diferenciado de `CategoryCard`.
8. Modal/drawer de registro rápido de transação (novo componente, poucos campos, um clique para abrir e salvar).
9. `components/summary-cards.tsx` — refletir transações em "Sobra do Mês" (e opcionalmente "Saldo em Conta"), com indicação visual de que inclui gasto avulso.
10. `components/monthly-chart.tsx` (avaliar) — incluir série de transações no gráfico de evolução.

## Decisões confirmadas

- Flag `financial_transactions` já tratada e retornada por `GET /financial/identity` no `ocs-api` — front só precisa consumi-la, sem depender de mudança de contrato no backend além do que já existe.
- Transação é sempre paga (sem estado pendente).
- `tag` é texto livre, com sugestão/autocomplete das tags já usadas pelo usuário.
