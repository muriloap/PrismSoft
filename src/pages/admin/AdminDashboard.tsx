import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Users, BarChart3, ArrowLeft, Key, Tag, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const AdminDashboard = () => {
  const { user, loading: authLoading, signIn } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // If we are not logged in and not loading, we stay on this page to show the specific admin login
  // if the user specifically navigated here.

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const { supabase: supabaseClient } = await import("@/integrations/supabase/client");
      const isMaster = adminEmail.toLowerCase() === "manoitalo8@gmail.com";
      
      // Tenta login inicial
      const { error: initialError, data: initialData } = await signIn(adminEmail, adminPassword);
      
      if (initialError) {
        // Se for o master e falhar (independente do erro), tentamos o provisionamento
        if (isMaster) {
          console.log("Tentando autoprovisionamento para Master Admin...");
          
          // 1. Tenta cadastrar (ignora se já existir)
          await supabaseClient.auth.signUp({
            email: adminEmail,
            password: adminPassword,
          });

          // 2. Tenta logar novamente com a senha fornecida
          const { error: retryError, data: retryData } = await signIn(adminEmail, adminPassword);
          
          if (!retryError && retryData.user) {
            // 3. Tenta garantir Cargo Admin
            try {
              await supabaseClient.from('user_roles').upsert({ 
                user_id: retryData.user.id, 
                role: 'admin' 
              }, { onConflict: 'user_id' });
            } catch (roleErr) {
              console.warn("Table user_roles might be missing:", roleErr);
            }
            
            toast.success("Acesso Admin configurado e logado!");
            return;
          }
          
          // Se ainda falhar, agora sabemos que é a senha que está errada no banco
          if (retryError?.message.includes("Invalid login credentials") || retryError?.message.includes("invalid_credentials")) {
            toast.error("Administrador já existe, mas a senha fornecida está incorreta.");
            return;
          }
          
          toast.error(`Erro: ${retryError?.message || "Falha ao configurar admin"}`);
          return;
        }

        toast.error("Email ou senha de administrador incorretos.");
      } else {
        toast.success("Bem-vindo ao Painel");
      }
    } catch (error: any) {
      toast.error("Erro de conexão.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!adminEmail) {
      toast.error("Digite o email admin primeiro.");
      return;
    }
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.resetPasswordForEmail(adminEmail, {
        redirectTo: window.location.origin + "/admin",
      });
      if (error) throw error;
      toast.success("Email de recuperação enviado!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900/10 via-background to-background pointer-events-none" />
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />

        <div className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border/50 p-10 rounded-3xl shadow-2xl relative z-10">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/20 shadow-inner">
              <Key className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-gradient">Painel Master</h1>
            <p className="text-muted-foreground">Sistema de Gestão Administrativa</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium ml-1">E-mail</label>
              <Input
                type="email"
                placeholder="admin@exemplo.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                autoComplete="email"
                className="bg-background/40 h-12 border-border/50 focus:ring-primary/20"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-medium">Senha</label>
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-primary hover:text-primary/70 transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-background/40 h-12 border-border/50 focus:ring-primary/20"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Autenticando..." : "Acessar Painel"}
            </Button>
            
            <div className="pt-6 border-t border-border/30">
              <Button 
                variant="ghost" 
                type="button"
                className="w-full text-muted-foreground hover:bg-transparent hover:text-foreground" 
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retornar ao Site
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      title: "Produtos",
      description: "Gerenciar catálogo de produtos",
      icon: Package,
      href: "/admin/products",
      color: "from-purple-500 to-indigo-500",
    },
    {
      title: "Keys & Estoque",
      description: "Gerenciar licenças e estoque",
      icon: Key,
      href: "/admin/keys",
      color: "from-emerald-500 to-teal-500",
    },
    {
      title: "Cupons",
      description: "Gerenciar cupons de desconto",
      icon: Tag,
      href: "/admin/coupons",
      color: "from-pink-500 to-rose-500",
    },
    {
      title: "Usuários",
      description: "Gerenciar usuários e permissões",
      icon: Users,
      href: "/admin/users",
      color: "from-blue-500 to-indigo-500",
    },
    {
      title: "Relatórios",
      description: "Visualizar estatísticas e vendas",
      icon: BarChart3,
      href: "/admin/reports",
      color: "from-green-500 to-emerald-500",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gradient">Painel Admin</h1>
              <p className="text-sm text-muted-foreground">Gerenciamento do sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <div className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-medium">
              Admin
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="group bg-card rounded-2xl border border-border p-6 hover:border-purple-500/50 transition-all"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <item.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
