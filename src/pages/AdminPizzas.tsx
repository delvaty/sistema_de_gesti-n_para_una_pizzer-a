import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { LoaderCircle, Edit, Trash2, Plus } from "lucide-react";
import type { Database } from "../types/supabase";

type PizzaRow = Database["public"]["Tables"]["pizzas"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
/* type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type OrderItemAddonRow = Database['public']['Tables']['order_item_addons']['Row'];
type AddonRow = Database['public']['Tables']['addons']['Row']; */

/** Local type que extiende PizzaRow para incluir stock, image_path (opcional) e image_url (opcional) */
type PizzaWithStock = PizzaRow & {
  stock: number;
  image_path?: string | null;
  image_url?: string | null;
};

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
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  // --- flags sobre columnas/storage ---
  const [hasImagePathCol, setHasImagePathCol] = useState<boolean | null>(null);

  // --- PIZZAS ---
  const [pizzas, setPizzas] = useState<PizzaWithStock[]>([]);
  const [loadingPizzas, setLoadingPizzas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PizzaWithStock | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.00");
  const [imageUrl, setImageUrl] = useState(""); // campo opcional para URL externa/manual
  const [imageFile, setImageFile] = useState<File | null>(null); // archivo elegido por el admin
  const [imagePreview, setImagePreview] = useState<string | null>(null); // preview local
  const [stock, setStock] = useState("0"); // nuevo estado para stock como string para input
  const [uploading, setUploading] = useState(false);

  // --- PEDIDOS ---
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderDetails, setOrderDetails] = useState<
    Record<string, OrderItemDetail[]>
  >({});
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [editingStatusFor, setEditingStatusFor] = useState<
    Record<string, string>
  >({}); // estado seleccionado temporalmente
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(
    null
  );

  // Detectar si la tabla pizzas ya tiene columna image_path (para decidir estrategia)
  const checkHasImagePathCol = async () => {
    try {
      // Intentamos seleccionar la columna image_path; si no existe, supabase devolverá error
      const { error } = await supabase
        .from("pizzas")
        .select("image_path")
        .limit(1);
      if (error) {
        // si hay error, asumimos que la columna no existe
        setHasImagePathCol(false);
      } else {
        setHasImagePathCol(true);
      }
    } catch {
      setHasImagePathCol(false);
    }
  };

  // --- Helper: upload a Supabase Storage (bucket 'pizzas') y devolver path + publicUrl ---
  const uploadImageToStorage = async (pizzaId: string, file: File) => {
    const safeName = file.name.replace(/\s+/g, "_");
    const filePath = `pizzas/${pizzaId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("pizzas")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage
      .from("pizzas")
      .getPublicUrl(filePath);
    return { path: filePath, publicUrl: urlData?.publicUrl ?? null };
  };

  // --- FETCH PIZZAS ---
  const fetchPizzas = async () => {
    setLoadingPizzas(true);
    setError(null);
    try {
      // pedimos image_path si existe (checkHasImagePathCol lo habrá calculado)
      const selectCols = hasImagePathCol
        ? "id,name,description,price,image_path,stock,created_at"
        : "id,name,description,price,image_url,stock,created_at";
      const { data, error } = await supabase
        .from("pizzas")
        .select(selectCols)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as any[];

      // si tenemos image_path, convertimos cada path a publicUrl para mostrar
      const mapped = await Promise.all(
        rows.map(async (r: any) => {
          let publicUrl: string | null = null;
          if (hasImagePathCol && r.image_path) {
            const { data: urlData } = supabase.storage
              .from("pizzas")
              .getPublicUrl(r.image_path);
            publicUrl = urlData?.publicUrl ?? null;
          } else {
            // fallback: si la fila ya tiene image_url (esquema antiguo)
            publicUrl = r.image_url ?? null;
          }

          return {
            id: r.id,
            name: r.name,
            description: r.description ?? null,
            price:
              typeof r.price === "number" ? r.price : parseFloat(r.price ?? 0),
            image_path: r.image_path ?? null,
            image_url: publicUrl,
            stock:
              typeof r.stock === "number"
                ? r.stock
                : parseInt(r.stock ?? "0", 10),
            created_at: r.created_at ?? undefined,
          } as PizzaWithStock;
        })
      );

      setPizzas(mapped);
    } catch (err: any) {
      console.error("Error fetching pizzas", err);
      setError(err.message ?? "No se pudieron cargar las pizzas.");
    } finally {
      setLoadingPizzas(false);
    }
  };

  // --- FETCH PEDIDOS ---
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,user_id,total_price,delivery_address,delivery_time,status,created_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders((data ?? []) as OrderRow[]);
      // inicializar editingStatusFor con estado actual
      const map: Record<string, string> = {};
      (data ?? []).forEach((o: any) => {
        map[o.id] = o.status ?? "pending";
      });
      setEditingStatusFor(map);
    } catch (err: any) {
      console.error("Error fetching orders", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Inicialización: comprobar columna image_path y cargar datos
  useEffect(() => {
    if (!loading && profile?.role !== "admin") return;
    (async () => {
      await checkHasImagePathCol();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, loading]);

  // cuando sepamos si existe image_path, fetch Pizzas & Orders
  useEffect(() => {
    if (hasImagePathCol === null) return;
    fetchPizzas();
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasImagePathCol]);

  const prepareCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("0.00");
    setImageUrl("");
    setImageFile(null);
    setImagePreview(null);
    setStock("0");
  };

  const prepareEdit = (p: PizzaWithStock) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description ?? "");
    setPrice((p.price ?? 0).toFixed(2));
    setImageUrl(p.image_url ?? ""); // dejamos la URL actual como campo editable (opcional)
    setImageFile(null);
    setImagePreview(p.image_url ?? null);
    setStock(String(p.stock ?? 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- SAVE (create / update) ---
  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const parsedPrice = parseFloat(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Introduce un precio válido.");
      return;
    }
    const parsedStock = parseInt(stock ?? "0", 10);
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      setError("Introduce un stock válido (entero >= 0).");
      return;
    }
    setError(null);

    try {
      setUploading(true);

      if (editing) {
        // UPDATE
        const updatePayload: any = {
          name: name.trim(),
          description: description.trim(),
          price: parsedPrice,
          stock: parsedStock,
        };

        // si el admin puso manualmente imageUrl (y no subió archivo), guardamos image_url (compatibilidad)
        if (!imageFile && imageUrl && imageUrl.trim()) {
          updatePayload.image_url = imageUrl.trim();
          // opcional: si tienes image_path col y quieres que quede a null al usar url externa:
          if (hasImagePathCol) updatePayload.image_path = null;
        }

        // si subieron un archivo, primero subir al storage
        if (imageFile) {
          const uploadRes = await uploadImageToStorage(editing.id, imageFile);
          if (hasImagePathCol) {
            updatePayload.image_path = uploadRes.path;
            // no es necesario guardar image_url en DB si usas image_path; igual guardamos para compatibilidad si quieres:
            updatePayload.image_url = uploadRes.publicUrl;
          } else {
            // tabla no tiene image_path -> guardamos la publicUrl directamente (compatibilidad)
            updatePayload.image_url = uploadRes.publicUrl;
          }
        }

        const { data, error } = await supabase
          .from("pizzas")
          .update(updatePayload)
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw error;
        const updated = data as unknown as PizzaWithStock;

        // normalizar image_url para la UI (si se guarda image_path, obtener publicUrl)
        let publicUrl = updated.image_url ?? null;
        if (hasImagePathCol && updated.image_path) {
          const { data: urlData } = supabase.storage
            .from("pizzas")
            .getPublicUrl(updated.image_path);
          publicUrl = urlData?.publicUrl ?? publicUrl;
        }

        const mapping: PizzaWithStock = {
          ...updated,
          price:
            typeof updated.price === "number"
              ? updated.price
              : parseFloat(updated.price ?? 0),
          stock:
            typeof updated.stock === "number"
              ? updated.stock
              : parseInt(updated.stock ?? "0", 10),
          image_url: publicUrl ?? null,
        };

        setPizzas((prev) =>
          prev.map((p) => (p.id === mapping.id ? mapping : p))
        );
        setEditing(null);
      } else {
        // CREATE: primero insertamos sin imagen (para obtener id), luego subimos y actualizamos si imagen presente
        const insertPayload: any = {
          name: name.trim(),
          description: description.trim(),
          price: parsedPrice,
          stock: parsedStock,
        };

        // si no existe image_path col y el admin puso una URL externa, la guardamos ya en la inserción
        if (!hasImagePathCol && imageUrl && imageUrl.trim()) {
          insertPayload.image_url = imageUrl.trim();
        }

        const { data: createdData, error: insertError } = await supabase
          .from("pizzas")
          .insert(insertPayload)
          .select()
          .single();
        if (insertError) throw insertError;
        let created = createdData as unknown as PizzaWithStock;

        // si se subió un archivo, subirlo ahora (usando el id creado) y actualizar la fila
        if (imageFile) {
          const uploadRes = await uploadImageToStorage(created.id, imageFile);
          if (hasImagePathCol) {
            const { data: updatedData, error: updateError } = await supabase
              .from("pizzas")
              .update({
                image_path: uploadRes.path,
                image_url: uploadRes.publicUrl,
              })
              .eq("id", created.id)
              .select()
              .single();
            if (updateError) throw updateError;
            created = updatedData as unknown as PizzaWithStock;
            created.image_url = uploadRes.publicUrl;
            created.image_path = uploadRes.path;
          } else {
            // tabla no tiene image_path -> guardamos la publicUrl en image_url
            const { data: updatedData, error: updateError } = await supabase
              .from("pizzas")
              .update({ image_url: uploadRes.publicUrl })
              .eq("id", created.id)
              .select()
              .single();
            if (updateError) throw updateError;
            created = updatedData as unknown as PizzaWithStock;
            created.image_url = uploadRes.publicUrl;
          }
        }

        // preparar objeto para UI
        const mapped: PizzaWithStock = {
          ...created,
          price:
            typeof created.price === "number"
              ? created.price
              : parseFloat(created.price ?? 0),
          stock:
            typeof created.stock === "number"
              ? created.stock
              : parseInt(created.stock ?? "0", 10),
          image_url: created.image_url ?? null,
          image_path: (created as any).image_path ?? null,
        };

        setPizzas((prev) => [mapped, ...prev]);
        prepareCreate();
      }
    } catch (err: any) {
      console.error("Save pizza error", err);
      setError(err.message || "No se pudo guardar la pizza.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta pizza?")) return;
    try {
      const { error } = await supabase.from("pizzas").delete().eq("id", id);
      if (error) throw error;
      setPizzas((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      console.error("Delete pizza error", err);
      setError("No se pudo borrar la pizza.");
    }
  };

  // --- PEDIDOS: helpers para detalle, actualizar estado y borrar pedido ---
  const fetchOrderDetails = async (orderId: string) => {
    if (orderDetails[orderId]) return; // cache
    try {
      const { data, error } = await supabase
        .from("order_items")
        .select(
          `id, quantity, unit_price, pizzas ( id, name, image_url ), order_item_addons ( id, addons ( id, name, price ) )`
        )
        .eq("order_id", orderId);
      if (error) throw error;

      const parsed: OrderItemDetail[] = (data ?? []).map((it: any) => ({
        id: it.id,
        pizza: it.pizzas
          ? {
              id: it.pizzas.id,
              name: it.pizzas.name,
              image_url: it.pizzas.image_url,
            }
          : null,
        quantity: it.quantity,
        unit_price:
          typeof it.unit_price === "number"
            ? it.unit_price
            : parseFloat(it.unit_price ?? 0),
        addons: (it.order_item_addons ?? [])
          .map((oia: any) =>
            oia.addons
              ? {
                  id: oia.addons.id,
                  name: oia.addons.name,
                  price: oia.addons.price,
                }
              : null
          )
          .filter(Boolean) as { id: string; name: string; price: number }[],
      }));

      setOrderDetails((prev) => ({ ...prev, [orderId]: parsed }));
    } catch (err: any) {
      console.error("fetchOrderDetails error", err);
      setError("No se pudieron cargar los items del pedido.");
    }
  };

  /**
   * Actualiza el estado del pedido.
   * - Si el nuevo estado es 'completed' llama a la RPC complete_order (descuenta stock).
   * - Si el pedido estaba en 'completed' y se cambia a otro estado, se intenta restockear con restock_order.
   * - En otros casos se hace una update normal.
   */
  const updateOrderStatus = async (orderId: string) => {
    const newStatus = editingStatusFor[orderId];
    if (!newStatus) return;
    setProcessingOrderId(orderId);
    setError(null);

    // obtener estado previo desde el state orders
    const prev = orders.find((o) => o.id === orderId);
    const prevStatus = prev?.status ?? null;

    try {
      if (newStatus === "completed") {
        const { data, error } = await supabase.rpc("complete_order" as any, {
          p_order_id: orderId,
        });
        if (error) {
          console.error("complete_order rpc error", error);
          if (
            error.message?.toLowerCase().includes("stock insuficiente") ||
            error.message?.toLowerCase().includes("insuficiente")
          ) {
            setError(
              "Stock insuficiente para completar el pedido. Revisa inventario."
            );
            setEditingStatusFor((prevMap) => ({
              ...prevMap,
              [orderId]: prevStatus ?? "pending",
            }));
            return;
          }
          throw error;
        }
        setOrders((prevOrders) =>
          prevOrders.map((o) =>
            o.id === orderId ? { ...o, status: "completed" } : o
          )
        );
        setEditingStatusFor((prevMap) => ({
          ...prevMap,
          [orderId]: "completed",
        }));
      } else if (prevStatus === "completed" && newStatus !== "completed") {
        const { data, error } = await supabase.rpc("restock_order" as any, {
          p_order_id: orderId,
        });
        if (error) {
          console.error("restock_order rpc error", error);
          setError(error.message || "No se pudo restockear el pedido.");
          setEditingStatusFor((prevMap) => ({
            ...prevMap,
            [orderId]: prevStatus ?? "completed",
          }));
          return;
        }
        setOrders((prevOrders) =>
          prevOrders.map((o) =>
            o.id === orderId ? { ...o, status: "cancelled" } : o
          )
        );
        setEditingStatusFor((prevMap) => ({
          ...prevMap,
          [orderId]: "cancelled",
        }));
      } else {
        const { error } = await supabase
          .from("orders")
          .update({ status: newStatus })
          .eq("id", orderId);
        if (error) throw error;
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (err: any) {
      console.error("updateOrderStatus error", err);
      setError(err?.message || "No se pudo actualizar el estado del pedido.");
      setEditingStatusFor((prevMap) => ({
        ...prevMap,
        [orderId]: prevStatus ?? "pending",
      }));
    } finally {
      setProcessingOrderId(null);
    }
  };

  const deleteOrder = async (orderId: string) => {
    const ok = window.confirm(
      "¿Eliminar este pedido? Esta acción eliminará también sus items."
    );
    if (!ok) return;
    setProcessingOrderId(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);
      if (error) throw error;
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setOrderDetails((prev) => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    } catch (err: any) {
      console.error("deleteOrder error", err);
      setError("No se pudo eliminar el pedido.");
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Formatea fecha segura (puede ser null)
  const fmtDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  // file input change handler (muestra preview)
  const handleFileChange = (f?: File | null) => {
    if (!f) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setImageFile(f);
    const url = URL.createObjectURL(f);
    setImagePreview(url);
  };

  // Si la UI está lista y el user no es admin
  if (!loading && profile?.role !== "admin") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Acceso no autorizado</h1>
        <p className="mt-2 text-text-secondary">
          Necesitas ser administrador para acceder a esta página.
        </p>
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
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Precio</label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Disponible</label>
              <Input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                min={0}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                URL de imagen (opcional)
              </label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-text-secondary mt-1">
                También puedes subir un archivo en el selector de abajo. Si
                subes un archivo, ese tendrá prioridad.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Subir imagen (archivo)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleFileChange(e.target.files ? e.target.files[0] : undefined)
              }
            />
            {imagePreview && (
              <div className="mt-2">
                <div className="text-xs text-text-secondary">Preview:</div>
                <img
                  src={imagePreview}
                  alt="preview"
                  className="mt-1 h-32 w-32 rounded-md object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={uploading}>
              {uploading
                ? "Guardando..."
                : editing
                ? "Actualizar Pizza"
                : "Crear Pizza"}
            </Button>
            {editing && (
              <Button variant="outline" onClick={prepareCreate}>
                Cancelar
              </Button>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </form>
        <div className="mt-3 text-xs text-text-secondary">
          <strong>Nota:</strong> las imágenes se guardan en el bucket público{" "}
          <code>pizzas</code>. Si tu tabla tiene la columna{" "}
          <code>image_path</code>, se guardará la ruta en storage (recomendado).
          Si no existe esa columna, el sistema guarda la URL pública en{" "}
          <code>image_url</code> para mantener compatibilidad.
        </div>
      </div>

      {/* --- Listado de pizzas --- */}
      <div className="rounded-lg border border-border bg-surface p-6 mb-8">
        <h2 className="mb-4 text-lg font-medium">
          Listado de pizzas ({pizzas.length})
        </h2>
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
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div className="flex items-center gap-4">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-sm">
                      No Img
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-text-secondary">
                      {p.description}
                    </div>
                    <div className="text-sm text-text-secondary">
                      Stock: {String(p.stock ?? 0)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold">
                    ${(p.price ?? 0).toFixed(2)}
                  </div>
                  <Button variant="ghost" onClick={() => prepareEdit(p)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
                    <div className="text-sm text-text-secondary">
                      Usuario: {o.user_id ?? "Anon"}
                    </div>
                    <div className="text-sm text-text-secondary">
                      Dirección: {o.delivery_address}
                    </div>
                    <div className="text-sm text-text-secondary">
                      Horario: {fmtDate(o.delivery_time ?? null)}
                    </div>
                    <div className="text-sm text-text-secondary">
                      Total: ${Number(o.total_price ?? 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-text-secondary">
                      Creado: {fmtDate(o.created_at ?? null)}
                    </div>
                    {o.status && (
                      <div className="mt-2 inline-block rounded-md border border-border px-2 py-1 text-xs">
                        Estado: {o.status}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-2">
                    {/* Select para editar estado */}
                    <div className="flex items-center gap-2">
                      <select
                        value={editingStatusFor[o.id] ?? o.status ?? "pending"}
                        onChange={(e) =>
                          setEditingStatusFor((prev) => ({
                            ...prev,
                            [o.id]: e.target.value,
                          }))
                        }
                        className="rounded-md border border-border p-2 text-black"
                      >
                        <option value="pending">pendiente</option>
                        <option value="accepted">aceptado</option>
                        <option value="in_transit">en tránsito</option>
                        <option value="delivered">entregado</option>
                        <option value="completed">completado</option>
                        <option value="cancelled">cancelado</option>
                      </select>
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(o.id)}
                        disabled={processingOrderId === o.id}
                      >
                        {processingOrderId === o.id
                          ? "Procesando..."
                          : "Guardar"}
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const id = o.id;
                          setExpandedOrderId((prev) =>
                            prev === id ? null : id
                          );
                          if (!orderDetails[id]) await fetchOrderDetails(id);
                        }}
                      >
                        {expandedOrderId === o.id
                          ? "Cerrar detalle"
                          : "Ver detalle"}
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
                              <div className="font-medium">
                                {it.pizza?.name ?? "Pizza"}
                              </div>
                              <div className="text-sm text-text-secondary">
                                Cantidad: {it.quantity}
                              </div>
                              {it.addons.length > 0 && (
                                <div className="text-sm text-text-secondary">
                                  Add-ons:{" "}
                                  {it.addons.map((a) => a.name).join(", ")}
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-semibold">
                              ${((it.unit_price ?? 0) * it.quantity).toFixed(2)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-text-secondary">
                        Cargando items...
                      </div>
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
