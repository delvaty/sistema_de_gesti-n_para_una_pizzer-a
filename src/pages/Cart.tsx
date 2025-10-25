// // pages/Cart.tsx
// import { useEffect, useState } from 'react';
// import { useCartStore, Addon } from '../store/cartStore';
// import { Button } from '../components/ui/Button';
// import { Trash2, Plus, Minus, LoaderCircle } from 'lucide-react';
// import { Link, useNavigate } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth';
// import { supabase } from '../lib/supabaseClient';
// import { TablesInsert } from '../types/supabase';

// export default function Cart() {
//   const { items, totalPrice, updateQuantity, removeItem, clearCart, toggleAddonForItem, setAddonsForItem } = useCartStore();
//   const total = totalPrice();
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
//   const [openAddonsFor, setOpenAddonsFor] = useState<string | null>(null); // cartItemId open panel

//   useEffect(() => {
//     // fetch addons catalog
//     const fetchAddons = async () => {
//       const { data, error } = await supabase.from('addons').select('*');
//       if (error) {
//         console.error('Error fetching addons', error);
//         return;
//       }
//       setAvailableAddons((data ?? []) as Addon[]);
//     };
//     fetchAddons();
//   }, []);

//   const handleCheckout = async () => {
//     if (!user) {
//       navigate('/login');
//       return;
//     }

//     setLoading(true);
//     setError(null);

//     try {
//       // 1. Create order
//       const orderData: TablesInsert<'orders'> = {
//         user_id: user.id,
//         total_price: total,
//         delivery_address: '123 Pizza St, Flavor Town', // adapt
//       };

//       const { data: newOrder, error: orderError } = await supabase
//         .from('orders')
//         .insert(orderData)
//         .select()
//         .single();

//       if (orderError) throw orderError;

//       // 2. For each cart item, insert order_item and then its addons
//       for (const item of items) {
//         const orderItem = {
//           order_id: newOrder.id,
//           pizza_id: item.id,
//           quantity: item.quantity,
//           unit_price: item.price,
//         };

//         const { data: insertedOrderItem, error: orderItemError } = await supabase
//           .from('order_items')
//           .insert(orderItem)
//           .select()
//           .single();

//         if (orderItemError) throw orderItemError;

//         // If this item has addons, insert them into order_item_addons
//         if (item.addons && item.addons.length > 0) {
//           const addonsRows = item.addons.map((a) => ({
//             order_item_id: insertedOrderItem.id,
//             addon_id: a.id,
//           }));
//           const { error: addonsError } = await supabase.from('order_item_addons').insert(addonsRows);
//           if (addonsError) throw addonsError;
//         }
//       }

//       // 3. Clear cart & redirect
//       clearCart();
//       navigate('/orders');
//     } catch (err: any) {
//       console.error('Checkout error:', err);
//       setError('No se pudo procesar el pedido. Por favor, inténtalo de nuevo.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const toggleAddon = (cartItemId: string, addon: Addon) => {
//     toggleAddonForItem(cartItemId, addon);
//   };

//   if (items.length === 0) {
//     return (
//       <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
//         <h1 className="font-serif text-4xl font-bold">Tu Carrito está Vacío</h1>
//         <p className="mt-4 text-lg text-text-secondary">
//           Parece que aún no has añadido ninguna pizza. ¡Explora nuestro menú!
//         </p>
//         <Button asChild size="lg" className="mt-8">
//           <Link to="/">Ver Menú</Link>
//         </Button>
//       </div>
//     );
//   }

//   return (
//     <div className="container mx-auto max-w-4xl px-4 py-16">
//       <h1 className="font-serif text-4xl font-bold">Tu Carrito</h1>
//       <div className="mt-8 flow-root">
//         <ul role="list" className="-my-6 divide-y divide-border">
//           {items.map((item) => {
//             const addonsSum = item.addons.reduce((s, a) => s + (a.price ?? 0), 0);
//             return (
//               <li key={item.cartItemId} className="flex py-6">
//                 <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-border">
//                   <img
//                     src={item.image_url || ''}
//                     alt={item.name}
//                     className="h-full w-full object-cover object-center"
//                   />
//                 </div>
//                 <div className="ml-4 flex flex-1 flex-col">
//                   <div>
//                     <div className="flex justify-between text-base font-medium text-text">
//                       <h3>{item.name}</h3>
//                       <p className="ml-4">${((item.price + addonsSum) * item.quantity).toFixed(2)}</p>
//                     </div>
//                   </div>

//                   <div className="flex flex-1 items-end justify-between text-sm">
//                     <div className="flex items-center gap-2">
//                       <Button size="icon" variant="outline" onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}>
//                         <Minus className="h-4 w-4" />
//                       </Button>
//                       <span className="w-8 text-center">{item.quantity}</span>
//                       <Button size="icon" variant="outline" onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}>
//                         <Plus className="h-4 w-4" />
//                       </Button>

//                       {/* Botón para abrir panel de agregos */}
//                       <Button variant="ghost" className="ml-2" onClick={() => setOpenAddonsFor(openAddonsFor === item.cartItemId ? null : item.cartItemId)}>
//                         Agregos ({item.addons.length})
//                       </Button>
//                     </div>

//                     <div className="flex">
//                       <Button
//                         type="button"
//                         variant="ghost"
//                         className="font-medium text-primary hover:text-primary/80"
//                         onClick={() => removeItem(item.cartItemId)}
//                       >
//                         <Trash2 className="mr-1 h-4 w-4" />
//                         Eliminar
//                       </Button>
//                     </div>
//                   </div>

//                   {/* Panel de agregos */}
//                   {openAddonsFor === item.cartItemId && (
//                     <div className="mt-3 w-full rounded-md border border-border bg-muted p-3">
//                       <p className="mb-2 font-medium">Selecciona agregos</p>
//                       <div className="grid grid-cols-1 gap-2">
//                         {availableAddons.map((a) => {
//                           const checked = !!item.addons.find((it) => it.id === a.id);
//                           return (
//                             <label key={a.id} className="flex items-center gap-2">
//                               <input
//                                 type="checkbox"
//                                 checked={checked}
//                                 onChange={() => toggleAddon(item.cartItemId, a)}
//                               />
//                               <span className="flex-1">
//                                 {a.name} <span className="text-xs text-text-secondary">(+${a.price.toFixed(2)})</span>
//                               </span>
//                             </label>
//                           );
//                         })}
//                       </div>
//                       <div className="mt-2 flex justify-end">
//                         <Button size="sm" onClick={() => setOpenAddonsFor(null)}>Cerrar</Button>
//                       </div>
//                     </div>
//                   )}

//                   {/* Lista de agregos actuales */}
//                   {item.addons.length > 0 && (
//                     <div className="mt-2 text-sm text-text-secondary">
//                       <strong>Agregos:</strong>{' '}
//                       {item.addons.map((a) => a.name).join(', ')}
//                     </div>
//                   )}
//                 </div>
//               </li>
//             );
//           })}
//         </ul>
//       </div>

//       <div className="mt-12 border-t border-border pt-8">
//         <div className="flex justify-between text-lg font-bold text-text">
//           <p>Subtotal</p>
//           <p>${total.toFixed(2)}</p>
//         </div>
//         <p className="mt-1 text-sm text-text-secondary">
//           Los gastos de envío e impuestos se calcularán en el checkout.
//         </p>
//         <div className="mt-6">
//           <Button size="lg" className="w-full" onClick={handleCheckout} disabled={loading}>
//             {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
//             {loading ? 'Procesando...' : 'Proceder al Pago'}
//           </Button>
//         </div>
//         {error && <p className="mt-4 text-center text-red-500">{error}</p>}
//         <div className="mt-6 flex justify-center text-center text-sm text-text-secondary">
//           <p>
//             o{' '}
//             <Link to="/" className="font-medium text-primary hover:text-primary/80">
//               Continuar Comprando
//               <span aria-hidden="true"> &rarr;</span>
//             </Link>
//           </p>
//         </div>
//          <div className="mt-4 text-center">
//             <Button variant="link" className="text-red-500" onClick={clearCart}>
//                 Vaciar Carrito
//             </Button>
//         </div>
//       </div>
//     </div>
//   );
// }
// pages/Cart.tsx
// pages/Cart.tsx
import { useEffect, useState } from 'react';
import { useCartStore, Addon } from '../store/cartStore';
import { Button } from '../components/ui/Button';
import { Trash2, Plus, Minus, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { TablesInsert } from '../types/supabase';

export default function Cart() {
  const {
    items,
    totalPrice,
    updateQuantity,
    removeItem,
    clearCart,
    toggleAddonForItem,
    setAddonsForItem,
  } = useCartStore();

  const total = totalPrice();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const [openAddonsFor, setOpenAddonsFor] = useState<string | null>(null); // CartItemId del panel abierto
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showAddressInput, setShowAddressInput] = useState(false);

  // Fetch addons
  useEffect(() => {
    const fetchAddons = async () => {
      const { data, error } = await supabase.from('addons').select('*');
      if (error) {
        console.error('Error fetching addons', error);
        return;
      }
      setAvailableAddons((data ?? []) as Addon[]);
    };
    fetchAddons();
  }, []);

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!deliveryAddress) {
      setError('Por favor ingresa tu dirección de entrega');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1️⃣ Crear la orden
      // const orderData: TablesInsert<'orders'> = {
      //   user_id: user.id,
      //   total_price: total,
      //   delivery_address: deliveryAddress,
      // };
      const orderData: TablesInsert<'orders'> = {
        user_id: user.id,
        total_price: total,
        delivery_address: deliveryAddress,
        delivery_time: new Date().toISOString(), // <- ⚡ obligatorio
      };


      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // 2️⃣ Insertar items del carrito
      for (const item of items) {
        const orderItem = {
          order_id: newOrder.id,
          pizza_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        };

        const { data: insertedOrderItem, error: orderItemError } = await supabase
          .from('order_items')
          .insert(orderItem)
          .select()
          .single();

        if (orderItemError) throw orderItemError;

        // 3️⃣ Insertar addons si existen
        if (item.addons && item.addons.length > 0) {
          const addonsRows = item.addons.map((a) => ({
            order_item_id: insertedOrderItem.id,
            addon_id: a.id,
          }));
          const { error: addonsError } = await supabase
            .from('order_item_addons')
            .insert(addonsRows);
          if (addonsError) throw addonsError;
        }
      }

      // 4️⃣ Limpiar carrito y redirigir
      clearCart();
      navigate('/orders');
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError('No se pudo procesar el pedido. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAddon = (cartItemId: string, addon: Addon) => {
    toggleAddonForItem(cartItemId, addon);
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
          {items.map((item) => {
            const addonsSum = item.addons.reduce((s, a) => s + (a.price ?? 0), 0);
            return (
              <li key={item.cartItemId} className="flex py-6">
                <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-border">
                  <img
                    src={item.image_url || ''}
                    alt={item.name}
                    className="h-full w-full object-cover object-center"
                  />
                </div>
                <div className="ml-4 flex flex-1 flex-col">
                  <div className="flex justify-between text-base font-medium text-text">
                    <h3>{item.name}</h3>
                    <p className="ml-4">
                      ${((item.price + addonsSum) * item.quantity).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex flex-1 items-end justify-between text-sm mt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        className="ml-2"
                        onClick={() =>
                          setOpenAddonsFor(
                            openAddonsFor === item.cartItemId ? null : item.cartItemId
                          )
                        }
                      >
                        Agregos ({item.addons.length})
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="font-medium text-primary hover:text-primary/80"
                      onClick={() => removeItem(item.cartItemId)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>

                  {/* Panel de agregos */}
                  {openAddonsFor === item.cartItemId && (
                    <div className="mt-3 w-full rounded-md border border-border bg-muted p-3">
                      <p className="mb-2 font-medium">Selecciona agregos</p>
                      <div className="grid grid-cols-1 gap-2">
                        {availableAddons.map((a) => {
                          const checked = !!item.addons.find((it) => it.id === a.id);
                          return (
                            <label key={a.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleAddon(item.cartItemId, a)}
                              />
                              <span className="flex-1">
                                {a.name}{' '}
                                <span className="text-xs text-text-secondary">
                                  (+${a.price.toFixed(2)})
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" onClick={() => setOpenAddonsFor(null)}>
                          Cerrar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Lista de agregos actuales */}
                  {item.addons.length > 0 && (
                    <div className="mt-2 text-sm text-text-secondary">
                      <strong>Agregos:</strong> {item.addons.map((a) => a.name).join(', ')}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Resumen del carrito */}
      <div className="mt-12 border-t border-border pt-8">
        <div className="flex justify-between text-lg font-bold text-text">
          <p>Subtotal</p>
          <p>${total.toFixed(2)}</p>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          Los gastos de envío e impuestos se calcularán en el checkout.
        </p>

        {/* Botón de checkout */}
        <div className="mt-6">
          {!showAddressInput ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => setShowAddressInput(true)}
              disabled={loading}
            >
              Proceder al Pago
            </Button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Ingresa tu dirección"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full rounded-md border text-black border-border p-2"
              />
              <Button
                size="lg"
                className="w-full"
                onClick={handleCheckout}
                disabled={loading || !deliveryAddress}
              >
                {loading ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                  </>
                ) : (
                  'Confirmar Pedido'
                )}
              </Button>
            </div>
          )}
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
