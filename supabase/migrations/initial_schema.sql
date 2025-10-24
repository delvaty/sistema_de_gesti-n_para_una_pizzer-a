/*
  # Migración Inicial de la Base de Datos (Corregida)

  Esta migración establece el esquema completo para la aplicación de pizzería.

  ## Cambios v2:
  - **Corrección**: Se añadió una restricción `UNIQUE` a la columna `name` en las tablas `pizzas` y `addons` para permitir el uso de `ON CONFLICT`.
  - **Idempotencia**: Se mejoró el script para que sea completamente re-ejecutable usando `DROP POLICY IF EXISTS`.

  ## Tablas Creadas:
  1.  **profiles**: Almacena datos públicos de usuarios y su rol ('user', 'driver', 'admin').
  2.  **pizzas**: Catálogo de pizzas disponibles para la venta.
  3.  **addons**: Ingredientes adicionales que se pueden añadir a las pizzas.
  4.  **orders**: Registra la información principal de cada pedido.
  5.  **order_items**: Detalla las pizzas incluidas en cada pedido.
  6.  **order_item_addons**: Especifica los addons para cada pizza en un pedido.

  ## Seguridad:
  - Se habilita Row Level Security (RLS) en todas las tablas.
  - Se definen políticas de acceso detalladas para cada rol.

  ## Automatización:
  - Un trigger (`on_auth_user_created`) crea automáticamente un perfil de usuario cuando un nuevo usuario se registra en Supabase Auth.

  ## Datos de Ejemplo:
  - Se insertan 6 pizzas y 5 addons para poblar la base de datos inicialmente.
*/

-- Habilitar la extensión pgcrypto si no existe, necesaria para gen_random_uuid()
create extension if not exists "pgcrypto" with schema "extensions";

-- 1. Tabla de Perfiles de Usuario
create table if not exists public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' -- Roles: 'user', 'driver', 'admin'
);
comment on table public.profiles is 'Almacena datos públicos de los usuarios, incluyendo su rol.';

-- 2. Tabla de Pizzas (CORREGIDA)
create table if not exists public.pizzas (
  id uuid not null primary key default extensions.gen_random_uuid(),
  name text not null unique, -- Se añadió la restricción UNIQUE
  description text,
  price numeric(10, 2) not null,
  image_url text,
  created_at timestamp with time zone not null default now()
);
comment on table public.pizzas is 'Contiene todos los productos de pizza disponibles.';

-- 3. Tabla de Ingredientes Adicionales (Add-ons) (CORREGIDA)
create table if not exists public.addons (
  id uuid not null primary key default extensions.gen_random_uuid(),
  name text not null unique, -- Se añadió la restricción UNIQUE
  price numeric(10, 2) not null,
  created_at timestamp with time zone not null default now()
);
comment on table public.addons is 'Ingredientes que se pueden agregar a las pizzas por un costo extra.';

-- 4. Tabla de Pedidos
create table if not exists public.orders (
  id uuid not null primary key default extensions.gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  delivery_address text not null,
  delivery_time timestamp with time zone,
  total_price numeric(10, 2) not null,
  status text not null default 'pending', -- pending, preparing, out_for_delivery, delivered, cancelled
  created_at timestamp with time zone not null default now()
);
comment on table public.orders is 'Almacena la información principal de cada pedido.';

-- 5. Tabla de Items del Pedido
create table if not exists public.order_items (
  id uuid not null primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  pizza_id uuid not null references public.pizzas(id) on delete cascade,
  quantity integer not null,
  unit_price numeric(10, 2) not null -- Precio de la pizza en el momento de la compra
);
comment on table public.order_items is 'Detalla qué pizzas y en qué cantidad componen cada pedido.';

-- 6. Tabla de Add-ons por Item de Pedido
create table if not exists public.order_item_addons (
  id uuid not null primary key default extensions.gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete cascade
);
comment on table public.order_item_addons is 'Registra los add-ons seleccionados para cada pizza específica en un pedido.';

-- Políticas de Seguridad (Row Level Security - RLS)

-- Habilitar RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.pizzas enable row level security;
alter table public.addons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_addons enable row level security;

-- Políticas para 'profiles'
drop policy if exists "Users can view all profiles." on public.profiles;
create policy "Users can view all profiles." on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile." on public.profiles;
create policy "Users can update their own profile." on public.profiles for update using (auth.uid() = id);

-- Políticas para 'pizzas' y 'addons'
drop policy if exists "Anyone can view pizzas and add-ons." on public.pizzas;
create policy "Anyone can view pizzas and add-ons." on public.pizzas for select using (true);

drop policy if exists "Anyone can view add-ons." on public.addons;
create policy "Anyone can view add-ons." on public.addons for select using (true);

drop policy if exists "Admins can manage pizzas." on public.pizzas;
create policy "Admins can manage pizzas." on public.pizzas for all using ( (select role from public.profiles where id = auth.uid()) = 'admin' );

drop policy if exists "Admins can manage add-ons." on public.addons;
create policy "Admins can manage add-ons." on public.addons for all using ( (select role from public.profiles where id = auth.uid()) = 'admin' );

-- Políticas para 'orders'
drop policy if exists "Users can view their own orders." on public.orders;
create policy "Users can view their own orders." on public.orders for select using (auth.uid() = user_id);

drop policy if exists "Drivers and admins can view all orders." on public.orders;
create policy "Drivers and admins can view all orders." on public.orders for select using ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') );

drop policy if exists "Authenticated users can create orders." on public.orders;
create policy "Authenticated users can create orders." on public.orders for insert with check (auth.role() = 'authenticated');

drop policy if exists "Drivers and admins can update order status." on public.orders;
create policy "Drivers and admins can update order status." on public.orders for update using ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') ) with check ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') );

-- Políticas para 'order_items' y 'order_item_addons'
drop policy if exists "Users can view items from their own orders." on public.order_items;
create policy "Users can view items from their own orders." on public.order_items for select using (exists (select 1 from public.orders where id = order_id and user_id = auth.uid()));

drop policy if exists "Drivers and admins can view all items." on public.order_items;
create policy "Drivers and admins can view all items." on public.order_items for select using ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') );

drop policy if exists "Authenticated users can create items for their orders." on public.order_items;
create policy "Authenticated users can create items for their orders." on public.order_items for insert with check (auth.role() = 'authenticated');

drop policy if exists "Users can view add-ons from their order items." on public.order_item_addons;
create policy "Users can view add-ons from their order items." on public.order_item_addons for select using (exists (select 1 from public.order_items oi join public.orders o on oi.order_id = o.id where oi.id = order_item_id and o.user_id = auth.uid()));

drop policy if exists "Drivers and admins can view all item add-ons." on public.order_item_addons;
create policy "Drivers and admins can view all item add-ons." on public.order_item_addons for select using ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') );

drop policy if exists "Authenticated users can create add-ons for their items." on public.order_item_addons;
create policy "Authenticated users can create add-ons for their items." on public.order_item_addons for insert with check (auth.role() = 'authenticated');

-- Función para manejar la creación de perfiles automáticamente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'user'));
  return new;
end;
$$;

-- Trigger que llama a la función cuando se crea un nuevo usuario
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insertar datos de ejemplo
-- Pizzas
insert into public.pizzas (name, description, price, image_url) values
('Margherita Clásica', 'Salsa de tomate San Marzano, mozzarella fresca, albahaca y un chorrito de aceite de oliva virgen extra.', 12.50, 'https://images.pexels.com/photos/1566837/pexels-photo-1566837.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'),
('Pepperoni Picante', 'Generosas rodajas de pepperoni picante sobre una base de mozzarella derretida y nuestra salsa de tomate casera.', 14.00, 'https://images.pexels.com/photos/708587/pexels-photo-708587.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'),
('Hawaiana Tropical', 'Una combinación controversial pero deliciosa de jamón dulce, piña jugosa y queso mozzarella.', 13.75, 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'),
('Vegetariana del Huerto', 'Pimientos frescos, cebolla roja, champiñones, aceitunas negras y tomates cherry sobre una base de pesto y mozzarella.', 15.00, 'https://images.pexels.com/photos/2147491/pexels-photo-2147491.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'),
('BBQ Chicken Supreme', 'Trozos de pollo a la parrilla, cebolla morada, cilantro fresco y una intensa salsa barbacoa con base de mozzarella.', 16.50, 'https://images.pexels.com/photos/845811/pexels-photo-845811.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'),
('Cuatro Quesos', 'Una sinfonía de sabores con mozzarella, gorgonzola, parmesano y provolone. ¡Para los amantes del queso!', 15.50, 'https://images.pexels.com/photos/1166120/pexels-photo-1166120.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')
on conflict (name) do nothing;

-- Add-ons
insert into public.addons (name, price) values
('Extra Queso', 2.00),
('Borde Relleno de Queso', 3.50),
('Champiñones', 1.50),
('Aceitunas Negras', 1.25),
('Jalapeños', 1.75)
on conflict (name) do nothing;
