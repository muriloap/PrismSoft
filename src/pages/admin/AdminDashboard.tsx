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
      console.log("Iniciando tentativa de login administrativo para:", adminEmail);
      const { error } = await signIn(adminEmail, adminPassword);
      
      if (error) {
        console.error("Erro no login inicial de admin:", error.message);
        
        // Se for o email do admin fixo, tentamos o provisionamento agressivo
        if (adminEmail.toLowerCase() === "manoitalo8@gmail.com") {
          const { supabase: supabaseClient } = await import("@/integrations/supabase/client");
          
          toast.info("Verificando credenciais de Administrador...");
          
          // 1. Tenta cadastrar. Se já existir, não tem problema, apenas ignoramos o erro de duplicidade.
          await supabaseClient.auth.signUp({
            email: adminEmail,
            password: adminPassword,
            options: { data: { full_name: "Administrador" } }
          });

          // 2. Tenta logar de novo
          const { error: loginError, data: loginData } = await signIn(adminEmail, adminPassword);
          
          if (!loginError && loginData.user) {
            await supabaseClient.from('user_roles').upsert({
              user_id: loginData.user.id,
              role: 'admin'
            }, { onConflict: 'user_id' });
            
            toast.success("Acesso Administrador sincronizado!");
            return;
          } else if (loginError) {
            console.error("Erro no login após tentativa de signUp:", loginError.message);
            if (loginError.message.includes("Email not confirmed")) {
              toast.error("Conta criada! AÇÃO NECESSÁRIA: No Dashboard do Supabase (Auth > Providers > Email), desmarque 'Confirm Email' para acessar sem verificar o link.");
            } else if (loginError.message.includes("Invalid login credentials") || loginError.message.includes("invalid_credentials")) {
              toast.error("Este administrador já existe, mas a senha está incorreta.");
            } else {
              toast.error(`Erro: ${loginError.message}`);
            }
            return;
          }
        }
        toast.error("Acesso negado. Verifique email e senha.");
      } else {
        toast.success("Bem-vindo ao Painel Admin");
      }
    } catch (error) {
      console.error("Erro técnico no login:", error);
      toast.error("Erro no servidor de autenticação.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-background to-fuchsia-900/10 pointer-events-none" />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not logged in or not admin: Show login card on /admin
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background effects like standard site */}
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900/10 via-background to-blue-900/10 pointer-events-none" />
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />

        <div className="w-full max-w-md bg-card/80 backdrop-blur-sm rounded-2xl border border-border p-8 relative z-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <Key className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Painel Admin</h1>
            <p className="text-muted-foreground">Acesso restrito para administradores</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Administrativo</label>
              <Input
                type="email"
                placeholder="admin@exemplo.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                autoComplete="email"
                className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Autenticando..." : "Entrar no Painel"}
            </Button>
            
            <div className="pt-4 border-t border-border/50 mt-6 space-y-4">
              <Button 
                variant="ghost" 
                type="button"
                className="w-full text-muted-foreground hover:text-foreground transition-colors" 
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para a Loja
              </Button>
            </div>
          </form>
        </div>

        {/* Informative footer for first-time setup */}
        <div className="mt-8 text-center relative z-10 max-w-sm mx-auto">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Se for o seu primeiro acesso, entre com o email configurado. 
            <strong> Importante:</strong> Se aparecer "Email not confirmed", vá ao seu Dashboard do Supabase &gt; Auth &gt; Providers &gt; Email e desative a opção "Confirm Email".
          </p>
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
