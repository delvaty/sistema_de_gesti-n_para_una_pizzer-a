import { Tables } from './supabase';

export type Pizza = Tables<'pizzas'>;

export interface CartItem extends Pizza {
  quantity: number;
}

// Tipos para el historial de pedidos
type OrderItem = Tables<'order_items'> & {
  pizzas: Pizza | null;
};

export type OrderWithDetails = Tables<'orders'> & {
  order_items: OrderItem[];
};
