import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Shield, ShieldCheck, Search, RefreshCw, ChevronLeft, ChevronRight, Calendar, Store, UserCog, X, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AppRole = 'admin' | 'user' | 'reseller';

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  user_id: string;
  role: AppRole;
}

interface UserWithRoles extends UserProfile {
  roles: AppRole[];
  orders_count: number;
}

const ROLE_CONFIG: Record<AppRole, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  admin: { label: 'Admin', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: ShieldCheck },
  reseller: { label: 'Reseller', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Store },
  user: { label: 'Usuário', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Shield },
};

const AdminUsers = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      fetchUsers();

      // Subscribe to real-time updates for profiles and user_roles
      const profilesChannel = supabase
        .channel('admin-profiles-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles'
          },
          () => {
            fetchUsers();
          }
        )
        .subscribe();

      const rolesChannel = supabase
        .channel('admin-roles-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_roles'
          },
          () => {
            fetchUsers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(profilesChannel);
        supabase.removeChannel(rolesChannel);
      };
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch orders to count per user
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('user_id');

      if (ordersError) throw ordersError;

      // Create a map of user_id to roles array
      const rolesMap = new Map<string, AppRole[]>();
      (roles || []).forEach((r: UserRole) => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });

      // Count orders per user
      const ordersCountMap = new Map<string, number>();
      (orders || []).forEach((o: { user_id: string | null }) => {
        if (o.user_id) {
          ordersCountMap.set(o.user_id, (ordersCountMap.get(o.user_id) || 0) + 1);
        }
      });

      // Combine data
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile: UserProfile) => ({
        ...profile,
        roles: rolesMap.get(profile.id) || [],
        orders_count: ordersCountMap.get(profile.id) || 0,
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erro ao carregar usuários",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId: string, role: AppRole, hasRole: boolean) => {
    if (userId === user?.id && role === 'admin') {
      toast({
        title: "Ação não permitida",
        description: "Você não pode remover sua própria permissão de admin.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingRole(true);
    try {
      if (hasRole) {
        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);

        if (error) throw error;

        toast({
          title: "Cargo removido",
          description: `O cargo de ${ROLE_CONFIG[role].label} foi removido.`,
        });
      } else {
        // Add role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });

        if (error) throw error;

        toast({
          title: "Cargo adicionado",
          description: `O cargo de ${ROLE_CONFIG[role].label} foi adicionado.`,
        });
      }

      await fetchUsers();
      
      // Update selected user if dialog is open
      if (selectedUser && selectedUser.id === userId) {
        const updatedUsers = users.map(u => {
          if (u.id === userId) {
            const newRoles = hasRole 
              ? u.roles.filter(r => r !== role)
              : [...u.roles, role];
            return { ...u, roles: newRoles };
          }
          return u;
        });
        const updatedUser = updatedUsers.find(u => u.id === userId);
        if (updatedUser) setSelectedUser(updatedUser);
      }
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Erro ao atualizar cargo",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setUpdatingRole(false);
    }
  };

  const openRoleDialog = (userToEdit: UserWithRoles) => {
    setSelectedUser(userToEdit);
    setIsRoleDialogOpen(true);
  };

  const openDeleteDialog = (userToDelete: UserWithRoles) => {
    setUserToDelete(userToDelete);
    setIsDeleteDialogOpen(true);
  };

  const deleteUser = async () => {
    if (!userToDelete) return;

    // Prevent self-deletion
    if (userToDelete.id === user?.id) {
      toast({
        title: "Ação não permitida",
        description: "Você não pode excluir sua própria conta.",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete.id },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Usuário excluído",
        description: `O usuário ${userToDelete.full_name || 'sem nome'} foi excluído com sucesso.`,
      });

      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erro ao excluir usuário",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      u.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || u.roles.includes(roleFilter);
    
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.roles.includes('admin')).length,
    resellers: users.filter(u => u.roles.includes('reseller')).length,
    regularUsers: users.filter(u => u.roles.length === 0).length,
  };

  const getPrimaryRole = (roles: AppRole[]): AppRole => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('reseller')) return 'reseller';
    return 'user';
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
              <h1 className="text-2xl font-bold text-gradient">Usuários</h1>
              <p className="text-sm text-muted-foreground">Gerenciar contas e cargos</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">Admins</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">{stats.admins}</div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <Store className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">Resellers</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">{stats.resellers}</div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">Usuários</span>
            </div>
            <div className="text-2xl font-bold">{stats.regularUsers}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'admin', 'reseller', 'user'] as const).map((role) => (
              <button
                key={role}
                onClick={() => {
                  setRoleFilter(role);
                  setCurrentPage(1);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  roleFilter === role
                    ? 'bg-purple-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {role === 'all' ? 'Todos' : ROLE_CONFIG[role].label}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Usuário</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Criado em</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pedidos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cargos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const primaryRole = getPrimaryRole(u.roles);
                    return (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 flex items-center justify-center text-white font-medium overflow-hidden">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (u.full_name?.[0] || 'U').toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{u.full_name || 'Sem nome'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-muted-foreground">
                            {u.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-lg bg-muted text-sm font-medium">
                            {u.orders_count}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 ? (
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${ROLE_CONFIG.user.color}`}>
                                Usuário
                              </span>
                            ) : (
                              u.roles.map(role => (
                                <span 
                                  key={role} 
                                  className={`px-2 py-1 rounded-lg text-xs font-medium border ${ROLE_CONFIG[role].color}`}
                                >
                                  {ROLE_CONFIG[role].label}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRoleDialog(u)}
                              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                            >
                              <UserCog className="h-4 w-4 mr-1" />
                              Gerenciar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(u)}
                              disabled={u.id === user?.id}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)} de {filteredUsers.length} usuários
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
      </main>

      {/* Role Management Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 flex items-center justify-center text-white font-medium overflow-hidden">
                {selectedUser?.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (selectedUser?.full_name?.[0] || 'U').toUpperCase()
                )}
              </div>
              <div>
                <div>{selectedUser?.full_name || 'Sem nome'}</div>
                <div className="text-xs text-muted-foreground font-normal">
                  ID: {selectedUser?.id.slice(0, 8)}...
                </div>
              </div>
            </DialogTitle>
            <DialogDescription>
              Gerencie os cargos deste usuário. Um usuário pode ter múltiplos cargos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {(['admin', 'reseller'] as const).map((role) => {
              const config = ROLE_CONFIG[role];
              const Icon = config.icon;
              const hasRole = selectedUser?.roles.includes(role) || false;
              const isCurrentUser = selectedUser?.id === user?.id;
              const isDisabled = isCurrentUser && role === 'admin';

              return (
                <div
                  key={role}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    hasRole 
                      ? `${config.color} border-current` 
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      hasRole ? 'bg-current/20' : 'bg-muted'
                    }`}>
                      <Icon className={`h-5 w-5 ${hasRole ? '' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {role === 'admin' && 'Acesso total ao painel administrativo'}
                        {role === 'reseller' && 'Pode revender produtos com desconto'}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant={hasRole ? "destructive" : "default"}
                    size="sm"
                    onClick={() => selectedUser && toggleRole(selectedUser.id, role, hasRole)}
                    disabled={updatingRole || isDisabled}
                    className={!hasRole ? 'bg-purple-500 hover:bg-purple-600' : ''}
                  >
                    {updatingRole ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : hasRole ? (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Remover
                      </>
                    ) : (
                      'Adicionar'
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-muted-foreground text-center">
            {selectedUser?.id === user?.id && (
              <span className="text-amber-400">
                ⚠️ Você não pode remover sua própria permissão de admin.
              </span>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-red-400">
              <Trash2 className="h-5 w-5" />
              Excluir Usuário
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Tem certeza que deseja excluir o usuário <strong className="text-foreground">{userToDelete?.full_name || 'Sem nome'}</strong>?
              </p>
              <p className="text-sm">
                Esta ação é irreversível. O perfil, cargos e dados de autenticação do usuário serão permanentemente removidos.
              </p>
              {(userToDelete?.orders_count || 0) > 0 && (
                <p className="text-amber-400 text-sm">
                  ⚠️ Este usuário possui {userToDelete?.orders_count} pedido(s) registrado(s). Os pedidos serão mantidos para histórico.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUser}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Usuário
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;