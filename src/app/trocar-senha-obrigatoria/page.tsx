"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldAlert, CheckCircle2, AlertCircle, ArrowRight, LogOut } from "lucide-react";

export default function TrocarSenhaObrigatoriaPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 10) {
      setError("A nova senha deve ter no mínimo 10 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("A nova senha e a confirmação não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/trocar-senha-obrigatoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar senha.");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <span className="text-3xl font-extrabold text-white tracking-wider">SF</span>
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          Definição de Nova Senha
        </h2>
        <p className="mt-1 text-center text-sm text-slate-300">
          Primeiro acesso identificado ou senha temporária redefinida
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-white/20">
          <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <span className="font-bold block text-sm">Troca obrigatória de segurança</span>
              Por políticas de proteção dos dados financeiros da Snack Fácil, você deve cadastrar sua senha pessoal antes de acessar o sistema.
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3.5 rounded-md flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm font-medium text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="newPassword" className="block text-sm font-semibold text-slate-700">
                Nova Senha
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  placeholder="Mínimo de 10 caracteres"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700">
                Confirme a Nova Senha
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  placeholder="Repita a senha digitada acima"
                />
              </div>
            </div>

            {/* Checklist de requisitos */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-700 mb-1">Requisitos de segurança:</div>
              <div className={`flex items-center gap-1.5 ${newPassword.length >= 10 ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pelo menos 10 caracteres ({newPassword.length}/10)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${newPassword && newPassword === confirmPassword ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>As duas senhas são idênticas</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || newPassword.length < 10 || newPassword !== confirmPassword}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {loading ? (
                  <span>Salvando nova senha...</span>
                ) : (
                  <>
                    <span>Salvar e Acessar o Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200 flex justify-center">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair e voltar ao login</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
