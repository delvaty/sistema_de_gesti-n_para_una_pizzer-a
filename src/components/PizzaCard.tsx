import { Pizza as PizzaType } from '../types/database';
import { Button } from './ui/Button';
import { Plus } from 'lucide-react';
import { useCartStore } from '../store/cartStore';

interface PizzaCardProps {
  pizza: PizzaType;
}

export default function PizzaCard({ pizza }: PizzaCardProps) {
  const addItem = useCartStore((state) => state.addItem);

  // Asegurarnos de leer stock de forma segura (por si el tipo no lo define)
  const stockRaw = (pizza as any).stock ?? 0;
  const stock = typeof stockRaw === 'number' ? stockRaw : parseInt(String(stockRaw ?? '0'), 10);

  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 3; // umbral visual opcional

  const handleAdd = () => {
    if (isOutOfStock) return; // protección extra por si acaso
    addItem(pizza);
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
      <div className="aspect-square overflow-hidden">
        <img
          src={pizza.image_url || 'https://via.placeholder.com/400'}
          alt={pizza.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-serif text-2xl font-bold text-text">{pizza.name}</h3>

          {/* Badge de stock / agotado */}
          {isOutOfStock ? (
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">Agotado</span>
          ) : (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isLowStock ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }`}
              title={`${stock} disponibles`}
            >
              Stock: {stock}
            </span>
          )}
        </div>

        <p className="mt-2 flex-1 text-text-secondary">{pizza.description}</p>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-3xl font-bold text-primary">${pizza.price.toFixed(2)}</span>

          <Button
            size="lg"
            onClick={handleAdd}
            disabled={isOutOfStock}
            aria-disabled={isOutOfStock}
            title={isOutOfStock ? 'Sin stock disponible' : 'Añadir al carrito'}
          >
            <Plus className="mr-2 h-5 w-5" />
            {isOutOfStock ? 'Agotado' : 'Añadir'}
          </Button>
        </div>
      </div>
    </div>
  );
}
