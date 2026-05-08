import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Users, BarChart3, ArrowLeft, Key, Tag, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      navigate("/");
    }
  }, [isAdmin, adminLoading, user, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
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
