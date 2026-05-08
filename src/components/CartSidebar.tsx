import { X, Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCart } from '@/hooks/useCart';

interface CartSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CartSidebar = ({ open, onOpenChange }: CartSidebarProps) => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, total } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleCheckout = () => {
    onOpenChange(false);
    navigate('/checkout');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md bg-card border-border">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrinho
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-180px)]">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
              <p>Seu carrinho está vazio</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variationId}`}
                  className="flex gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  <img
                    src={item.productImage}
                    alt={item.productName}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{item.productName}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{item.variationName}</p>
                    
                    <div className="flex items-center gap-2 mb-2">
                      {item.originalPrice && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(item.originalPrice)}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-primary">
                        {formatPrice(item.price)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-muted rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.productId, item.variationId, item.quantity - 1)}
                          className="p-2 hover:bg-muted-foreground/10 rounded-l-lg transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.variationId, item.quantity + 1)}
                          className="p-2 hover:bg-muted-foreground/10 rounded-r-lg transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId, item.variationId)}
                        className="p-2 hover:bg-destructive/20 hover:text-destructive rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Valor total:</span>
              <span className="text-2xl font-bold">{formatPrice(total)}</span>
            </div>
            
            <Button
              onClick={handleCheckout}
              disabled={items.length === 0}
              className="w-full h-12 bg-primary hover:bg-primary/90"
            >
              Ir para a compra
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CartSidebar;
