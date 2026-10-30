"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateToBR } from "@/lib/formatters";
import {
  Users,
  UserPlus,
  Shield,
  Search,
  KeyRound,
  Edit2,
  Check,
  Copy,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertCircle,
  Eye,
  UserCheck,
  UserX,
  Trash2,
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  userId: string | null;
  userName: string | null;
  targetUserId: string | null;
  targetUserName: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function GestaoAcessoPage() {
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");

  // Usuários
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { user: currentUser } = useAuth();

  // Modais de Usuário
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserItem | null>(null);

  // Formulário de Criação (sócio default: ADMIN)
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "EDITOR" | "VIEWER">("ADMIN");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal de Exibição Única de Senha Temporária Gerada
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    isOpen: boolean;
    userName: string;
    userEmail: string;
    password: string;
  }>({
    isOpen: false,
    userName: "",
    userEmail: "",
    password: "",
  });
  const [copied, setCopied] = useState(false);

  // Confirmação de Ação (Ativar/Desativar, Resetar Senha ou Excluir)
  const [actionConfirm, setActionConfirm] = useState<{
    isOpen: boolean;
    type: "TOGGLE_STATUS" | "RESET_PASSWORD" | "DELETE_USER";
    user: UserItem | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    type: "TOGGLE_STATUS",
    user: null,
    loading: false,
    error: null,
  });

  // Auditoria
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditUserFilter, setAuditUserFilter] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
  const [auditStartDate, setAuditStartDate] = useState("");
  const [auditEndDate, setAuditEndDate] = useState("");

  // Carrega Usuários
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const resUsers = await fetch(`/api/users?${params.toString()}`);

      if (resUsers.ok) {
        const data = await resUsers.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [statusFilter]);

  // Carrega Auditoria
  const fetchAuditLogs = async (page = auditPage) => {
    try {
      setLoadingAudit(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (auditUserFilter) params.set("userId", auditUserFilter);
      if (auditActionFilter !== "ALL") params.set("action", auditActionFilter);
      if (auditStartDate) params.set("startDate", auditStartDate);
      if (auditEndDate) params.set("endDate", auditEndDate);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setAuditPage(data.pagination.page);
        setAuditTotalPages(data.pagination.totalPages);
        setAuditTotalCount(data.pagination.totalCount);
      }
    } catch (err) {
      console.error("Erro ao carregar logs de auditoria:", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs(1);
    }
  }, [activeTab, auditActionFilter, auditUserFilter, auditStartDate, auditEndDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  // Criar Usuário
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao cadastrar usuário.");
      }

      setIsCreateOpen(false);
      setNewName("");
      setNewEmail("");
      setNewRole("ADMIN");

      // Abre modal de exibição única da senha temporária
      setTempPasswordModal({
        isOpen: true,
        userName: data.user.name,
        userEmail: data.user.email,
        password: data.temporaryPassword,
      });

      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || "Erro de conexão.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Editar Usuário
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;

    setFormError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch(`/api/users/${userToEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userToEdit.name,
          email: userToEdit.email,
          role: userToEdit.role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar usuário.");
      }

      setIsEditOpen(false);
      setUserToEdit(null);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || "Erro ao conectar com o servidor.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Executar Ação Confirmada (Ativar/Desativar ou Resetar Senha)
  const handleExecuteActionConfirm = async () => {
    if (!actionConfirm.user) return;
    setActionConfirm((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (actionConfirm.type === "TOGGLE_STATUS") {
        const nextStatus = !actionConfirm.user.active;
        const res = await fetch(`/api/users/${actionConfirm.user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: nextStatus }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao alterar status.");
        }
        setActionConfirm({ isOpen: false, type: "TOGGLE_STATUS", user: null, loading: false, error: null });
        fetchUsers();
      } else if (actionConfirm.type === "RESET_PASSWORD") {
        const res = await fetch(`/api/users/${actionConfirm.user.id}/reset-password`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao redefinir senha.");
        }

        const targetUser = actionConfirm.user;
        setActionConfirm({ isOpen: false, type: "RESET_PASSWORD", user: null, loading: false, error: null });

        // Abre exibição única da nova senha gerada
        setTempPasswordModal({
          isOpen: true,
          userName: targetUser.name,
          userEmail: targetUser.email,
          password: data.temporaryPassword,
        });
        fetchUsers();
      } else if (actionConfirm.type === "DELETE_USER") {
        const res = await fetch(`/api/users/${actionConfirm.user.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao excluir usuário.");
        }
        setActionConfirm({ isOpen: false, type: "DELETE_USER", user: null, loading: false, error: null });
        fetchUsers();
      }
    } catch (err: any) {
      setActionConfirm((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "Erro ao executar ação.",
      }));
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPasswordModal.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatActionName = (action: string) => {
    switch (action) {
      case "LOGIN_SUCCESS":
        return <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Login com Sucesso</span>;
      case "LOGIN_FAILED":
        return <span className="inline-flex items-center gap-1 text-rose-700 font-semibold"><XCircle className="w-3.5 h-3.5" /> Tentativa Falha</span>;
      case "LOGIN_LOCKED":
        return <span className="inline-flex items-center gap-1 text-amber-700 font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Bloqueio de Tentativas</span>;
      case "USER_CREATED":
        return <span className="inline-flex items-center gap-1 text-blue-700 font-semibold"><UserPlus className="w-3.5 h-3.5" /> Usuário Cadastrado</span>;
      case "USER_UPDATED":
        return <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold"><Edit2 className="w-3.5 h-3.5" /> Dados Alterados</span>;
      case "USER_ACTIVATED":
        return <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><UserCheck className="w-3.5 h-3.5" /> Usuário Ativado</span>;
      case "USER_DEACTIVATED":
        return <span className="inline-flex items-center gap-1 text-rose-700 font-semibold"><UserX className="w-3.5 h-3.5" /> Usuário Desativado</span>;
      case "USER_DELETED":
        return <span className="inline-flex items-center gap-1 text-rose-700 font-semibold"><Trash2 className="w-3.5 h-3.5" /> Usuário Excluído</span>;
      case "PASSWORD_RESET":
        return <span className="inline-flex items-center gap-1 text-orange-700 font-semibold"><KeyRound className="w-3.5 h-3.5" /> Senha Redefinida</span>;
      case "PASSWORD_CHANGED":
        return <span className="inline-flex items-center gap-1 text-teal-700 font-semibold"><Check className="w-3.5 h-3.5" /> Senha Atualizada</span>;
      default:
        return <span>{action}</span>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <span className="bg-orange-100 text-orange-800 border border-orange-200 text-xs px-2.5 py-0.5 rounded-full font-bold">Administrador</span>;
      case "EDITOR":
        return <span className="bg-blue-100 text-blue-800 border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-bold">Operador (Editor)</span>;
      case "VIEWER":
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold">Consulta (Viewer)</span>;
      default:
        return <span>{role}</span>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-orange-100 text-orange-600">
                <Shield className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Gestão de Acesso & Auditoria
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Controle multiusuário, definição de perfis de permissão e histórico de atividades
            </p>
          </div>

          {activeTab === "users" && (
            <button
              onClick={() => {
                setFormError(null);
                setNewName("");
                setNewEmail("");
                setNewRole("ADMIN"); // Sócio por padrão
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-orange-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Cadastrar Novo Usuário</span>
            </button>
          )}
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 py-3 px-5 font-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "users"
                ? "border-orange-500 text-orange-600 bg-orange-50/40"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuários do Sistema ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 py-3 px-5 font-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "audit"
                ? "border-orange-500 text-orange-600 bg-orange-50/40"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Registro de Atividades (Auditoria)</span>
          </button>
        </div>

        {/* ======================= ABA 1: USUÁRIOS ======================= */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Filtros de Usuários */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </form>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                  Status:
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  <option value="ALL">Todos os status</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="INACTIVE">Inativos</option>
                </select>
              </div>
            </div>

            {/* Tabela de Usuários */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">E-mail</th>
                      <th className="py-3 px-4">Perfil</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Último Acesso</th>
                      <th className="py-3 px-4">Data de Cadastro</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                          Carregando usuários...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                          Nenhum usuário encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const isSelf = currentUser?.id === u.id;

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span>{u.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                                    Você
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                              {u.email}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {getRoleBadge(u.role)}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {u.active ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Ativo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                                  Inativo
                                </span>
                              )}
                              {u.mustChangePassword && (
                                <span className="block text-[10px] text-amber-600 font-medium mt-0.5">
                                  (Troca de senha pendente)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-xs whitespace-nowrap">
                              {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "Nunca acessou"}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-xs whitespace-nowrap">
                              {formatDateToBR(u.createdAt)}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Editar */}
                                <button
                                  onClick={() => {
                                    setFormError(null);
                                    setUserToEdit({ ...u });
                                    setIsEditOpen(true);
                                  }}
                                  title="Editar Usuário"
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>

                                {/* Redefinir Senha */}
                                <button
                                  onClick={() => {
                                    setActionConfirm({
                                      isOpen: true,
                                      type: "RESET_PASSWORD",
                                      user: u,
                                      loading: false,
                                      error: null,
                                    });
                                  }}
                                  title="Gerar nova senha temporária"
                                  className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>

                                {/* Ativar / Desativar */}
                                <button
                                  disabled={isSelf}
                                  onClick={() => {
                                    setActionConfirm({
                                      isOpen: true,
                                      type: "TOGGLE_STATUS",
                                      user: u,
                                      loading: false,
                                      error: null,
                                    });
                                  }}
                                  title={
                                    isSelf
                                      ? "Você não pode desativar o próprio usuário"
                                      : u.active
                                      ? "Desativar conta do usuário"
                                      : "Ativar conta do usuário"
                                  }
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                                    u.active
                                      ? "text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                      : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                  }`}
                                >
                                  {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </button>

                                {/* Excluir Usuário */}
                                <button
                                  disabled={isSelf}
                                  onClick={() => {
                                    setActionConfirm({
                                      isOpen: true,
                                      type: "DELETE_USER",
                                      user: u,
                                      loading: false,
                                      error: null,
                                    });
                                  }}
                                  title={
                                    isSelf
                                      ? "Você não pode excluir o seu próprio usuário"
                                      : "Excluir usuário permanentemente"
                                  }
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================= ABA 2: REGISTRO DE ATIVIDADES ======================= */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            {/* Filtros de Auditoria */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Filtrar por Usuário
                </label>
                <select
                  value={auditUserFilter}
                  onChange={(e) => setAuditUserFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  <option value="">Todos os usuários</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Tipo de Evento
                </label>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  <option value="ALL">Todos os eventos</option>
                  <option value="LOGIN_SUCCESS">Login com Sucesso</option>
                  <option value="LOGIN_FAILED">Login Falho</option>
                  <option value="LOGIN_LOCKED">Bloqueio de Tentativas</option>
                  <option value="USER_CREATED">Usuário Cadastrado</option>
                  <option value="USER_UPDATED">Dados Alterados</option>
                  <option value="USER_ACTIVATED">Usuário Ativado</option>
                  <option value="USER_DEACTIVATED">Usuário Desativado</option>
                  <option value="USER_DELETED">Usuário Excluído</option>
                  <option value="PASSWORD_RESET">Senha Redefinida</option>
                  <option value="PASSWORD_CHANGED">Senha Trocada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Tabela de Auditoria */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Data e Hora</th>
                      <th className="py-3 px-4">Ação</th>
                      <th className="py-3 px-4">Usuário Executor</th>
                      <th className="py-3 px-4">Usuário Afetado</th>
                      <th className="py-3 px-4">Detalhes</th>
                      <th className="py-3 px-4">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {loadingAudit ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                          Carregando histórico de auditoria...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                          Nenhum registro de auditoria encontrado para o período.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap text-xs">
                            {new Date(log.createdAt).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                            {formatActionName(log.action)}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap text-xs">
                            {log.userName || "—"}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap text-xs">
                            {log.targetUserName || "—"}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-xs">
                            {log.details || "—"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {log.ipAddress || "127.0.0.1"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação da Auditoria */}
              {auditTotalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Página <b>{auditPage}</b> de <b>{auditTotalPages}</b> ({auditTotalCount} eventos registrados)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={auditPage <= 1}
                      onClick={() => fetchAuditLogs(auditPage - 1)}
                      className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={auditPage >= auditTotalPages}
                      onClick={() => fetchAuditLogs(auditPage + 1)}
                      className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================= MODAL: CADASTRAR USUÁRIO ======================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-bold text-slate-800">Cadastrar Novo Usuário</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  E-mail de Acesso
                </label>
                <input
                  type="email"
                  required
                  placeholder="Ex: carlos@snackfacil.com.br"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Perfil de Acesso
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  <option value="ADMIN">ADMIN — Administrador (Acesso total)</option>
                  <option value="EDITOR">EDITOR — Operador (Lançamentos e relatórios)</option>
                  <option value="VIEWER">VIEWER — Consulta (Apenas visualização)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  * Por padrão, novos sócios devem ser cadastrados como <b>ADMIN</b>.
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
                <span className="font-bold block">Segurança da Senha Inicial:</span>
                O sistema gerará uma senha temporária aleatória segura exibida na próxima etapa. O usuário será obrigado a alterá-la no primeiro acesso.
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? "Gerando..." : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: EDITAR USUÁRIO ======================= */}
      {isEditOpen && userToEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-bold text-slate-800">Editar Usuário</h3>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={userToEdit.name}
                  onChange={(e) => setUserToEdit({ ...userToEdit, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={userToEdit.email}
                  onChange={(e) => setUserToEdit({ ...userToEdit, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Perfil de Acesso
                </label>
                <select
                  value={userToEdit.role}
                  onChange={(e) => setUserToEdit({ ...userToEdit, role: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  <option value="ADMIN">ADMIN — Administrador</option>
                  <option value="EDITOR">EDITOR — Operador</option>
                  <option value="VIEWER">VIEWER — Consulta</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  * Alterar o perfil invalida imediatamente as sessões abertas deste usuário.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: EXIBIÇÃO ÚNICA DA SENHA TEMPORÁRIA ======================= */}
      {tempPasswordModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">
                  Senha Temporária Gerada
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Para o usuário <b>{tempPasswordModal.userName}</b> ({tempPasswordModal.userEmail})
                </p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                  Atenção: Esta senha será exibida uma única vez
                </span>
                <p className="text-xs text-amber-800">
                  Copie agora e envie diretamente ao usuário de forma segura. O usuário será obrigado a cadastrar sua própria senha pessoal no primeiro acesso.
                </p>
              </div>

              {/* Caixa da Senha com Botão Copiar */}
              <div className="relative flex items-center bg-slate-900 text-white font-mono text-base px-4 py-3 rounded-xl border border-slate-800">
                <span className="flex-1 select-all font-bold tracking-wider">
                  {tempPasswordModal.password}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 text-white font-sans text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setTempPasswordModal({ isOpen: false, userName: "", userEmail: "", password: "" })}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: CONFIRMAÇÃO DE AÇÃO ======================= */}
      {actionConfirm.isOpen && actionConfirm.user && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                actionConfirm.type === "DELETE_USER"
                  ? "bg-rose-100 text-rose-600"
                  : "bg-orange-100 text-orange-600"
              }`}
            >
              {actionConfirm.type === "DELETE_USER" ? (
                <Trash2 className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                {actionConfirm.type === "DELETE_USER"
                  ? "Excluir Usuário Permanentemente?"
                  : actionConfirm.type === "TOGGLE_STATUS"
                  ? actionConfirm.user.active
                    ? "Desativar Usuário?"
                    : "Ativar Usuário?"
                  : "Redefinir Senha do Usuário?"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {actionConfirm.type === "DELETE_USER"
                  ? `Tem certeza de que deseja excluir permanentemente o usuário "${actionConfirm.user.name}" (${actionConfirm.user.email})? Esta ação é definitiva e removerá seu cadastro. Os lançamentos financeiros existentes serão preservados.`
                  : actionConfirm.type === "TOGGLE_STATUS"
                  ? actionConfirm.user.active
                    ? `Ao desativar "${actionConfirm.user.name}", suas sessões ativas serão canceladas e ele não conseguirá mais entrar.`
                    : `Deseja reativar o acesso de "${actionConfirm.user.name}"?`
                  : `Será gerada uma nova senha temporária para "${actionConfirm.user.name}", invalidando todas as sessões anteriores.`}
              </p>
            </div>

            {actionConfirm.error && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-xs text-red-700">
                {actionConfirm.error}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() =>
                  setActionConfirm({ isOpen: false, type: "TOGGLE_STATUS", user: null, loading: false, error: null })
                }
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionConfirm.loading}
                onClick={handleExecuteActionConfirm}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-sm disabled:opacity-50 transition-colors ${
                  actionConfirm.type === "DELETE_USER"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                    : "bg-orange-600 hover:bg-orange-700"
                }`}
              >
                {actionConfirm.loading
                  ? "Processando..."
                  : actionConfirm.type === "DELETE_USER"
                  ? "Excluir Usuário"
                  : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
