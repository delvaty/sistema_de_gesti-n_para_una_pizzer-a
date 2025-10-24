-- Habilitar la extensión pgcrypto para gen_random_uuid()
create extension if not exists "pgcrypto" with schema "extensions";

-- 1. Tabla de Perfiles de Usuario
-- Almacena datos públicos de los usuarios, incluyendo su rol.
create table public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' -- Roles: 'user', 'driver', 'admin'
);

-- 2. Tabla de Pizzas
-- Contiene todos los productos de pizza disponibles.
create table public.pizzas (
  id uuid not null primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null,
  image_url text,
  created_at timestamp with time zone not null default now()
);

-- 3. Tabla de Ingredientes Adicionales (Add-ons)
-- Ingredientes que se pueden agregar a las pizzas por un costo extra.
create table public.addons (
  id uuid not null primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null,
  created_at timestamp with time zone not null default now()
);

-- 4. Tabla de Pedidos
-- Almacena la información principal de cada pedido.
create table public.orders (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  delivery_address text not null,
  delivery_time timestamp with time zone not null,
  total_price numeric(10, 2) not null,
  status text not null default 'pending', -- pending, preparing, out_for_delivery, delivered, cancelled
  created_at timestamp with time zone not null default now()
);

-- 5. Tabla de Items del Pedido
-- Detalla qué pizzas y en qué cantidad componen cada pedido.
create table public.order_items (
  id uuid not null primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  pizza_id uuid not null references public.pizzas(id) on delete cascade,
  quantity integer not null,
  unit_price numeric(10, 2) not null -- Precio de la pizza en el momento de la compra
);

-- 6. Tabla de Add-ons por Item de Pedido
-- Registra los add-ons seleccionados para cada pizza específica en un pedido.
create table public.order_item_addons (
  id uuid not null primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete cascade
);

-- Políticas de Seguridad (Row Level Security - RLS)
-- Es crucial para proteger los datos de tus usuarios.

-- Habilitar RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.pizzas enable row level security;
alter table public.addons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_addons enable row level security;

-- Políticas para 'profiles'
create policy "Los usuarios pueden ver todos los perfiles." on public.profiles for select using (true);
create policy "Los usuarios pueden insertar su propio perfil." on public.profiles for insert with check (auth.uid() = id);
create policy "Los usuarios pueden actualizar su propio perfil." on public.profiles for update using (auth.uid() = id);

-- Políticas para 'pizzas' y 'addons'
create policy "Cualquiera puede ver las pizzas y add-ons." on public.pizzas for select using (true);
create policy "Cualquiera puede ver los add-ons." on public.addons for select using (true);
create policy "Los administradores pueden gestionar pizzas." on public.pizzas for all using ( (select role from public.profiles where id = auth.uid()) = 'admin' );
create policy "Los administradores pueden gestionar add-ons." on public.addons for all using ( (select role from public.profiles where id = auth.uid()) = 'admin' );

-- Políticas para 'orders'
create policy "Los usuarios pueden ver sus propios pedidos." on public.orders for select using (auth.uid() = user_id);
create policy "Los repartidores y administradores pueden ver todos los pedidos." on public.orders for select using ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') );
create policy "Los usuarios autenticados pueden crear pedidos." on public.orders for insert with check (auth.role() = 'authenticated');
create policy "Los repartidores y administradores pueden actualizar el estado de los pedidos." on public.orders for update using ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') ) with check ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') );

-- Políticas para 'order_items' y 'order_item_addons'
-- El acceso se deriva de la tabla 'orders'
create policy "Los usuarios pueden ver los items de sus pedidos." on public.order_items for select using (exists (select 1 from public.orders where id = order_id and user_id = auth.uid()));
create policy "Repartidores y admins pueden ver todos los items." on public.order_items for select using ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') );
create policy "Usuarios autenticados pueden crear items para sus pedidos." on public.order_items for insert with check (auth.role() = 'authenticated');

create policy "Usuarios pueden ver los add-ons de los items de sus pedidos." on public.order_item_addons for select using (exists (select 1 from public.order_items oi join public.orders o on oi.order_id = o.id where oi.id = order_item_id and o.user_id = auth.uid()));
create policy "Repartidores y admins pueden ver todos los add-ons de los items." on public.order_item_addons for select using ( (select role from public.profiles where id = auth.uid()) in ('driver', 'admin') );
create policy "Usuarios autenticados pueden crear add-ons para sus items." on public.order_item_addons for insert with check (auth.role() = 'authenticated');

-- Función para manejar la creación de perfiles automáticamente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'role');
  return new;
end;
$$;

-- Trigger que llama a la función cuando se crea un nuevo usuario
create trigger on_auth_user_created
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
('Cuatro Quesos', 'Una sinfonía de sabores con mozzarella, gorgonzola, parmesano y provolone. ¡Para los amantes del queso!', 15.50, 'https://images.pexels.com/photos/1166120/pexels-photo-1166120.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2');

-- Add-ons
insert into public.addons (name, price) values
('Extra Queso', 2.00),
('Borde Relleno de Queso', 3.50),
('Champiñones', 1.50),
('Aceitunas Negras', 1.25),
('Jalapeños', 1.75);
