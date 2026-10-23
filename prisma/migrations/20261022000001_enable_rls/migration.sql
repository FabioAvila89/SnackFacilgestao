-- Ativar Row Level Security (RLS) em todas as tabelas públicas
-- Sem políticas concedidas para 'anon' e 'authenticated', a API pública REST do Supabase
-- retorna 0 registros, protegendo os dados financeiros de acessos externos não autorizados.
-- O Prisma conecta diretamente via papel postgres (superuser), operando normalmente sem bloqueio.

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
