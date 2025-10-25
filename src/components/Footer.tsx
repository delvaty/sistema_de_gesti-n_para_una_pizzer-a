// components/Footer.tsx
import React, { useState } from 'react';
import { Facebook, Instagram, Twitter, Mail } from 'lucide-react';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setStatus('error');
      return;
    }
    // Placeholder: aquí conectarías con tu API o servicio (Mailchimp, Supabase function, etc.)
    setStatus('sending');
    setTimeout(() => {
      setStatus('ok');
      setEmail('');
    }, 700); // simulación UX
  };

  return (
    <footer className="border-t border-border/40 bg-surface text-sm text-text-secondary">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Branding */}
          <div>
            <h3 className="text-lg font-serif font-bold text-text">Bolt Pizza</h3>
            <p className="mt-3 text-sm">
              Pizzas artesanales preparadas al momento. Ingredientes frescos, entregas puntuales y
              amor por la cocina italiana.
            </p>

            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="rounded-md p-2 hover:bg-primary/10"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="rounded-md p-2 hover:bg-primary/10"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="rounded-md p-2 hover:bg-primary/10"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Navegación */}
          <nav aria-label="Mapa del sitio" className="flex flex-col gap-2">
            <span className="mb-2 block font-medium text-text">Enlaces rápidos</span>
            <a href="/" className="hover:text-text hover:underline">Inicio</a>
            <a href="/menu" className="hover:text-text hover:underline">Menú</a>
            <a href="/orders" className="hover:text-text hover:underline">Pedidos</a>
            <a href="/admin" className="hover:text-text hover:underline">Panel Admin</a>
            <a href="/faq" className="hover:text-text hover:underline">FAQ</a>
          </nav>

          {/* Contacto */}
          <div>
            <span className="mb-2 block font-medium text-text">Contacto</span>
            <p>📍 Calle Falsa 123, Ciudad</p>
            <p className="mt-1">📞 <a href="tel:+34123456789" className="hover:underline">+34 123 456 789</a></p>
            <p className="mt-1">✉️ <a href="mailto:info@pizza.com" className="hover:underline">info@pizza.com</a></p>

            <div className="mt-4 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="text-xs text-text-secondary">Horario: Lun-Dom 11:00 — 23:00</span>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <span className="mb-2 block font-medium text-text">Suscríbete a nuestras ofertas</span>
            <form onSubmit={handleSubscribe} className="flex flex-col gap-3">
              <label htmlFor="footer-newsletter" className="sr-only">Correo electrónico</label>
              <div className="flex gap-2">
                <input
                  id="footer-newsletter"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
                  placeholder="tu@correo.com"
                  className="flex-1 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-primary/40"
                  aria-invalid={status === 'error'}
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-60"
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? 'Enviando…' : 'Enviar'}
                </button>
              </div>

              <div className="min-h-[1.25rem]">
                {status === 'ok' && <p className="text-xs text-green-600">¡Gracias! Te avisaremos de ofertas.</p>}
                {status === 'error' && <p className="text-xs text-red-600">Introduce un correo válido.</p>}
              </div>

              <p className="mt-2 text-xs text-text-secondary">
                Al suscribirte aceptas recibir correos con promociones. Puedes darte de baja en cualquier momento.
              </p>
            </form>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 border-t border-border/40 pt-6 text-xs text-text-secondary">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p>© {new Date().getFullYear()} Pizza — Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              <a href="/terms" className="hover:underline">Términos</a>
              <a href="/privacy" className="hover:underline">Privacidad</a>
              <a href="/contact" className="hover:underline">Contacto</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
