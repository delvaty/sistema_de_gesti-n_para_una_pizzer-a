import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { Pizza, LogOut, UserCircle, ShoppingCart, History, Truck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCartStore } from '../store/cartStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/DropdownMenu';

export default function Header() {
  const { isAuthenticated, profile, signOut, loading } = useAuth();

  // Calculamos el total directamente desde los items
  // Esto garantiza reactividad automática cuando cambia el carrito
  const totalItems = useCartStore((state) => 
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <Pizza className="h-6 w-6 text-primary" />
          <span className="hidden font-bold sm:inline-block font-serif">Bolt Pizza</span>
        </Link>

        <nav className="flex flex-1 items-center space-x-6 text-sm font-medium" />

        <div className="flex items-center justify-end space-x-2">
          {/* Si es admin, mostramos botón a la administración */}
          {profile?.role === 'admin' && (
            <Button asChild variant="outline" size="sm" className="mr-2 hidden sm:inline-flex">
              <Link to="/admin/pizzas">Admin Pizzas</Link>
            </Button>
          )}

          {/* Si es driver o admin, mostramos acceso al panel de repartidor */}
          {(profile?.role === 'driver' || profile?.role === 'admin') && (
            <Button asChild variant="outline" size="sm" className="mr-2 hidden sm:inline-flex">
              <Link to="/driver" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                <span>Driver Panel</span>
              </Link>
            </Button>
          )}

          {/* Botón del carrito con contador de artículos */}
          <Button variant="ghost" size="icon" asChild>
            <Link to="/cart" className="relative flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {totalItems}
                </span>
              )}
            </Link>
          </Button>

          <div className="h-6 w-px bg-border" />

          {/* Menú de usuario / auth */}
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-md bg-surface" />
          ) : isAuthenticated && profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-text-secondary" />
                  <span className="hidden sm:inline">{profile.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/orders" className="flex items-center text-black">
                    <History className="mr-2 h-4 w-4" />
                    <span>Mis Pedidos</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-red-500 focus:bg-red-500/10 focus:text-red-500"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Iniciar Sesión</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Registrarse</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}