import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Pizza } from '../types/database';

interface CartState {
  items: CartItem[];
  addItem: (pizza: Pizza) => void;
  removeItem: (pizzaId: string) => void;
  updateQuantity: (pizzaId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

export const useCartStore = create(
  persist<CartState>(
    (set, get) => ({
      items: [],
      totalItems: 0,
      totalPrice: 0,

      addItem: (pizza: Pizza) => {
        const { items } = get();
        const existingItem = items.find((item) => item.id === pizza.id);

        let updatedItems;
        if (existingItem) {
          updatedItems = items.map((item) =>
            item.id === pizza.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          updatedItems = [...items, { ...pizza, quantity: 1 }];
        }
        
        set((state) => ({
          items: updatedItems,
          totalItems: state.totalItems + 1,
          totalPrice: state.totalPrice + pizza.price,
        }));
      },

      removeItem: (pizzaId: string) => {
        const { items } = get();
        const itemToRemove = items.find((item) => item.id === pizzaId);
        if (!itemToRemove) return;

        const updatedItems = items.filter((item) => item.id !== pizzaId);
        
        set((state) => ({
          items: updatedItems,
          totalItems: state.totalItems - itemToRemove.quantity,
          totalPrice: state.totalPrice - (itemToRemove.price * itemToRemove.quantity),
        }));
      },

      updateQuantity: (pizzaId: string, quantity: number) => {
        if (quantity < 1) {
          get().removeItem(pizzaId);
          return;
        }

        let updatedItems = get().items.map((item) =>
          item.id === pizzaId ? { ...item, quantity } : item
        );

        const newTotalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const newTotalPrice = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        set({
          items: updatedItems,
          totalItems: newTotalItems,
          totalPrice: newTotalPrice,
        });
      },

      clearCart: () => set({ items: [], totalItems: 0, totalPrice: 0 }),
    }),
    {
      name: 'cart-storage', // Nombre para el almacenamiento local
      onRehydrateStorage: () => (state) => {
        if (state) {
          const newTotalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
          const newTotalPrice = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          state.totalItems = newTotalItems;
          state.totalPrice = newTotalPrice;
        }
      }
    }
  )
);
