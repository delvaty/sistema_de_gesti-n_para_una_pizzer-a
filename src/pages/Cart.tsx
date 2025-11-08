import { useEffect, useState } from 'react';
import { useCartStore, Addon } from '../store/cartStore';
import { Button } from '../components/ui/Button';
import { Trash2, Plus, Minus, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { TablesInsert } from '../types/supabase';

// Tipo para la validación de stock
interface StockValidationItem {
  id: string;
  name: string;
  available: number;
  requested: number;
}

interface PizzaStock {
  id: string;
  stock: number;
}

export default function Cart() {
  const {
    items,
    totalPrice,
    updateQuantity,
    removeItem,
    clearCart,
    toggleAddonForItem,
  } = useCartStore();

  const total = totalPrice();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const [openAddonsFor, setOpenAddonsFor] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [stockValidation, setStockValidation] = useState<StockValidationItem[]>([]);
  const [pizzasStock, setPizzasStock] = useState<PizzaStock[]>([]);

  // Fetch addons y stock de pizzas
  useEffect(() => {
    const fetchData = async () => {
      // Fetch addons
      const { data: addonsData, error: addonsError } = await supabase.from('addons').select('*');
      if (addonsError) {
        console.error('Error fetching addons', addonsError);
      } else {
        setAvailableAddons((addonsData ?? []) as Addon[]);
      }

      // Fetch stock de pizzas en el carrito
      if (items.length > 0) {
        const pizzaIds = items.map(item => item.id);
        const { data: pizzasData, error: pizzasError } = await supabase
          .from('pizzas')
          .select('id, stock')
          .in('id', pizzaIds);

        if (pizzasError) {
          console.error('Error fetching pizzas stock:', pizzasError);
        } else if (pizzasData) {
          setPizzasStock(pizzasData.map(p => ({
            id: p.id,
            stock: typeof p.stock === 'number' ? p.stock : parseInt(String(p.stock ?? '0'), 10)
          })));
        }
      }
    };
    
    fetchData();
  }, [items]);

  // Función para obtener el stock disponible de una pizza
  const getAvailableStock = (pizzaId: string): number => {
    const pizzaStock = pizzasStock.find(p => p.id === pizzaId);
    return pizzaStock ? pizzaStock.stock : 0;
  };

  // Función para obtener la cantidad en carrito de una pizza
  const getQuantityInCart = (pizzaId: string): number => {
    return items
      .filter(item => item.id === pizzaId)
      .reduce((total, item) => total + item.quantity, 0);
  };

  // Función para verificar si se puede incrementar la cantidad
  const canIncrementQuantity = (pizzaId: string): boolean => {
    const availableStock = getAvailableStock(pizzaId);
    const totalInCart = getQuantityInCart(pizzaId);
    
    // Verificar si al incrementar superaría el stock disponible
    return (totalInCart + 1) <= availableStock;
  };

  // Función para manejar el incremento de cantidad
  const handleIncrement = (cartItemId: string, pizzaId: string, currentQuantity: number) => {
    if (canIncrementQuantity(pizzaId, )) {
      updateQuantity(cartItemId, currentQuantity + 1);
    }
  };

  // Función para verificar stock antes del checkout
  const checkStock = async (): Promise<boolean> => {
    try {
      // Obtener IDs de pizzas en el carrito
      const pizzaIds = items.map(item => item.id);
      
      if (pizzaIds.length === 0) return true;

      // Consultar stock actual de las pizzas
      const { data: pizzas, error } = await supabase
        .from('pizzas')
        .select('id, name, stock')
        .in('id', pizzaIds);

      if (error) {
        console.error('Error fetching pizzas:', error);
        throw error;
      }

      if (!pizzas) {
        console.error('No pizzas data returned');
        return false;
      }

      const validationResults: StockValidationItem[] = [];
      let hasInsufficientStock = false;

      // Verificar cada item del carrito
      for (const cartItem of items) {
        const pizza = pizzas.find(p => p.id === cartItem.id);
        if (!pizza) {
          console.warn(`Pizza not found: ${cartItem.id}`);
          continue;
        }

        // Asegurarnos de que stock es un número
        const availableStock = typeof pizza.stock === 'number' 
          ? pizza.stock 
          : parseInt(String(pizza.stock ?? '0'), 10);
        
        const requestedQuantity = cartItem.quantity;

        if (requestedQuantity > availableStock) {
          hasInsufficientStock = true;
          validationResults.push({
            id: cartItem.id,
            name: cartItem.name,
            available: availableStock,
            requested: requestedQuantity
          });
        }
      }

      setStockValidation(validationResults);
      return !hasInsufficientStock;
    } catch (err) {
      console.error('Error checking stock:', err);
      setError('Error al verificar disponibilidad de productos');
      return false;
    }
  };

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
      // 1️⃣ Verificar stock antes de proceder
      const hasEnoughStock = await checkStock();
      if (!hasEnoughStock) {
        setError('Algunos productos no tienen suficiente stock disponible');
        setLoading(false);
        return;
      }

      // 2️⃣ Crear la orden
      const orderData: TablesInsert<'orders'> = {
        user_id: user.id,
        total_price: total,
        delivery_address: deliveryAddress,
        delivery_time: new Date().toISOString(),
      };

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // 3️⃣ Insertar items del carrito y actualizar stock
      for (const item of items) {
        // Obtener stock actual
        const { data: pizza, error: pizzaError } = await supabase
          .from('pizzas')
          .select('stock')
          .eq('id', item.id)
          .single();

        if (pizzaError) throw pizzaError;

        if (!pizza) {
          throw new Error(`Pizza ${item.id} not found`);
        }

        // Asegurarnos de que stock es un número
        const currentStock = typeof pizza.stock === 'number' 
          ? pizza.stock 
          : parseInt(String(pizza.stock ?? '0'), 10);
        
        const newStock = currentStock - item.quantity;

        if (newStock < 0) {
          throw new Error(`Stock insuficiente para ${item.name}`);
        }

        // Actualizar stock en la base de datos
        const { error: updateError } = await supabase
          .from('pizzas')
          .update({ stock: newStock })
          .eq('id', item.id);

        if (updateError) throw updateError;

        // Insertar order item
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

        // 4️⃣ Insertar addons si existen
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

      // 5️⃣ Limpiar carrito y redirigir
      clearCart();
      navigate('/orders');
    } catch (err: unknown) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'No se pudo procesar el pedido. Intenta nuevamente.');
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

      {/* Mostrar errores de stock */}
      {stockValidation.length > 0 && (
        <div className="mt-4 rounded-md bg-red-50 p-4 border border-red-200">
          <h3 className="font-medium text-red-800">Problemas de stock:</h3>
          <ul className="mt-2 list-disc list-inside text-red-700">
            {stockValidation.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>: Solicitado {item.requested}, Disponible {item.available}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-red-600 text-sm">
            Por favor ajusta las cantidades antes de proceder al pago.
          </p>
        </div>
      )}

      <div className="mt-8 flow-root">
        <ul role="list" className="-my-6 divide-y divide-border">
          {items.map((item) => {
            const addonsSum = item.addons.reduce((s, a) => s + (a.price ?? 0), 0);
            const canIncrement = canIncrementQuantity(item.id);
            
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
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleIncrement(item.cartItemId, item.id, item.quantity)}
                        disabled={!canIncrement}
                        title={!canIncrement ? "No hay más cantidad disponible" : "Aumentar cantidad"}
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

                  {/* Información de stock */}
                  <div className="mt-1 text-xs text-text-secondary">
                    <span>
                      Cantidad disponible: {getAvailableStock(item.id)} unidades
                      {getQuantityInCart(item.id) > item.quantity && (
                        <span> ({getQuantityInCart(item.id) - item.quantity} en otros items)</span>
                      )}
                    </span>
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
                disabled={loading || !deliveryAddress || stockValidation.length > 0}
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