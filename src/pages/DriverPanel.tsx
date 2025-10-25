// src/pages/DriverPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { LoaderCircle } from 'lucide-react';
import type { Database } from '../types/supabase';

// Tipos basados en tu Database generado por supabase
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type PizzaRow = Database['public']['Tables']['pizzas']['Row'];

// Estructura simplificada que usará la UI para mostrar detalles
type OrderItemDetail = {
  id: string;
  pizza: { id: string; name: string; image_url?: string | null } | null;
  quantity: number;
  unit_price: number;
  addons: { id: string; name: string; price: number }[];
};

export default function DriverPanel() {
  const { isAuthenticated, loading: authLoading, profile } = useAuth();
  const navigate = useNavigate();

  // Guard: sólo drivers o admins
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
    if (!authLoading && isAuthenticated && !['driver', 'admin'].includes((profile as any)?.role)) {
      navigate('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, profile]);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'accepted' | 'in_transit' | 'delivered'>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<Record<string, OrderItemDetail[]>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Mapeo estados (ajusta si en tu DB los nombres difieren)
  const STATUS_MAP = useMemo(
    () => ({
      new: ['pending', 'new'],
      accepted: ['accepted'],
      in_transit: ['in_transit'],
      delivered: ['delivered'],
    }),
    []
  );

  // Helper: formatea fecha segura cuando puede ser string | null
  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  // Fetch inicial (aplica filtro)
  const fetchOrders = async (statusFilter?: typeof filter) => {
    setLoading(true);
    setError(null);
    try {
      let query: any = supabase
        .from('orders')
        .select('id,user_id,total_price,delivery_address,delivery_time,status,created_at')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        const allowed = STATUS_MAP[statusFilter as keyof typeof STATUS_MAP];
        // Supabase typing estricta: casteamos array a string[] para evitar error TS
        query = query.in('status', allowed as unknown as string[]);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders((data ?? []) as unknown as OrderRow[]);
    } catch (err: any) {
      console.error('fetchOrders error', err);
      setError(err?.message ?? 'No se pudieron cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  };

  // Suscripción en tiempo real (Supabase v2 channel API)
  useEffect(() => {
    fetchOrders(filter);

    const channel = supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          const evt = (payload.eventType || payload.event || '').toLowerCase();
          const newRow = payload.new ?? payload.record ?? payload.payload;
          const oldRow = payload.old;

          setOrders((prev) => {
            if (evt.includes('insert')) {
              if (!newRow) return prev;
              return [newRow as OrderRow, ...prev];
            }
            if (evt.includes('update')) {
              if (!newRow) return prev;
              return prev.map((p) => (p.id === newRow.id ? (newRow as OrderRow) : p));
            }
            if (evt.includes('delete')) {
              if (!oldRow) return prev;
              return prev.filter((p) => p.id !== oldRow.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // subscribe once

  // Refetch cuando cambie el filtro
  useEffect(() => {
    fetchOrders(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Fetch detalle (items + addons) de un pedido
  const fetchOrderDetails = async (orderId: string) => {
    if (orderDetails[orderId]) return; // cache
    try {
      // Select anidado: pizzas(...) y order_item_addons(..., addons(...))
      const { data, error } = await supabase
        .from('order_items')
        .select(
          `
          id,
          quantity,
          unit_price,
          pizzas ( id, name, image_url ),
          order_item_addons (
            id,
            addons ( id, name, price )
          )
        `
        )
        .eq('order_id', orderId);

      if (error) throw error;

      const parsed: OrderItemDetail[] = (data ?? []).map((it: any) => ({
        id: it.id,
        pizza: it.pizzas ? { id: it.pizzas.id, name: it.pizzas.name, image_url: it.pizzas.image_url } : null,
        quantity: it.quantity,
        unit_price: typeof it.unit_price === 'number' ? it.unit_price : parseFloat(it.unit_price ?? 0),
        addons:
          (it.order_item_addons ?? [])
            .map((oia: any) => (oia.addons ? { id: oia.addons.id, name: oia.addons.name, price: oia.addons.price } : null))
            .filter(Boolean) as { id: string; name: string; price: number }[],
      }));

      setOrderDetails((prev) => ({ ...prev, [orderId]: parsed }));
    } catch (err: any) {
      console.error('fetchOrderDetails error', err);
      setError('No se pudieron cargar los items del pedido.');
    }
  };

  // Update estado del pedido
  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);
    try {
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
      if (error) throw error;
      // optimista: actualiza local
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } catch (err: any) {
      console.error('updateOrderStatus error', err);
      setError('No se pudo actualizar el estado del pedido.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold">Panel de Repartidor</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary ">Filtrar:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="rounded-md border border-border p-2 text-black"
          >
            <option value="all">Todos</option>
            <option value="new">Nuevos</option>
            <option value="accepted">Aceptados</option>
            <option value="in_transit">En Camino</option>
            <option value="delivered">Entregados</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span>Cargando pedidos...</span>
        </div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : orders.length === 0 ? (
        <div className="text-text-secondary">No hay pedidos para mostrar.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-md border border-border p-4">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">Pedido {o.id}</div>
                  <div className="text-sm text-text-secondary">Usuario: {o.user_id ?? 'Anon'}</div>
                  <div className="text-sm text-text-secondary">Dirección: {o.delivery_address}</div>
                  <div className="text-sm text-text-secondary">Horario: {fmtDate(o.delivery_time ?? null)}</div>
                  <div className="text-sm text-text-secondary">Total: ${Number(o.total_price ?? 0).toFixed(2)}</div>
                  <div className="mt-2">
                    <span className="inline-block rounded-md border border-border px-2 py-1 text-xs">
                      Estado: {o.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm text-text-secondary">{fmtDate(o.created_at ?? null)}</div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {o.status !== 'accepted' && (
                      <Button size="sm" onClick={() => updateOrderStatus(o.id, 'accepted')} disabled={!!updatingOrderId}>
                        Aceptar
                      </Button>
                    )}
                    {o.status === 'accepted' && (
                      <Button size="sm" onClick={() => updateOrderStatus(o.id, 'in_transit')} disabled={!!updatingOrderId}>
                        Iniciar Entrega
                      </Button>
                    )}
                    {o.status !== 'delivered' && (
                      <Button size="sm" variant="destructive" onClick={() => updateOrderStatus(o.id, 'delivered')} disabled={!!updatingOrderId}>
                        Marcar Entregado
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const id = o.id;
                        setExpandedOrderId((prev) => (prev === id ? null : id));
                        if (!orderDetails[id]) await fetchOrderDetails(id);
                      }}
                    >
                      {expandedOrderId === o.id ? 'Cerrar' : 'Ver Detalle'}
                    </Button>
                  </div>
                </div>
              </div>

              {expandedOrderId === o.id && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-medium mb-2">Items</h4>
                  {orderDetails[o.id] ? (
                    <ul className="space-y-2">
                      {orderDetails[o.id].map((it) => (
                        <li key={it.id} className="flex justify-between">
                          <div>
                            <div className="font-medium">{it.pizza?.name ?? 'Pizza'}</div>
                            <div className="text-sm text-text-secondary">Cantidad: {it.quantity}</div>
                            {it.addons.length > 0 && <div className="text-sm text-text-secondary">Add-ons: {it.addons.map(a => a.name).join(', ')}</div>}
                          </div>
                          <div className="text-sm font-semibold">${((it.unit_price ?? 0) * it.quantity).toFixed(2)}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-text-secondary">Cargando items...</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
