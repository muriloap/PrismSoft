import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'admin' | 'reseller' | 'user';

export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  productImage: string;
  variationId: string;
  variationName: string;
  price: number;
  originalPrice?: number;
  quantity: number;
}

export interface AppliedCoupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string, variationId: string) => void;
  updateQuantity: (productId: string, variationId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  appliedCoupon: AppliedCoupon | null;
  applyCoupon: (code: string) => Promise<{ success: boolean; error?: string }>;
  removeCoupon: () => void;
  isValidatingCoupon: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'prism-cart';
const COUPON_STORAGE_KEY = 'prism-coupon';

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(() => {
    const stored = localStorage.getItem(COUPON_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (appliedCoupon) {
      localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
    } else {
      localStorage.removeItem(COUPON_STORAGE_KEY);
    }
  }, [appliedCoupon]);

  const addItem = (item: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(
        i => i.productId === item.productId && i.variationId === item.variationId
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (productId: string, variationId: string) => {
    setItems(prev => prev.filter(
      i => !(i.productId === productId && i.variationId === variationId)
    ));
  };

  const updateQuantity = (productId: string, variationId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, variationId);
      return;
    }
    
    setItems(prev => prev.map(item => 
      item.productId === productId && item.variationId === variationId
        ? { ...item, quantity }
        : item
    ));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Calculate discount based on applied coupon
  const calculateDiscount = (): number => {
    if (!appliedCoupon) return 0;
    
    if (appliedCoupon.discount_type === 'percentage') {
      return subtotal * (appliedCoupon.discount_value / 100);
    } else {
      return Math.min(appliedCoupon.discount_value, subtotal);
    }
  };
  
  const discount = calculateDiscount();
  const total = subtotal - discount;
  const couponCode = appliedCoupon?.code || null;

  const applyCoupon = async (code: string): Promise<{ success: boolean; error?: string }> => {
    const upperCode = code.toUpperCase().trim();
    
    if (!upperCode) {
      return { success: false, error: 'Digite um código de cupom' };
    }
    
    setIsValidatingCoupon(true);
    
    try {
      // Fetch coupon from database
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', upperCode)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return { success: false, error: 'Cupom não encontrado ou inválido' };
      }

      const coupon = data;
      const now = new Date();

      // Check role restriction
      if (coupon.restricted_to_role) {
        if (!user?.id) {
          return { success: false, error: 'Faça login para usar este cupom' };
        }
        
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', coupon.restricted_to_role)
          .single();
        
        if (!userRole) {
          const roleNames: Record<AppRole, string> = {
            'admin': 'administradores',
            'reseller': 'revendedores',
            'user': 'usuários'
          };
          return { 
            success: false, 
            error: `Este cupom é exclusivo para ${roleNames[coupon.restricted_to_role as AppRole]}` 
          };
        }
      }

      // Check validity period
      if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        return { success: false, error: 'Este cupom ainda não está válido' };
      }

      if (coupon.valid_until && new Date(coupon.valid_until) < now) {
        return { success: false, error: 'Este cupom expirou' };
      }

      // Check usage limit
      if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
        return { success: false, error: 'Este cupom atingiu o limite de uso' };
      }

      // Check minimum purchase
      if (subtotal < coupon.min_purchase) {
        return { 
          success: false, 
          error: `Compra mínima de R$ ${Number(coupon.min_purchase).toFixed(2)} necessária` 
        };
      }

      // Apply coupon
      setAppliedCoupon({
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type as 'percentage' | 'fixed',
        discount_value: Number(coupon.discount_value),
      });

      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao validar cupom' };
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      subtotal,
      discount,
      total,
      couponCode,
      appliedCoupon,
      applyCoupon,
      removeCoupon,
      isValidatingCoupon
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
