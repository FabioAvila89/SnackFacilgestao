-- ==============================================================================
-- MIGRAÇÃO DE PERFORMANCE: OTIMIZAÇÃO DE ÍNDICES MULTI-TENANT (FASE 3)
-- Sistema Snack Fácil - Aplicável via Supabase SQL Editor ou psql
-- ==============================================================================

-- 1. Remoção de índices obsoletos e redundantes em "Transaction"
DROP INDEX IF EXISTS "Transaction_date_idx";
DROP INDEX IF EXISTS "Transaction_categoryId_idx";
DROP INDEX IF EXISTS "Transaction_accountId_idx";
DROP INDEX IF EXISTS "Transaction_dueDate_idx";
DROP INDEX IF EXISTS "Transaction_date_kind_status_idx";
DROP INDEX IF EXISTS "Transaction_dueDate_status_idx";
DROP INDEX IF EXISTS "Transaction_accountId_date_idx";
DROP INDEX IF EXISTS "Transaction_categoryId_date_idx";
DROP INDEX IF EXISTS "Transaction_supplierId_idx";
DROP INDEX IF EXISTS "Transaction_isRecurring_idx";
DROP INDEX IF EXISTS "Transaction_installmentGroupId_idx";
DROP INDEX IF EXISTS "Transaction_organizationId_idx";
DROP INDEX IF EXISTS "Transaction_status_idx";

-- 2. Criação dos novos índices compostos otimizados liderados por "organizationId"
-- Cobre Dashboard, Relatórios de Fluxo, DRE e busca paginada com ordenação por data
CREATE INDEX IF NOT EXISTS "Transaction_organizationId_date_status_kind_idx" 
  ON "Transaction"("organizationId", "date", "status", "kind");

-- Cobre Contas a Pagar/Receber e filtros por data de vencimento
CREATE INDEX IF NOT EXISTS "Transaction_organizationId_status_dueDate_idx" 
  ON "Transaction"("organizationId", "status", "dueDate");

-- Cobre Extrato por Conta e filtros bancários
CREATE INDEX IF NOT EXISTS "Transaction_organizationId_accountId_date_idx" 
  ON "Transaction"("organizationId", "accountId", "date");

-- Cobre Relatórios de Despesas por Categoria e drill-down
CREATE INDEX IF NOT EXISTS "Transaction_organizationId_categoryId_date_idx" 
  ON "Transaction"("organizationId", "categoryId", "date");

-- Cobre Filtros por Fornecedor
CREATE INDEX IF NOT EXISTS "Transaction_organizationId_supplierId_idx" 
  ON "Transaction"("organizationId", "supplierId");

-- Cobre Busca de Lançamentos Recorrentes
CREATE INDEX IF NOT EXISTS "Transaction_organizationId_isRecurring_idx" 
  ON "Transaction"("organizationId", "isRecurring");

-- Cobre Desdobramento e Agrupamento de Parcelamentos
CREATE INDEX IF NOT EXISTS "Transaction_organizationId_installmentGroupId_idx" 
  ON "Transaction"("organizationId", "installmentGroupId");

-- 3. Otimização de índices em "AuditLog"
DROP INDEX IF EXISTS "AuditLog_organizationId_idx";
DROP INDEX IF EXISTS "AuditLog_createdAt_idx";

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" 
  ON "AuditLog"("organizationId", "createdAt" DESC);

-- 4. Otimização de índices em "StockMovement"
DROP INDEX IF EXISTS "StockMovement_organizationId_idx";
DROP INDEX IF EXISTS "StockMovement_expirationDate_idx";
DROP INDEX IF EXISTS "StockMovement_createdAt_idx";

-- Cobre Alerta de Lotes Próximos ao Vencimento
CREATE INDEX IF NOT EXISTS "StockMovement_organizationId_type_expirationDate_idx" 
  ON "StockMovement"("organizationId", "type", "expirationDate");

-- Cobre Histórico Paginado de Movimentações Ordenado por Data
CREATE INDEX IF NOT EXISTS "StockMovement_organizationId_createdAt_idx" 
  ON "StockMovement"("organizationId", "createdAt" DESC);

