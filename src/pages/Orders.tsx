import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { LoaderCircle, Package, Pizza } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { OrderWithDetails } from '../types/database';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

const statusColors: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' } = {
  pending: 'warning',
  preparing: 'secondary',
  out_for_delivery: 'default',
  delivered: 'success',
  cancelled: 'destructive',
};

const statusText: { [key: string]: string } = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  out_for_delivery: 'En reparto',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              *,
              pizzas (*)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data as OrderWithDetails[]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="container py-16 text-center text-red-500">Error: {error}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
        <Package className="mx-auto h-16 w-16 text-text-secondary" />
        <h1 className="mt-4 font-serif text-4xl font-bold">No tienes pedidos</h1>
        <p className="mt-4 text-lg text-text-secondary">
          Parece que aún no has hecho ningún pedido. ¡Empieza a explorar nuestro menú!
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/">Ver Menú</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-serif text-4xl font-bold">Mis Pedidos</h1>
      <div className="mt-8 space-y-8">
        {orders.map((order) => (
          <div key={order.id} className="rounded-xl border border-border bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Pedido #{order.id.substring(0, 8)}</h2>
                <p className="text-sm text-text-secondary">
                  {new Date(order.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xl font-bold">${order.total_price.toFixed(2)}</span>
                <Badge variant={statusColors[order.status] || 'secondary'}>
                  {statusText[order.status] || order.status}
                </Badge>
              </div>
            </div>
            <div className="my-4 border-t border-border" />
            <ul className="space-y-4">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex items-center gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-background">
                    {item.pizzas?.image_url ? (
                      <img src={item.pizzas.image_url} alt={item.pizzas.name} className="h-full w-full object-cover rounded-md" />
                    ) : (
                      <Pizza className="h-6 w-6 text-text-secondary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{item.pizzas?.name || 'Pizza no disponible'}</p>
                    <p className="text-sm text-text-secondary">
                      {item.quantity} x ${item.unit_price.toFixed(2)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
