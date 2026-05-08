import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, ShoppingCart, Package, Users, Key, Calendar, Filter, Download, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Order {
  id: string;
  email: string;
  customer_name: string | null;
  total_amount: number;
  discount_amount: number | null;
  status: string;
  payment_method: string | null;
  created_at: string;
  paid_at: string | null;
  coupon_code: string | null;
}

interface AuditLog {
  id: string;
  created_at: string;
  user_email: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  description: string | null;
}

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  paidOrders: number;
  pendingOrders: number;
  totalProducts: number;
  totalKeys: number;
  soldKeys: number;
  availableKeys: number;
}

const AdminReports = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    totalRevenue: 0,
    paidOrders: 0,
    pendingOrders: 0,
    totalProducts: 0,
    totalKeys: 0,
    soldKeys: 0,
    availableKeys: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'audit'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch audit logs
      const { data: logsData, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!logsError) {
        setAuditLogs(logsData || []);
      }

      // Fetch products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Fetch keys stats
      const { data: keysData } = await supabase
        .from('product_keys')
        .select('status');

      const allOrders = ordersData || [];
      const paidOrders = allOrders.filter(o => o.status === 'paid');
      const pendingOrders = allOrders.filter(o => o.status === 'pending');
      const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount - (o.discount_amount || 0)), 0);

      const allKeys = keysData || [];
      const soldKeys = allKeys.filter(k => k.status === 'sold').length;
      const availableKeys = allKeys.filter(k => k.status === 'available').length;

      setStats({
        totalOrders: allOrders.length,
        totalRevenue,
        paidOrders: paidOrders.length,
        pendingOrders: pendingOrders.length,
        totalProducts: productsCount || 0,
        totalKeys: allKeys.length,
        soldKeys,
        availableKeys,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (statusFilter === 'all') return true;
    return order.status === statusFilter;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'pending':
        return 'Pendente';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'UPDATE':
        return 'bg-blue-500/20 text-blue-400';
      case 'DELETE':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Data', 'Cliente', 'Email', 'Valor', 'Desconto', 'Status', 'Pagamento', 'Cupom'];
    const rows = filteredOrders.map(order => [
      order.id,
      format(new Date(order.created_at), 'dd/MM/yyyy HH:mm'),
      order.customer_name || '-',
      order.email,
      order.total_amount.toFixed(2),
      (order.discount_amount || 0).toFixed(2),
      getStatusLabel(order.status),
      order.payment_method || '-',
      order.coupon_code || '-',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-pedidos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gradient">Relatórios</h1>
              <p className="text-sm text-muted-foreground">Histórico de compras e alterações</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="hero" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">Total Pedidos</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.paidOrders} pagos • {stats.pendingOrders} pendentes
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">Receita Total</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              R$ {stats.totalRevenue.toFixed(2).replace('.', ',')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Apenas pedidos pagos
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">Produtos</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Produtos ativos
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                <Key className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">Keys</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalKeys}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.soldKeys} vendidas • {stats.availableKeys} disponíveis
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'orders'
                ? 'bg-purple-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <ShoppingCart className="h-4 w-4 inline-block mr-2" />
            Histórico de Compras
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'audit'
                ? 'bg-purple-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Calendar className="h-4 w-4 inline-block mr-2" />
            Log de Alterações
          </button>
        </div>

        {activeTab === 'orders' && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filtrar por status:</span>
              </div>
              <div className="flex gap-2">
                {['all', 'paid', 'pending', 'cancelled'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === status
                        ? 'bg-purple-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {status === 'all' ? 'Todos' : getStatusLabel(status)}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Valor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Desconto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pagamento</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cupom</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
                        </td>
                      </tr>
                    ) : paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          Nenhum pedido encontrado
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-sm">
                            {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {order.customer_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {order.email}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            R$ {order.total_amount.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {order.discount_amount ? (
                              <span className="text-emerald-400">
                                -R$ {order.discount_amount.toFixed(2).replace('.', ',')}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground uppercase">
                            {order.payment_method || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {order.coupon_code ? (
                              <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-medium">
                                {order.coupon_code}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} de {filteredOrders.length} pedidos
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'audit' && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ação</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tabela</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum log de alteração encontrado
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {log.user_email || 'Sistema'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {log.table_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {log.description || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminReports;