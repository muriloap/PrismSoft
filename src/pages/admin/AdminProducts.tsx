import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Package, Loader2, Upload, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useProducts, Product, ProductVariation } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
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
import { toast } from "sonner";
import { PRODUCT_CATEGORIES } from "@/constants/categories";
import { supabase } from "@/integrations/supabase/client";

const emptyVariation: ProductVariation = {
  id: "",
  name: "",
  price: 0,
  originalPrice: 0,
  stock: 0,
};

const emptyProduct = {
  slug: "",
  name: "",
  description: "",
  category: "",
  image_url: "",
  rating: 5,
  features: [] as string[],
  variations: [{ ...emptyVariation, id: "var-1" }] as ProductVariation[],
  is_active: true,
};

const AdminProducts = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { categories } = useCategories();
  const { products, loading: productsLoading, createProduct, updateProduct, deleteProduct } = useProducts();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [featuresText, setFeaturesText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setFormData(emptyProduct);
    setFeaturesText("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      slug: product.slug,
      name: product.name,
      description: product.description || "",
      category: product.category,
      image_url: product.image_url || "",
      rating: product.rating,
      features: product.features,
      variations: product.variations,
      is_active: product.is_active,
    });
    setFeaturesText(product.features.join("\n"));
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleAddVariation = () => {
    setFormData({
      ...formData,
      variations: [
        ...formData.variations,
        { ...emptyVariation, id: `var-${Date.now()}` },
      ],
    });
  };

  const handleRemoveVariation = (index: number) => {
    setFormData({
      ...formData,
      variations: formData.variations.filter((_, i) => i !== index),
    });
  };

  const handleVariationChange = (index: number, field: keyof ProductVariation, value: string | number) => {
    const newVariations = [...formData.variations];
    newVariations[index] = { ...newVariations[index], [field]: value } as ProductVariation;
    setFormData({ ...formData, variations: newVariations });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione um arquivo de imagem.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `product-images/${fileName}`;

      const { data, error } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (error) {
        if (error.message.includes("not found")) {
          throw new Error("Bucket 'products' não encontrado. Crie um bucket público chamado 'products' no seu Supabase Storage.");
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast.success("Imagem enviada com sucesso!");
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Erro no upload:", err);
      toast.error(err.message || "Erro ao fazer upload da imagem");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const productData = {
        ...formData,
        features: featuresText.split("\n").filter(f => f.trim()),
        variations: formData.variations.map((v, i) => ({
          ...v,
          id: v.id || `var-${i}`,
        })),
      };

      if (selectedProduct) {
        await updateProduct(selectedProduct.id, productData);
        toast.success("Produto atualizado!");
      } else {
        await createProduct(productData);
        toast.success("Produto criado!");
      }
      setIsDialogOpen(false);
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Erro ao salvar produto");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;

    try {
      await deleteProduct(selectedProduct.id);
      toast.success("Produto excluído!");
      setIsDeleteDialogOpen(false);
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Erro ao excluir produto");
    }
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Produtos</h1>
              <p className="text-sm text-muted-foreground">Gerenciar produtos e estoque</p>
            </div>
          </div>
          <Button variant="hero" onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {productsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhum produto cadastrado</h3>
            <p className="text-muted-foreground mb-4">Comece adicionando seu primeiro produto</p>
            <Button variant="hero" onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Produto
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-card rounded-xl border border-border p-4 flex items-center gap-4"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{product.name}</h3>
                    {!product.is_active && (
                      <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 text-xs">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{product.category}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {product.variations.length} variações
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      Estoque total: {product.variations.reduce((acc, v) => acc + v.stock, 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpenEdit(product)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleOpenDelete(product)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Product Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="produto-exemplo"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_url">Imagem do Produto</Label>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Input
                      id="image_url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://... ou faça upload"
                      className="flex-1"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="image/*"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="gap-2 shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {isUploading ? "Enviando..." : "Fazer Upload"}
                    </Button>
                  </div>
                  {formData.image_url && (
                    <div className="w-full h-32 rounded-lg border border-border/50 overflow-hidden bg-muted group relative">
                      <img src={formData.image_url} alt="Preview" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-white hover:text-white"
                          onClick={() => setFormData({ ...formData, image_url: "" })}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Características (uma por linha)</Label>
              <Textarea
                id="features"
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                rows={3}
                placeholder="Característica 1&#10;Característica 2&#10;Característica 3"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Variações de Preço</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddVariation}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {formData.variations.map((variation, index) => (
                <div key={index} className="grid grid-cols-5 gap-2 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={variation.name}
                      onChange={(e) => handleVariationChange(index, "name", e.target.value)}
                      placeholder="Diário"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Preço</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={variation.price}
                      onChange={(e) => handleVariationChange(index, "price", parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Preço Original</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={variation.originalPrice || ""}
                      onChange={(e) => handleVariationChange(index, "originalPrice", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estoque</Label>
                    <Input
                      type="number"
                      value={variation.stock}
                      onChange={(e) => handleVariationChange(index, "stock", parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => handleRemoveVariation(index)}
                      disabled={formData.variations.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Produto ativo</Label>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="hero" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedProduct?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProducts;
