export type Role = "ADMIN" | "EDITOR" | "VIEWER";

export type PermissionAction =
  | "access_management:view"
  | "access_management:manage"
  | "user:create"
  | "user:update"
  | "user:toggle_status"
  | "user:reset_password"
  | "audit:view"
  | "category:read"
  | "category:write"
  | "account:read"
  | "account:write"
  | "transaction:read"
  | "transaction:create"
  | "transaction:edit"
  | "transaction:delete"
  | "import:execute"
  | "export:execute"
  | "reports:view";

/**
 * Matriz centralizada de permissões por perfil (Role-Based Access Control)
 */
export const ROLE_PERMISSIONS: Record<Role, readonly PermissionAction[]> = {
  ADMIN: [
    "access_management:view",
    "access_management:manage",
    "user:create",
    "user:update",
    "user:toggle_status",
    "user:reset_password",
    "audit:view",
    "category:read",
    "category:write",
    "account:read",
    "account:write",
    "transaction:read",
    "transaction:create",
    "transaction:edit",
    "transaction:delete",
    "import:execute",
    "export:execute",
    "reports:view",
  ],
  EDITOR: [
    "category:read",
    "account:read",
    "transaction:read",
    "transaction:create",
    "transaction:edit",
    "transaction:delete",
    "import:execute",
    "export:execute",
    "reports:view",
  ],
  VIEWER: [
    "category:read",
    "account:read",
    "transaction:read",
    "export:execute",
    "reports:view",
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

  return permissions.includes(action);
}

/**
 * Auxiliar para validação de política de senha forte
 * Regra: Mínimo de 10 caracteres
 */
export function validatePasswordPolicy(password: string): { valid: boolean; message?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "A senha é obrigatória." };
  }
  if (password.length < 10) {
    return {
      valid: false,
      message: "A senha deve conter no mínimo 10 caracteres para garantir a segurança da conta.",
    };
  }
  return { valid: true };
}
