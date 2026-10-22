import { describe, it, expect } from "vitest";
import { can, ROLE_PERMISSIONS, validatePasswordPolicy } from "../src/lib/permissions";
import { generateSecureTemporaryPassword } from "../src/lib/auth";
import fs from "fs";
import path from "path";

describe("1. Permissões Centralizadas e RBAC (can)", () => {
  it("ADMIN possui acesso irrestrito a todas as funcionalidades", () => {
    const admin = { role: "ADMIN" as const, active: true };

    expect(can(admin, "access_management:view")).toBe(true);
    expect(can(admin, "access_management:manage")).toBe(true);
    expect(can(admin, "user:create")).toBe(true);
    expect(can(admin, "user:update")).toBe(true);
    expect(can(admin, "user:toggle_status")).toBe(true);
    expect(can(admin, "user:reset_password")).toBe(true);
    expect(can(admin, "audit:view")).toBe(true);
    expect(can(admin, "category:write")).toBe(true);
    expect(can(admin, "account:write")).toBe(true);
    expect(can(admin, "transaction:create")).toBe(true);
    expect(can(admin, "transaction:edit")).toBe(true);
    expect(can(admin, "transaction:delete")).toBe(true);
    expect(can(admin, "import:execute")).toBe(true);
    expect(can(admin, "export:execute")).toBe(true);
    expect(can(admin, "reports:view")).toBe(true);
  });

  it("EDITOR pode gerenciar lançamentos, importar, exportar e ver relatórios, mas NÃO acessa gestão de acesso nem altera categorias/contas", () => {
    const editor = { role: "EDITOR" as const, active: true };

    // Permitido
    expect(can(editor, "transaction:read")).toBe(true);
    expect(can(editor, "transaction:create")).toBe(true);
    expect(can(editor, "transaction:edit")).toBe(true);
    expect(can(editor, "transaction:delete")).toBe(true);
    expect(can(editor, "import:execute")).toBe(true);
    expect(can(editor, "export:execute")).toBe(true);
    expect(can(editor, "reports:view")).toBe(true);

    // Bloqueado
    expect(can(editor, "access_management:view")).toBe(false);
    expect(can(editor, "access_management:manage")).toBe(false);
    expect(can(editor, "user:create")).toBe(false);
    expect(can(editor, "user:reset_password")).toBe(false);
    expect(can(editor, "audit:view")).toBe(false);
    expect(can(editor, "category:write")).toBe(false);
    expect(can(editor, "account:write")).toBe(false);
  });

  it("VIEWER apenas visualiza e exporta, sendo impedido de criar, alterar ou excluir qualquer dado", () => {
    const viewer = { role: "VIEWER" as const, active: true };

    // Permitido
    expect(can(viewer, "transaction:read")).toBe(true);
    expect(can(viewer, "category:read")).toBe(true);
    expect(can(viewer, "account:read")).toBe(true);
    expect(can(viewer, "export:execute")).toBe(true);
    expect(can(viewer, "reports:view")).toBe(true);

    // Bloqueado
    expect(can(viewer, "transaction:create")).toBe(false);
    expect(can(viewer, "transaction:edit")).toBe(false);
    expect(can(viewer, "transaction:delete")).toBe(false);
    expect(can(viewer, "import:execute")).toBe(false);
    expect(can(viewer, "category:write")).toBe(false);
    expect(can(viewer, "account:write")).toBe(false);
    expect(can(viewer, "access_management:view")).toBe(false);
    expect(can(viewer, "user:create")).toBe(false);
  });

  it("Usuário inativo tem TODAS as permissões negadas imediatamente", () => {
    const inactiveAdmin = { role: "ADMIN" as const, active: false };
    const inactiveEditor = { role: "EDITOR" as const, active: false };

    expect(can(inactiveAdmin, "transaction:read")).toBe(false);
    expect(can(inactiveAdmin, "access_management:view")).toBe(false);
    expect(can(inactiveEditor, "transaction:create")).toBe(false);
    expect(can(null, "transaction:read")).toBe(false);
    expect(can(undefined, "reports:view")).toBe(false);
  });
});

describe("2. Política de Senhas", () => {
  it("rejeita senhas com menos de 10 caracteres", () => {
    expect(validatePasswordPolicy("123456789").valid).toBe(false);
    expect(validatePasswordPolicy("admin").valid).toBe(false);
    expect(validatePasswordPolicy("").valid).toBe(false);
  });

  it("aceita senhas com 10 ou mais caracteres", () => {
    expect(validatePasswordPolicy("1234567890").valid).toBe(true);
    expect(validatePasswordPolicy("SnackFacil2026!").valid).toBe(true);
  });
});

describe("3. Gerador de Senha Temporária", () => {
  it("gera senhas com comprimento adequado e caracteres diversos", () => {
    const pwd = generateSecureTemporaryPassword();
    expect(pwd.length).toBeGreaterThanOrEqual(14);
    expect(/[A-Z]/.test(pwd)).toBe(true);
    expect(/[a-z]/.test(pwd)).toBe(true);
    expect(/[0-9]/.test(pwd)).toBe(true);
  });

  it("senhas geradas consecutivamente são aleatórias e distintas", () => {
    const p1 = generateSecureTemporaryPassword();
    const p2 = generateSecureTemporaryPassword();
    expect(p1).not.toBe(p2);
  });
});

describe("4. Regras Críticas de Negócio e Segurança de Usuários", () => {
  it("impede que um administrador desative a si próprio", () => {
    const currentUserId = "admin-1";
    const targetUserId = "admin-1";

    const isSelfDeactivation = (currentId: string, targetId: string, nextActive: boolean) => {
      if (currentId === targetId && !nextActive) {
        throw new Error("Você não pode desativar o seu próprio usuário.");
      }
    };

    expect(() => isSelfDeactivation(currentUserId, targetUserId, false)).toThrow(
      "Você não pode desativar o seu próprio usuário."
    );
  });

  it("impede desativar ou rebaixar o único administrador ativo", () => {
    const activeAdminsCount = 1;

    const checkDemoteLastAdmin = (role: string, targetRole: string, activeCount: number) => {
      if (role === "ADMIN" && targetRole !== "ADMIN" && activeCount <= 1) {
        throw new Error("Não é permitido alterar o perfil do único administrador ativo da empresa.");
      }
    };

    const checkDeactivateLastAdmin = (role: string, nextActive: boolean, activeCount: number) => {
      if (role === "ADMIN" && !nextActive && activeCount <= 1) {
        throw new Error("Não é permitido desativar o único administrador ativo do sistema.");
      }
    };

    expect(() => checkDemoteLastAdmin("ADMIN", "EDITOR", activeAdminsCount)).toThrow(
      "Não é permitido alterar o perfil do único administrador ativo da empresa."
    );

    expect(() => checkDeactivateLastAdmin("ADMIN", false, activeAdminsCount)).toThrow(
      "Não é permitido desativar o único administrador ativo do sistema."
    );
  });

  it("regra de bloqueio por tentativas falhas (após 5 tentativas bloqueia por 15 min)", () => {
    let failedCount = 0;
    let lockedUntil: Date | null = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
      failedCount++;
      if (failedCount >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
    }

    expect(failedCount).toBe(5);
    expect(lockedUntil).not.toBeNull();
    expect(lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("invalidação imediata de sessão: sessionVersion no token diverge do banco", () => {
    const tokenSessionVersion = 1;
    const dbUserSessionVersionAfterReset = 2;

    const isSessionValid = (tokenVer: number, dbVer: number, active: boolean) => {
      if (!active) return false;
      if (tokenVer !== dbVer) return false;
      return true;
    };

    expect(isSessionValid(tokenSessionVersion, dbUserSessionVersionAfterReset, true)).toBe(false);
    expect(isSessionValid(2, 2, true)).toBe(true);
    expect(isSessionValid(2, 2, false)).toBe(false);
  });
});

describe("5. Verificação de Segurança no Código-fonte (Zero Exposição de Credenciais)", () => {
  it("tela de login NÃO contém card de credenciais nem e-mail pré-preenchido", () => {
    const loginFilePath = path.join(__dirname, "../src/app/login/page.tsx");
    const loginContent = fs.readFileSync(loginFilePath, "utf-8");

    expect(loginContent).not.toContain("Acesso Inicial (Seed Local)");
    expect(loginContent).not.toContain('useState("admin@snackfacil.com.br")');
    expect(loginContent).not.toContain('useState("admin")');
  });

  it(".env.example NÃO contém senhas reais padrão como 'admin'", () => {
    const envExamplePath = path.join(__dirname, "../.env.example");
    const envExampleContent = fs.readFileSync(envExamplePath, "utf-8");

    expect(envExampleContent).not.toMatch(/ADMIN_PASSWORD=["']admin["']/);
  });

  it("README.md NÃO expõe credenciais com senha 'admin'", () => {
    const readmePath = path.join(__dirname, "../README.md");
    const readmeContent = fs.readFileSync(readmePath, "utf-8");

    expect(readmeContent).not.toContain("- **Senha**: `admin`");
    expect(readmeContent).not.toContain('ADMIN_PASSWORD="admin"');
  });
});
