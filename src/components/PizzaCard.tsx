import { Pizza as PizzaType } from '../types/database';
import { Button } from './ui/Button';
import { Plus } from 'lucide-react';
import { useCartStore } from '../store/cartStore';

interface PizzaCardProps {
  pizza: PizzaType;
}

export default function PizzaCard({ pizza }: PizzaCardProps) {
  const addItem = useCartStore((state) => state.addItem);

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
        <h3 className="font-serif text-2xl font-bold text-text">{pizza.name}</h3>
        <p className="mt-2 flex-1 text-text-secondary">{pizza.description}</p>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-3xl font-bold text-primary">${pizza.price.toFixed(2)}</span>
          <Button size="lg" onClick={() => addItem(pizza)}>
            <Plus className="mr-2 h-5 w-5" />
            Añadir
          </Button>
        </div>
      </div>
    </div>
  );
}
