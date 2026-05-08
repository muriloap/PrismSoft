import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Tag, Percent, DollarSign, Calendar, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/hooks/useAdmin';
import { useCoupons, Coupon, AppRole } from '@/hooks/useCoupons';
import Header from '@/components/Header';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administradores',
  reseller: 'Revendedores',
  user: 'Usuários',
};

const AdminCoupons = () => {
  const { isAdmin, loading: isAdminLoading } = useAdmin();
  const { coupons, isLoading, createCoupon, updateCoupon, deleteCoupon } = useCoupons();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_purchase: '',
    max_uses: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
    restricted_to_role: '' as AppRole | '',
  });

  if (isAdminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acesso Negado</h1>
          <p className="text-muted-foreground mb-4">Você não tem permissão para acessar esta página.</p>
          <Link to="/">
            <Button>Voltar ao Início</Button>
          </Link>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      min_purchase: '',
      max_uses: '',
      valid_from: '',
      valid_until: '',
      is_active: true,
      restricted_to_role: '',
    });
    setEditingCoupon(null);
  };

  const handleOpenDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        description: coupon.description || '',
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value.toString(),
        min_purchase: coupon.min_purchase?.toString() || '',
        max_uses: coupon.max_uses?.toString() || '',
        valid_from: coupon.valid_from ? coupon.valid_from.slice(0, 16) : '',
        valid_until: coupon.valid_until ? coupon.valid_until.slice(0, 16) : '',
        is_active: coupon.is_active,
        restricted_to_role: coupon.restricted_to_role || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const couponData = {
      code: formData.code,
      description: formData.description || null,
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      min_purchase: formData.min_purchase ? parseFloat(formData.min_purchase) : 0,
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
      valid_from: formData.valid_from || new Date().toISOString(),
      valid_until: formData.valid_until || null,
      is_active: formData.is_active,
      restricted_to_role: formData.restricted_to_role || null,
    };

    if (editingCoupon) {
      await updateCoupon.mutateAsync({ id: editingCoupon.id, ...couponData });
    } else {
      await createCoupon.mutateAsync(couponData);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cupom?')) {
      await deleteCoupon.mutateAsync(id);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getCouponStatus = (coupon: Coupon) => {
    if (!coupon.is_active) {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    
    const now = new Date();
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return <Badge variant="outline">Esgotado</Badge>;
    }
    
    return <Badge className="bg-green-500">Ativo</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Cupons</h1>
            <p className="text-muted-foreground">Crie e gerencie cupons de desconto</p>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Cupom
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="code">Código do Cupom *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="EX: DESCONTO20"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição do cupom"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Desconto *</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(value: 'percentage' | 'fixed') => 
                        setFormData({ ...formData, discount_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="discount_value">Valor *</Label>
                    <Input
                      id="discount_value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      placeholder={formData.discount_type === 'percentage' ? '10' : '50.00'}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_purchase">Compra Mínima (R$)</Label>
                    <Input
                      id="min_purchase"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.min_purchase}
                      onChange={(e) => setFormData({ ...formData, min_purchase: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_uses">Limite de Usos</Label>
                    <Input
                      id="max_uses"
                      type="number"
                      min="1"
                      value={formData.max_uses}
                      onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                      placeholder="Ilimitado"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="valid_from">Válido a partir de</Label>
                    <Input
                      id="valid_from"
                      type="datetime-local"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="valid_until">Válido até</Label>
                    <Input
                      id="valid_until"
                      type="datetime-local"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Restrito ao Cargo</Label>
                  <Select
                    value={formData.restricted_to_role}
                    onValueChange={(value: AppRole | 'none') => 
                      setFormData({ ...formData, restricted_to_role: value === 'none' ? '' : value as AppRole })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os usuários" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todos os usuários</SelectItem>
                      <SelectItem value="admin">Administradores</SelectItem>
                      <SelectItem value="reseller">Revendedores</SelectItem>
                      <SelectItem value="user">Usuários</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se definido, apenas usuários com este cargo poderão usar o cupom
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Cupom Ativo</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createCoupon.isPending || updateCoupon.isPending}
                  >
                    {createCoupon.isPending || updateCoupon.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum cupom cadastrado</h3>
            <p className="text-muted-foreground">Clique em "Novo Cupom" para criar seu primeiro cupom.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Mín. Compra</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="font-mono font-semibold">{coupon.code}</span>
                        {coupon.restricted_to_role && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Shield className="h-3 w-3" />
                            {roleLabels[coupon.restricted_to_role]}
                          </Badge>
                        )}
                      </div>
                      {coupon.description && (
                        <p className="text-xs text-muted-foreground mt-1">{coupon.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {coupon.discount_type === 'percentage' ? (
                          <>
                            <Percent className="h-4 w-4 text-muted-foreground" />
                            <span>{coupon.discount_value}%</span>
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span>R$ {coupon.discount_value.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {coupon.min_purchase > 0 ? `R$ ${coupon.min_purchase.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {coupon.current_uses}
                          {coupon.max_uses ? `/${coupon.max_uses}` : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {formatDate(coupon.valid_from)} - {formatDate(coupon.valid_until)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getCouponStatus(coupon)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(coupon)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(coupon.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminCoupons;
