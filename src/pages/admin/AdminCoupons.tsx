import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Tag, Loader2, Calendar, Percent, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_purchase_value: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const AdminCoupons = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    discount_type: "percent" as "percent" | "fixed",
    discount_value: 0,
    min_purchase_value: 0,
    max_uses: 0,
    expires_at: "",
    is_active: true,
  });

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error fetching coupons:", err);
      toast.error("Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (!adminLoading && !isAdmin && user) navigate("/");
    if (isAdmin) fetchCoupons();
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  const handleOpenCreate = () => {
    setSelectedCoupon(null);
    setFormData({
      code: "",
      discount_type: "percent",
      discount_value: 0,
      min_purchase_value: 0,
      max_uses: 0,
      expires_at: "",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setFormData({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_purchase_value: coupon.min_purchase_value || 0,
      max_uses: coupon.max_uses || 0,
      expires_at: coupon.expires_at ? new Date(coupon.expires_at).toISOString().split('T')[0] : "",
      is_active: coupon.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload = {
        ...formData,
        min_purchase_value: formData.min_purchase_value || null,
        max_uses: formData.max_uses || null,
        expires_at: formData.expires_at || null,
      };

      if (selectedCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', selectedCoupon.id);
        if (error) throw error;
        toast.success("Cupom atualizado!");
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert(payload);
        if (error) throw error;
        toast.success("Cupom criado!");
      }
      setIsDialogOpen(false);
      fetchCoupons();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Erro ao salvar cupom");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCoupon) return;
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', selectedCoupon.id);
      if (error) throw error;
      toast.success("Cupom excluído!");
      setIsDeleteDialogOpen(false);
      fetchCoupons();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Erro ao excluir cupom");
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Cupons</h1>
              <p className="text-sm text-muted-foreground">Gerenciar descontos e promoções</p>
            </div>
          </div>
          <Button variant="hero" onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Cupom
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-purple-500" /></div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl">
            <Tag className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-lg font-medium mb-2">Nenhum cupom cadastrado</h3>
            <Button variant="outline" onClick={handleOpenCreate} className="mt-4">Criar meu primeiro cupom</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {coupons.map((coupon) => (
              <div key={coupon.id} className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between group hover:border-purple-500/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Tag className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-mono">{coupon.code}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{coupon.discount_type === 'percent' ? `${coupon.discount_value}%` : `R$ ${coupon.discount_value.toFixed(2)}`} desc.</span>
                      <span>•</span>
                      <span>{coupon.used_count} usos {coupon.max_uses ? `/ ${coupon.max_uses}` : ""}</span>
                      {coupon.expires_at && (
                        <>
                          <span>•</span>
                          <span className={new Date(coupon.expires_at) < new Date() ? "text-red-400" : ""}> Expira: {new Date(coupon.expires_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleOpenEdit(coupon)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="text-red-500 hover:text-red-600" onClick={() => { setSelectedCoupon(coupon); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>{selectedCoupon ? "Editar Cupom" : "Novo Cupom"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código do Cupom</Label>
              <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="EX: VERÃO20" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Desconto</Label>
                <Select value={formData.discount_type} onValueChange={(v: "percent" | "fixed") => setFormData({ ...formData, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor do Desconto</Label>
                <Input type="number" step="0.01" value={formData.discount_value} onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Compra Mínima (opcional)</Label>
                <Input type="number" step="0.01" value={formData.min_purchase_value} onChange={(e) => setFormData({ ...formData, min_purchase_value: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Limite de Usos (opcional)</Label>
                <Input type="number" value={formData.max_uses} onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data de Expiração (opcional)</Label>
              <Input type="date" value={formData.expires_at} onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 py-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <Label>Cupom Ativo</Label>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="hero" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar Cupom"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
          <AlertDialogDescription>Tem certeza que deseja excluir "{selectedCoupon?.code}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-red-500">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCoupons;
