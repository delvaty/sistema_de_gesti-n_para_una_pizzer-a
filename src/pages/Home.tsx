import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Pizza } from '../types/database';
import PizzaCard from '../components/PizzaCard';
import { LoaderCircle } from 'lucide-react';

export default function Home() {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPizzas = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('pizzas').select('*');
        if (error) throw error;
        setPizzas(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPizzas();
  }, []);

  return (
    <main className="flex-1">
      <section className="relative h-[60vh] w-full">
        <img 
          src="https://images.pexels.com/photos/3682837/pexels-photo-3682837.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
          alt="Hero Pizza" 
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-white">
          <h1 className="font-serif text-5xl font-black md:text-7xl">La Pizza Perfecta, a un Clic</h1>
          <p className="mt-4 max-w-2xl text-lg text-secondary">Ingredientes frescos, recetas auténticas y entrega rápida. Tu próxima comida favorita te está esperando.</p>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-16 sm:py-24">
        <h2 className="text-center font-serif text-4xl font-bold">Nuestro Menú</h2>
        {loading && (
          <div className="mt-12 flex justify-center">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
          </div>
        )}
        {error && <p className="mt-12 text-center text-red-500">Error: {error}</p>}
        {!loading && !error && (
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {pizzas.map((pizza) => (
              <PizzaCard key={pizza.id} pizza={pizza} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
