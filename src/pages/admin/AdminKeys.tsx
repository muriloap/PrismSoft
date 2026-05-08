import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Key, Plus, Trash2, Loader2, Search, 
  Package, ChevronDown, ChevronUp, Copy, Eye, EyeOff,
  AlertTriangle, Boxes
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useProducts, Product } from "@/hooks/useProducts";
import { useProductKeys } from "@/hooks/useProductKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const AdminKeys = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { products, loading: productsLoading } = useProducts();
  const { keys, loading: keysLoading, addKeys, deleteKey, deleteMultipleKeys, getKeyStats, getTotalStock, refetch } = useProductKeys();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string>("");
  const [keysText, setKeysText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());

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

  const toggleExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const toggleShowKey = (keyId: string) => {
    const newShowKeys = new Set(showKeys);
    if (newShowKeys.has(keyId)) {
      newShowKeys.delete(keyId);
    } else {
      newShowKeys.add(keyId);
    }
    setShowKeys(newShowKeys);
  };

  const copyKey = (keyValue: string) => {
    navigator.clipboard.writeText(keyValue);
    toast.success("Key copiada!");
  };

  const handleOpenAddDialog = (product: Product, variationId?: string) => {
    setSelectedProduct(product);
    setSelectedVariation(variationId || product.variations[0]?.id || "");
    setKeysText("");
    setIsAddDialogOpen(true);
  };

  const handleAddKeys = async () => {
    if (!selectedProduct || !selectedVariation || !keysText.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsSaving(true);
    try {
      const keysList = keysText
        .split("\n")
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (keysList.length === 0) {
        toast.error("Adicione pelo menos uma key");
        return;
      }

      await addKeys(selectedProduct.id, selectedVariation, keysList);
      toast.success(`${keysList.length} key(s) adicionada(s)!`);
      setIsAddDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar keys");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;

    try {
      await deleteKey(keyToDelete);
      toast.success("Key excluída!");
      setIsDeleteDialogOpen(false);
      setKeyToDelete(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir key");
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalKeys = keys.length;
  const availableKeys = keys.filter(k => k.status === 'available').length;
  const soldKeys = keys.filter(k => k.status === 'sold').length;

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Keys & Estoque</h1>
              <p className="text-sm text-muted-foreground">Gerenciar licenças e controlar estoque</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Boxes className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estoque Total</p>
                <p className="text-2xl font-bold">{availableKeys}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Key className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Keys Disponíveis</p>
                <p className="text-2xl font-bold">{availableKeys}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Key className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Keys Vendidas</p>
                <p className="text-2xl font-bold">{soldKeys}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                <p className="text-2xl font-bold">
                  {products.reduce((acc, p) => {
                    const productKeys = keys.filter(k => k.product_id === p.id);
                    const hasLowStock = p.variations.some(v => {
                      const varKeys = productKeys.filter(k => k.variation_id === v.id && k.status === 'available');
                      return varKeys.length <= 5 && varKeys.length > 0;
                    });
                    const hasNoStock = p.variations.some(v => {
                      const varKeys = productKeys.filter(k => k.variation_id === v.id && k.status === 'available');
                      return varKeys.length === 0;
                    });
                    return acc + (hasLowStock || hasNoStock ? 1 : 0);
                  }, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        {(() => {
          const lowStockItems = products.flatMap(p => {
            const productKeys = keys.filter(k => k.product_id === p.id);
            return p.variations
              .filter(v => {
                const varKeys = productKeys.filter(k => k.variation_id === v.id && k.status === 'available');
                return varKeys.length <= 5;
              })
              .map(v => {
                const varKeys = productKeys.filter(k => k.variation_id === v.id && k.status === 'available');
                return { product: p, variation: v, stock: varKeys.length };
              });
          });

          if (lowStockItems.length === 0) return null;

          return (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold text-yellow-500">Alertas de Estoque Baixo</h3>
              </div>
              <div className="grid gap-2">
                {lowStockItems.slice(0, 5).map(({ product, variation, stock }, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>
                      {product.name} - <span className="text-muted-foreground">{variation.name}</span>
                    </span>
                    <span className={stock === 0 ? "text-red-500 font-medium" : "text-yellow-500"}>
                      {stock} keys disponíveis
                    </span>
                  </div>
                ))}
                {lowStockItems.length > 5 && (
                  <p className="text-sm text-muted-foreground">
                    +{lowStockItems.length - 5} outros itens
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Products List */}
        {productsLoading || keysLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhum produto encontrado</h3>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => {
              const isExpanded = expandedProducts.has(product.id);
              const productKeys = keys.filter(k => k.product_id === product.id);

              return (
                <div
                  key={product.id}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  {/* Product Header */}
                  <div 
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpand(product.id)}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Estoque</p>
                        <p className="font-semibold">
                          {productKeys.filter(k => k.status === 'available').length} disponíveis
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-semibold text-muted-foreground">
                          {productKeys.length} keys
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddDialog(product);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {product.variations.map((variation) => {
                        const variationKeys = productKeys.filter(k => k.variation_id === variation.id);
                        const availableCount = variationKeys.filter(k => k.status === 'available').length;

                        return (
                          <div key={variation.id} className="border-b border-border last:border-b-0">
                            {/* Variation Header */}
                            <div className="p-4 bg-muted/30 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{variation.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  R$ {variation.price.toFixed(2)}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  availableCount === 0 
                                    ? 'bg-red-500/20 text-red-500' 
                                    : availableCount <= 5 
                                      ? 'bg-yellow-500/20 text-yellow-500'
                                      : 'bg-green-500/20 text-green-500'
                                }`}>
                                  {availableCount} disponíveis
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenAddDialog(product, variation.id)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Adicionar Keys
                              </Button>
                            </div>

                            {/* Keys List */}
                            {variationKeys.length > 0 ? (
                              <div className="divide-y divide-border">
                                {variationKeys.map((key) => (
                                  <div 
                                    key={key.id}
                                    className={`p-3 px-4 flex items-center justify-between ${
                                      key.status === 'sold' ? 'bg-muted/20' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <Key className={`h-4 w-4 flex-shrink-0 ${
                                        key.status === 'available' 
                                          ? 'text-green-500' 
                                          : key.status === 'sold'
                                            ? 'text-blue-500'
                                            : 'text-yellow-500'
                                      }`} />
                                      <code className="text-sm font-mono truncate">
                                        {showKeys.has(key.id) 
                                          ? key.key_value 
                                          : '••••••••••••••••'}
                                      </code>
                                      <span className={`px-2 py-0.5 rounded text-xs ${
                                        key.status === 'available'
                                          ? 'bg-green-500/20 text-green-500'
                                          : key.status === 'sold'
                                            ? 'bg-blue-500/20 text-blue-500'
                                            : 'bg-yellow-500/20 text-yellow-500'
                                      }`}>
                                        {key.status === 'available' ? 'Disponível' : 
                                         key.status === 'sold' ? 'Vendida' : 'Reservada'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => toggleShowKey(key.id)}
                                      >
                                        {showKeys.has(key.id) ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => copyKey(key.key_value)}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                      {key.status === 'available' && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-red-500 hover:text-red-600"
                                          onClick={() => {
                                            setKeyToDelete(key.id);
                                            setIsDeleteDialogOpen(true);
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 text-center text-muted-foreground text-sm">
                                Nenhuma key cadastrada para esta variação
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Keys Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Keys</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Variação</Label>
              <Select value={selectedVariation} onValueChange={setSelectedVariation}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma variação" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProduct?.variations.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} - R$ {v.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Keys (uma por linha)</Label>
              <Textarea
                value={keysText}
                onChange={(e) => setKeysText(e.target.value)}
                placeholder={"XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY\nZZZZ-ZZZZ-ZZZZ-ZZZZ"}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {keysText.split("\n").filter(k => k.trim()).length} key(s) para adicionar
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="hero" onClick={handleAddKeys} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Keys
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir key?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta key? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setKeyToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKey} className="bg-red-500 hover:bg-red-600">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminKeys;
