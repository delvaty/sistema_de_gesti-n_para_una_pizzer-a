import { useState } from 'react';
import { useCartStore } from '../store/cartStore';
import { Button } from '../components/ui/Button';
import { Trash2, Plus, Minus, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { TablesInsert } from '../types/supabase';

export default function Cart() {
  const { items, totalPrice, updateQuantity, removeItem, clearCart } = useCartStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Crear el pedido
      const orderData: TablesInsert<'orders'> = {
        user_id: user.id,
        total_price: totalPrice,
        delivery_address: '123 Pizza St, Flavor Town', // Dirección de ejemplo
      };

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Crear los items del pedido
      const orderItemsData: TablesInsert<'order_items'>[] = items.map((item) => ({
        order_id: newOrder.id,
        pizza_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);

      if (itemsError) throw itemsError;

      // 3. Limpiar carrito y redirigir
      clearCart();
      navigate('/orders');

    } catch (err: any) {
      setError('No se pudo procesar el pedido. Por favor, inténtalo de nuevo.');
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="font-serif text-4xl font-bold">Tu Carrito está Vacío</h1>
        <p className="mt-4 text-lg text-text-secondary">
          Parece que aún no has añadido ninguna pizza. ¡Explora nuestro menú!
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/">Ver Menú</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-serif text-4xl font-bold">Tu Carrito</h1>
      <div className="mt-8 flow-root">
        <ul role="list" className="-my-6 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex py-6">
              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-border">
                <img
                  src={item.image_url || ''}
                  alt={item.name}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="ml-4 flex flex-1 flex-col">
                <div>
                  <div className="flex justify-between text-base font-medium text-text">
                    <h3>{item.name}</h3>
                    <p className="ml-4">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex flex-1 items-end justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                     <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      className="font-medium text-primary hover:text-primary/80"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-12 border-t border-border pt-8">
        <div className="flex justify-between text-lg font-bold text-text">
          <p>Subtotal</p>
          <p>${totalPrice.toFixed(2)}</p>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          Los gastos de envío e impuestos se calcularán en el checkout.
        </p>
        <div className="mt-6">
          <Button size="lg" className="w-full" onClick={handleCheckout} disabled={loading}>
            {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Procesando...' : 'Proceder al Pago'}
          </Button>
        </div>
        {error && <p className="mt-4 text-center text-red-500">{error}</p>}
        <div className="mt-6 flex justify-center text-center text-sm text-text-secondary">
          <p>
            o{' '}
            <Link to="/" className="font-medium text-primary hover:text-primary/80">
              Continuar Comprando
              <span aria-hidden="true"> &rarr;</span>
            </Link>
          </p>
        </div>
         <div className="mt-4 text-center">
            <Button variant="link" className="text-red-500" onClick={clearCart}>
                Vaciar Carrito
            </Button>
        </div>
      </div>
    </div>
  );
}
