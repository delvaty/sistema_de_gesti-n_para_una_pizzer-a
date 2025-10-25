// pages/AdminPizzas.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoaderCircle, Edit, Trash2, Plus } from 'lucide-react';
import type { Database } from '../types/supabase';

type PizzaRow = Database['public']['Tables']['pizzas']['Row'];
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type OrderItemAddonRow = Database['public']['Tables']['order_item_addons']['Row'];
type AddonRow = Database['public']['Tables']['addons']['Row'];

/** Estructura para detalle de items que muestra la UI */
type OrderItemDetail = {
  id: string;
  pizza: { id: string; name: string; image_url?: string | null } | null;
  quantity: number;
  unit_price: number;
  addons: { id: string; name: string; price: number }[];
};

export default function AdminPizzas() {
  const { isAuthenticated, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, loading, navigate]);

  // --- PIZZAS ---
  const [pizzas, setPizzas] = useState<PizzaRow[]>([]);
  const [loadingPizzas, setLoadingPizzas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PizzaRow | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0.00');
  const [imageUrl, setImageUrl] = useState('');

  // --- PEDIDOS ---
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderDetails, setOrderDetails] = useState<Record<string, OrderItemDetail[]>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [editingStatusFor, setEditingStatusFor] = useState<Record<string, string>>({}); // estado seleccionado temporalmente
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // --- FETCH PIZZAS ---
  const fetchPizzas = async () => {
    setLoadingPizzas(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('pizzas')
        .select('id,name,description,price,image_url,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows: PizzaRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? null,
        price: typeof r.price === 'number' ? r.price : parseFloat(r.price ?? 0),
        image_url: r.image_url ?? null,
        created_at: r.created_at ?? undefined,
      }));
      setPizzas(rows);
    } catch (err: any) {
      console.error('Error fetching pizzas', err);
      setError(err.message ?? 'No se pudieron cargar las pizzas.');
    } finally {
      setLoadingPizzas(false);
    }
  };

  // --- FETCH PEDIDOS ---
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id,user_id,total_price,delivery_address,delivery_time,status,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders((data ?? []) as OrderRow[]);
      // inicializar editingStatusFor con estado actual
      const map: Record<string, string> = {};
      (data ?? []).forEach((o: any) => {
        map[o.id] = o.status ?? 'pending';
      });
      setEditingStatusFor(map);
    } catch (err: any) {
      console.error('Error fetching orders', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (!loading && profile?.role !== 'admin') return;
    fetchPizzas();
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, loading]);

  const prepareCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setPrice('0.00');
    setImageUrl('');
  };

  const prepareEdit = (p: PizzaRow) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description ?? '');
    setPrice((p.price ?? 0).toFixed(2));
    setImageUrl(p.image_url ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Introduce un precio válido.');
      return;
    }
    setError(null);

    try {
      if (editing) {
        const { data, error } = await supabase
          .from('pizzas')
          .update({ name: name.trim(), description: description.trim(), price: parsedPrice, image_url: imageUrl || null })
          .eq('id', editing.id)
          .select()
          .single();
        if (error) throw error;
        setPizzas((prev) => prev.map((p) => (p.id === data.id ? data : p)));
        setEditing(null);
      } else {
        const { data, error } = await supabase
          .from('pizzas')
          .insert({ name: name.trim(), description: description.trim(), price: parsedPrice, image_url: imageUrl || null })
          .select()
          .single();
        if (error) throw error;
        setPizzas((prev) => [data, ...prev]);
        prepareCreate();
      }
    } catch (err: any) {
      console.error('Save pizza error', err);
      setError(err.message || 'No se pudo guardar la pizza.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta pizza?')) return;
    try {
      const { error } = await supabase.from('pizzas').delete().eq('id', id);
      if (error) throw error;
      setPizzas((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      console.error('Delete pizza error', err);
      setError('No se pudo borrar la pizza.');
    }
  };

  // --- PEDIDOS: helpers para detalle, actualizar estado y borrar pedido ---
  const fetchOrderDetails = async (orderId: string) => {
    if (orderDetails[orderId]) return; // cache
    try {
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

  const updateOrderStatus = async (orderId: string) => {
    const newStatus = editingStatusFor[orderId];
    if (!newStatus) return;
    setProcessingOrderId(orderId);
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    } catch (err: any) {
      console.error('updateOrderStatus error', err);
      setError('No se pudo actualizar el estado del pedido.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const deleteOrder = async (orderId: string) => {
    const ok = window.confirm('¿Eliminar este pedido? Esta acción eliminará también sus items.');
    if (!ok) return;
    setProcessingOrderId(orderId);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      // limpiar cache de detalles
      setOrderDetails((prev) => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    } catch (err: any) {
      console.error('deleteOrder error', err);
      setError('No se pudo eliminar el pedido.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Formatea fecha segura (puede ser null)
  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  if (!loading && profile?.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Acceso no autorizado</h1>
        <p className="mt-2 text-text-secondary">Necesitas ser administrador para acceder a esta página.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* --- Sección Pizzas --- */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold">Administrar Pizzas</h1>
        <Button onClick={prepareCreate} leftIcon={<Plus />}>
          Nueva Pizza
        </Button>
      </div>

      <div className="mb-8 rounded-lg border border-border bg-surface p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Precio</label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-background p-2 text-sm" rows={3} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">URL de imagen (opcional)</label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit">{editing ? 'Actualizar Pizza' : 'Crear Pizza'}</Button>
            {editing && <Button variant="outline" onClick={prepareCreate}>Cancelar</Button>}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </form>
      </div>

      {/* --- Listado de pizzas --- */}
      <div className="rounded-lg border border-border bg-surface p-6 mb-8">
        <h2 className="mb-4 text-lg font-medium">Listado de pizzas ({pizzas.length})</h2>
        {loadingPizzas ? (
          <div className="flex items-center gap-2">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            <span>Cargando pizzas...</span>
          </div>
        ) : pizzas.length === 0 ? (
          <p className="text-text-secondary">No hay pizzas aún.</p>
        ) : (
          <div className="space-y-4">
            {pizzas.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-4">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="h-16 w-16 rounded-md object-cover" />
                    : <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-sm">No Img</div>}
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-text-secondary">{p.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold">${(p.price ?? 0).toFixed(2)}</div>
                  <Button variant="ghost" onClick={() => prepareEdit(p)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Sección Pedidos --- */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-medium">Pedidos ({orders.length})</h2>
        {loadingOrders ? (
          <div className="flex items-center gap-2">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            <span>Cargando pedidos...</span>
          </div>
        ) : orders.length === 0 ? (
          <p className="text-text-secondary">No hay pedidos aún.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="rounded-md border border-border p-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    <div className="font-medium">ID Pedido: {o.id}</div>
                    <div className="text-sm text-text-secondary">Usuario: {o.user_id ?? 'Anon'}</div>
                    <div className="text-sm text-text-secondary">Dirección: {o.delivery_address}</div>
                    <div className="text-sm text-text-secondary">Horario: {fmtDate(o.delivery_time ?? null)}</div>
                    <div className="text-sm text-text-secondary">Total: ${Number(o.total_price ?? 0).toFixed(2)}</div>
                    <div className="text-sm text-text-secondary">Creado: {fmtDate(o.created_at ?? null)}</div>
                    {o.status && <div className="mt-2 inline-block rounded-md border border-border px-2 py-1 text-xs">Estado: {o.status}</div>}
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-2">
                    {/* Select para editar estado */}
                    <div className="flex items-center gap-2">
                      <select
                        value={editingStatusFor[o.id] ?? (o.status ?? 'pending')}
                        onChange={(e) => setEditingStatusFor((prev) => ({ ...prev, [o.id]: e.target.value }))}
                        className="rounded-md border border-border p-2 text-black"
                      >
                        <option value="pending">pending</option>
                        <option value="accepted">accepted</option>
                        <option value="in_transit">in_transit</option>
                        <option value="delivered">delivered</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                      <Button size="sm" onClick={() => updateOrderStatus(o.id)} disabled={processingOrderId === o.id}>
                        Guardar
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const id = o.id;
                          setExpandedOrderId((prev) => (prev === id ? null : id));
                          if (!orderDetails[id]) await fetchOrderDetails(id);
                        }}
                      >
                        {expandedOrderId === o.id ? 'Cerrar detalle' : 'Ver detalle'}
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteOrder(o.id)}
                        disabled={processingOrderId === o.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar Pedido
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Detalle del pedido */}
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
                              {it.addons.length > 0 && (
                                <div className="text-sm text-text-secondary">
                                  Add-ons: {it.addons.map((a) => a.name).join(', ')}
                                </div>
                              )}
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
    </div>
  );
}
