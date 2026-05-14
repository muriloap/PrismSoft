import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Tag, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useCategories, Category } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_CATEGORIES } from "@/constants/categories";
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

const emptyCategory = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  sort_order: 0,
  is_active: true,
};

const AdminCategories = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { 
    categories, 
    loading: categoriesLoading, 
    createCategory, 
    updateCategory, 
    deleteCategory 
  } = useCategories();
  const { products } = useProducts();
  const navigate = useNavigate();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState(emptyCategory);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

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
    setSelectedCategory(null);
    setFormData({
      ...emptyCategory,
      sort_order: categories.length,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      icon: category.icon || "",
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (selectedCategory) {
        await updateCategory(selectedCategory.id, formData);
        toast.success("Categoria atualizada!");
      } else {
        await createCategory(formData);
        toast.success("Categoria criada!");
      }
      setIsDialogOpen(false);
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Erro ao salvar categoria");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    try {
      await deleteCategory(selectedCategory.id);
      toast.success("Categoria excluída!");
      setIsDeleteDialogOpen(false);
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Erro ao excluir categoria");
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      for (let i = 0; i < PRODUCT_CATEGORIES.length; i++) {
        const name = PRODUCT_CATEGORIES[i];
        const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        
        // Check if category already exists
        const exists = categories.find(c => c.name === name || c.slug === slug);
        if (!exists) {
          await createCategory({
            name,
            slug,
            description: `Produtos da categoria ${name}`,
            icon: "Tag",
            sort_order: i,
            is_active: true
          });
        }
      }
      toast.success("Categorias padrão restauradas!");
    } catch (error: unknown) {
      const err = error as Error;
      toast.error("Erro ao restaurar categorias");
      console.error(err);
    } finally {
      setIsSeeding(false);
    }
  };

  const getProductCount = (categoryName: string) => {
    return products.filter(p => p.category === categoryName).length;
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
    <div className="min-h-screen bg-background text-foreground">
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
              <h1 className="text-2xl font-bold">Categorias</h1>
              <p className="text-sm text-muted-foreground">Gerenciar categorias da Store</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="hero" 
              onClick={handleSeedDefaults} 
              disabled={isSeeding}
              className="gap-2"
            >
              {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Restaurar Categorias Fixas
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {categoriesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl bg-card/50 backdrop-blur-sm">
            <Tag className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-xl font-semibold mb-2">Categorias não inicializadas</h3>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
              Clique no botão abaixo para inicializar as categorias fixas do sistema conforme solicitado.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" onClick={handleSeedDefaults} disabled={isSeeding} className="gap-2 px-12 h-12 shadow-xl shadow-purple-500/20">
                {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Inicializar Categorias Fixas
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {categories.map((category) => {
              const count = getProductCount(category.name);
              const isFixed = PRODUCT_CATEGORIES.includes(category.name as any);
              
              return (
                <div
                  key={category.id}
                  className="group bg-card rounded-2xl border border-border p-5 flex items-center gap-4 hover:border-purple-500/50 transition-all"
                >
                  <div className="p-3 rounded-xl bg-muted group-hover:bg-purple-500/10 transition-colors">
                    <Tag className="h-6 w-6 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold truncate">{category.name}</h3>
                      {isFixed && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-wider">
                          Fixa
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-mono text-xs">/store/{category.slug}</span>
                      <span>•</span>
                      <span>{count} {count === 1 ? "produto" : "produtos"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground italic mr-2">Configuração fixa</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Category Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              {selectedCategory ? (
                <>
                  <Pencil className="h-5 w-5 text-purple-500" />
                  Editar Categoria
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-purple-500" />
                  Nova Categoria
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Categoria</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                    setFormData({ ...formData, name, slug });
                  }}
                  placeholder="Ex: Softwares"
                  className="bg-muted/50 border-border"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="softwares"
                  className="bg-muted/50 border-border"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Uma breve descrição sobre a categoria..."
                className="bg-muted/50 border-border min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Ordem de Exibição</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="bg-muted/50 border-border"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Ícone (nome lucide)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="Package, Shield, Monitor..."
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="rounded-xl border-border"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                variant="hero" 
                disabled={isSaving}
                className="px-8"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Categoria"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir "{selectedCategory?.name}"? 
              <br />
              <span className="text-red-400 font-medium">Os produtos vinculados a esta categoria NÃO serão excluídos, mas perderão a referência.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20"
            >
              Excluir Categoria
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCategories;
