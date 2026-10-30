export type Role = "ADMIN" | "EDITOR" | "VIEWER";

export type PermissionAction =
  | "access_management:view"
  | "access_management:manage"
  | "user:create"
  | "user:update"
  | "user:delete"
  | "user:toggle_status"
  | "user:reset_password"
  | "audit:view"
  | "category:read"
  | "category:write"
  | "account:read"
  | "account:write"
  | "supplier:read"
  | "supplier:write"
  | "transaction:read"
  | "transaction:create"
  | "transaction:edit"
  | "transaction:delete"
  | "import:execute"
  | "export:execute"
  | "reports:view"
  | "product:read"
  | "product:write"
  | "stock:read"
  | "stock:write"
  | "machine:read"
  | "machine:write";

/**
 * Matriz centralizada de permissões por perfil (Role-Based Access Control)
 */
export const ROLE_PERMISSIONS: Record<Role, readonly PermissionAction[]> = {
  ADMIN: [
    "access_management:view",
    "access_management:manage",
    "user:create",
    "user:update",
    "user:delete",
    "user:toggle_status",
    "user:reset_password",
    "audit:view",
    "category:read",
    "category:write",
    "account:read",
    "account:write",
    "supplier:read",
    "supplier:write",
    "transaction:read",
    "transaction:create",
    "transaction:edit",
    "transaction:delete",
    "import:execute",
    "export:execute",
    "reports:view",
    "product:read",
    "product:write",
    "stock:read",
    "stock:write",
    "machine:read",
    "machine:write",
  ],
  EDITOR: [
    "category:read",
    "account:read",
    "supplier:read",
    "supplier:write",
    "transaction:read",
    "transaction:create",
    "transaction:edit",
    "transaction:delete",
    "import:execute",
    "export:execute",
    "reports:view",
    "product:read",
    "product:write",
    "stock:read",
    "stock:write",
    "machine:read",
    "machine:write",
  ],
  VIEWER: [
    "category:read",
    "account:read",
    "supplier:read",
    "transaction:read",
    "export:execute",
    "reports:view",
    "product:read",
    "stock:read",
    "machine:read",
  ],
} as const;

export interface UserPermissionContext {
  role: Role | string;
  active?: boolean;
}

/**
 * Função central para conferência de permissões
 * Uso: can(user, "transaction:create") ou can("EDITOR", "category:write")
 */
export function can(
  userOrRole: UserPermissionContext | Role | string | null | undefined,
  action: PermissionAction
): boolean {
  if (!userOrRole) return false;

  let role: Role;
  if (typeof userOrRole === "string") {
    role = userOrRole as Role;
  } else {
    if (userOrRole.active === false) return false;
    role = userOrRole.role as Role;
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  return (permissions as readonly string[]).includes(action);
}

/**
 * Retorna lista amigável de permissões do usuário
 */
export function getPermissionsForRole(role: Role): readonly PermissionAction[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Validação de política de segurança de senhas
 */
export function validatePasswordPolicy(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 10) {
    return {
      valid: false,
      message: "A senha deve conter no mínimo 10 caracteres.",
    };
  }
  return { valid: true };
}
