// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';
// import { CartItem, Pizza } from '../types/database';

// interface CartState {
//   items: CartItem[];
//   addItem: (pizza: Pizza) => void;
//   removeItem: (pizzaId: string) => void;
//   updateQuantity: (pizzaId: string, quantity: number) => void;
//   clearCart: () => void;
//   totalItems: number;
//   totalPrice: number;
// }

// export const useCartStore = create(
//   persist<CartState>(
//     (set, get) => ({
//       items: [],
//       totalItems: 0,
//       totalPrice: 0,

//       addItem: (pizza: Pizza) => {
//         const { items } = get();
//         const existingItem = items.find((item) => item.id === pizza.id);

//         let updatedItems;
//         if (existingItem) {
//           updatedItems = items.map((item) =>
//             item.id === pizza.id
//               ? { ...item, quantity: item.quantity + 1 }
//               : item
//           );
//         } else {
//           updatedItems = [...items, { ...pizza, quantity: 1 }];
//         }
        
//         set((state) => ({
//           items: updatedItems,
//           totalItems: state.totalItems + 1,
//           totalPrice: state.totalPrice + pizza.price,
//         }));
//       },

//       removeItem: (pizzaId: string) => {
//         const { items } = get();
//         const itemToRemove = items.find((item) => item.id === pizzaId);
//         if (!itemToRemove) return;

//         const updatedItems = items.filter((item) => item.id !== pizzaId);
        
//         set((state) => ({
//           items: updatedItems,
//           totalItems: state.totalItems - itemToRemove.quantity,
//           totalPrice: state.totalPrice - (itemToRemove.price * itemToRemove.quantity),
//         }));
//       },

//       updateQuantity: (pizzaId: string, quantity: number) => {
//         if (quantity < 1) {
//           get().removeItem(pizzaId);
//           return;
//         }

//         let updatedItems = get().items.map((item) =>
//           item.id === pizzaId ? { ...item, quantity } : item
//         );

//         const newTotalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
//         const newTotalPrice = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

//         set({
//           items: updatedItems,
//           totalItems: newTotalItems,
//           totalPrice: newTotalPrice,
//         });
//       },

//       clearCart: () => set({ items: [], totalItems: 0, totalPrice: 0 }),
//     }),
//     {
//       name: 'cart-storage', // Nombre para el almacenamiento local
//       onRehydrateStorage: () => (state) => {
//         if (state) {
//           const newTotalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
//           const newTotalPrice = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
//           state.totalItems = newTotalItems;
//           state.totalPrice = newTotalPrice;
//         }
//       }
//     }
//   )
// );
// store/cartStore.ts
import create from 'zustand';

export type Addon = {
  id: string;
  name: string;
  price: number;
};

export type CartItem = {
  cartItemId: string; // clave única para distinguir iguales con distintos addons
  id: string; // pizza id
  name: string;
  price: number; // unit pizza price
  image_url?: string | null;
  quantity: number;
  addons: Addon[]; // lista de addons aplicados a este cart item
};

type CartState = {
  items: CartItem[];
  addItem: (
    pizza: Omit<CartItem, 'cartItemId' | 'quantity' | 'addons'> & { quantity?: number; addons?: Addon[] }
  ) => void;
  updateQuantity: (cartItemId: string, qty: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  toggleAddonForItem: (cartItemId: string, addon: Addon) => void;
  setAddonsForItem: (cartItemId: string, addons: Addon[]) => void;
  totalPrice: () => number;
  totalItems: () => number; // <-- nuevo: devuelve el total de unidades en el carrito
};

const genId = () =>
  typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2, 9);

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (pizza) => {
    const { id, name, price, image_url } = pizza;
    const quantity = pizza.quantity ?? 1;
    const addons = pizza.addons ?? [];

    // Try to find existing item with same pizza id AND same addons set
    const items = get().items;
    const isSameAddons = (a1: Addon[], a2: Addon[]) => {
      if (a1.length !== a2.length) return false;
      const ids1 = [...a1.map((a) => a.id)].sort();
      const ids2 = [...a2.map((a) => a.id)].sort();
      return ids1.join(',') === ids2.join(',');
    };

    const existingIndex = items.findIndex((it) => it.id === id && isSameAddons(it.addons, addons));

    if (existingIndex !== -1) {
      // increase quantity of existing
      const newItems = items.map((it, idx) => (idx === existingIndex ? { ...it, quantity: it.quantity + quantity } : it));
      set({ items: newItems });
      return;
    }

    // else create new cart item with unique cartItemId
    const newItem: CartItem = {
      cartItemId: genId(),
      id,
      name,
      price,
      image_url: image_url ?? null,
      quantity,
      addons,
    };
    set({ items: [...items, newItem] });
  },
  updateQuantity: (cartItemId, qty) => {
    if (qty <= 0) {
      // remove
      set({ items: get().items.filter((i) => i.cartItemId !== cartItemId) });
      return;
    }
    set({ items: get().items.map((i) => (i.cartItemId === cartItemId ? { ...i, quantity: qty } : i)) });
  },
  removeItem: (cartItemId) => {
    set({ items: get().items.filter((i) => i.cartItemId !== cartItemId) });
  },
  clearCart: () => set({ items: [] }),
  toggleAddonForItem: (cartItemId, addon) => {
    const items = get().items;
    const newItems = items.map((it) => {
      if (it.cartItemId !== cartItemId) return it;
      const found = it.addons.find((a) => a.id === addon.id);
      if (found) {
        return { ...it, addons: it.addons.filter((a) => a.id !== addon.id) };
      } else {
        return { ...it, addons: [...it.addons, addon] };
      }
    });

    // Merge duplicates after toggling
    const merged: CartItem[] = [];
    const key = (it: CartItem) => it.id + '|' + [...it.addons.map((a) => a.id)].sort().join(',');
    for (const it of newItems) {
      const k = key(it);
      const existing = merged.find((m) => key(m) === k);
      if (existing) {
        existing.quantity += it.quantity;
      } else {
        merged.push({ ...it });
      }
    }

    set({ items: merged });
  },
  setAddonsForItem: (cartItemId, addons) => {
    const items = get().items;
    const newItems = items.map((it) => (it.cartItemId === cartItemId ? { ...it, addons } : it));

    // Merge duplicates after setting addons
    const merged: CartItem[] = [];
    const key = (it: CartItem) => it.id + '|' + [...it.addons.map((a) => a.id)].sort().join(',');
    for (const it of newItems) {
      const k = key(it);
      const existing = merged.find((m) => key(m) === k);
      if (existing) {
        existing.quantity += it.quantity;
      } else {
        merged.push({ ...it });
      }
    }
    set({ items: merged });
  },
  totalPrice: () => {
    // sum pizza price + addons price per item * quantity
    return get().items.reduce((acc, it) => {
      const addonsSum = it.addons.reduce((s, a) => s + (a.price ?? 0), 0);
      return acc + (it.price + addonsSum) * it.quantity;
    }, 0);
  },
  totalItems: () => {
    return get().items.reduce((sum, it) => sum + it.quantity, 0);
  },
}));
