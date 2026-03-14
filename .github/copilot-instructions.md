# Contexto persistente do projeto (OCS Financial)

## Objetivo
- Aplicação Next.js para controle financeiro mensal com autenticação OAuth2/PKCE, sessão via cookies e tokens, e módulo de features por plano.

## Pontos críticos de arquitetura
- Centralizar chamadas HTTP e autenticação em `lib/api.ts`.
- Rotas em `app/api/private/session/*` atuam como proxy para serviço de auth.
- Controle de acesso por feature/plano passa por `app/api/feature-access/route.ts` e `lib/feature-flags.ts`.
- Estado financeiro do cliente é orquestrado em `hooks/use-finance.ts` com autosave e reconciliação create/update.

## Regras obrigatórias ao alterar código
- Validar `state` no callback OAuth social antes de trocar `code` por token.
- Em proxies, preservar múltiplos cookies `Set-Cookie` do upstream (usar `append` e `getSetCookie` quando disponível).
- Em código server, preferir variáveis `API_*`/`FLAGSMITH_*` e usar `NEXT_PUBLIC_*` apenas como fallback de compatibilidade.
- Evitar forçar `Content-Type: application/json` em requests sem body.
- Não engolir erros silenciosamente em fluxos críticos; manter estado coerente e logs úteis.
- Manter mudanças pequenas e focadas, sem alterar design system ou UX além do necessário.

## Checklist rápido antes de concluir
- OAuth social: `state` armazenado no início e conferido no callback.
- Rotas proxy de sessão: forwarding correto de cookies múltiplos.
- Hook financeiro: `syncOfflineChanges` e `discardOfflineChanges` executam ações reais.
- Validar `pnpm lint` após mudanças relevantes.