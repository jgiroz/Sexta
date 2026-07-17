-- ============================================================
-- Esquema de base de datos - Sistema de Gestión Cuartel de Bomberos
-- Etapa 1: Levantamiento de problemas
-- Motor: PostgreSQL (Supabase)
-- ============================================================

-- Extensión para UUID
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
create type rol_usuario as enum ('admin', 'usuario');
create type tipo_personal as enum ('voluntario', 'cuartelero', 'oficial');
create type categoria_levantamiento as enum ('infraestructura', 'carro', 'material_menor', 'material_motorizado', 'epp', 'otro');
create type subcategoria_carro as enum ('material_menor', 'material_motorizado');
create type estado_levantamiento as enum ('pendiente', 'asignado', 'en_progreso', 'resuelto', 'cerrado');
create type prioridad_levantamiento as enum ('baja', 'media', 'alta', 'urgente');

-- ------------------------------------------------------------
-- PROFILES (extiende auth.users de Supabase)
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol rol_usuario not null default 'usuario',
  tipo tipo_personal not null default 'voluntario',
  telefono text,
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CUARTEL (registro único por ahora, pensado para multi-cuartel a futuro)
-- ------------------------------------------------------------
create table cuarteles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  creado_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CARROS BOMBA
-- ------------------------------------------------------------
create table carros (
  id uuid primary key default gen_random_uuid(),
  cuartel_id uuid references cuarteles(id) on delete set null,
  codigo text not null,          -- B6, RX6, R6, M6...
  nombre text,                    -- ej "Bomba 6"
  patente text,
  tipo text,                      -- bomba, rescate, multipropósito, etc.
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- LEVANTAMIENTOS (núcleo de la etapa 1)
-- ------------------------------------------------------------
create table levantamientos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text not null,
  categoria categoria_levantamiento not null default 'otro',
  subcategoria subcategoria_carro,
  carro_id uuid references carros(id) on delete set null,
  ubicacion text,
  foto_url text,
  estado estado_levantamiento not null default 'pendiente',
  prioridad prioridad_levantamiento not null default 'media',
  reportado_por uuid not null references profiles(id),
  asignado_a uuid references profiles(id),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- HISTORIAL DE ESTADOS (trazabilidad)
-- ------------------------------------------------------------
create table historial_estados (
  id uuid primary key default gen_random_uuid(),
  levantamiento_id uuid not null references levantamientos(id) on delete cascade,
  estado_anterior estado_levantamiento,
  estado_nuevo estado_levantamiento not null,
  cambiado_por uuid not null references profiles(id),
  nota text,
  creado_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- FACTURAS / BOLETAS
-- ------------------------------------------------------------
create table facturas (
  id uuid primary key default gen_random_uuid(),
  levantamiento_id uuid not null references levantamientos(id) on delete cascade,
  proveedor text,
  numero_documento text,
  monto numeric(12,2),
  archivo_url text,
  subido_por uuid not null references profiles(id),
  creado_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- COMENTARIOS (seguimiento simple dentro de un levantamiento)
-- ------------------------------------------------------------
create table comentarios (
  id uuid primary key default gen_random_uuid(),
  levantamiento_id uuid not null references levantamientos(id) on delete cascade,
  autor_id uuid not null references profiles(id),
  texto text not null,
  creado_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TRIGGER: mantener actualizado_at y registrar historial de estado
-- ------------------------------------------------------------
create or replace function fn_levantamiento_actualizado()
returns trigger as $$
begin
  new.actualizado_at = now();
  if (old.estado is distinct from new.estado) then
    insert into historial_estados (levantamiento_id, estado_anterior, estado_nuevo, cambiado_por)
    values (new.id, old.estado, new.estado, coalesce(new.asignado_a, new.reportado_por));
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_levantamiento_actualizado
before update on levantamientos
for each row execute function fn_levantamiento_actualizado();

-- ------------------------------------------------------------
-- FUNCION AUXILIAR: crear profile automáticamente al registrarse
-- ------------------------------------------------------------
create or replace function fn_handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre_completo, rol, tipo)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre_completo', new.email), 'usuario', 'voluntario');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function fn_handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table profiles enable row level security;
alter table cuarteles enable row level security;
alter table carros enable row level security;
alter table levantamientos enable row level security;
alter table historial_estados enable row level security;
alter table facturas enable row level security;
alter table comentarios enable row level security;

-- Función auxiliar: saber si el usuario autenticado es admin
create or replace function fn_es_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and rol = 'admin'
  );
$$ language sql security definer stable;

-- PROFILES: todos los autenticados pueden leer (para asignar responsables);
-- solo el propio usuario o un admin puede editar.
create policy "profiles_select_auth" on profiles for select
  using (auth.role() = 'authenticated');
create policy "profiles_update_propio_o_admin" on profiles for update
  using (id = auth.uid() or fn_es_admin());

-- CUARTELES / CARROS: lectura para todos los autenticados; escritura solo admin.
create policy "cuarteles_select_auth" on cuarteles for select
  using (auth.role() = 'authenticated');
create policy "cuarteles_write_admin" on cuarteles for all
  using (fn_es_admin()) with check (fn_es_admin());

create policy "carros_select_auth" on carros for select
  using (auth.role() = 'authenticated');
create policy "carros_write_admin" on carros for all
  using (fn_es_admin()) with check (fn_es_admin());

-- LEVANTAMIENTOS: cualquier autenticado puede leer y crear.
-- Solo admin (o quien lo creó) puede actualizar; borrar solo admin.
create policy "levantamientos_select_auth" on levantamientos for select
  using (auth.role() = 'authenticated');
create policy "levantamientos_insert_auth" on levantamientos for insert
  with check (auth.role() = 'authenticated' and reportado_por = auth.uid());
create policy "levantamientos_update_admin_o_creador" on levantamientos for update
  using (fn_es_admin() or reportado_por = auth.uid());
create policy "levantamientos_delete_admin" on levantamientos for delete
  using (fn_es_admin());

-- HISTORIAL: lectura para todos, solo el sistema (trigger) inserta.
create policy "historial_select_auth" on historial_estados for select
  using (auth.role() = 'authenticated');

-- FACTURAS: lectura para todos, solo admin sube/edita/borra.
create policy "facturas_select_auth" on facturas for select
  using (auth.role() = 'authenticated');
create policy "facturas_write_admin" on facturas for all
  using (fn_es_admin()) with check (fn_es_admin());

-- COMENTARIOS: lectura y creación para todos los autenticados.
create policy "comentarios_select_auth" on comentarios for select
  using (auth.role() = 'authenticated');
create policy "comentarios_insert_auth" on comentarios for insert
  with check (auth.role() = 'authenticated' and autor_id = auth.uid());

-- ============================================================
-- DATOS SEMILLA (ajustar a la realidad del cuartel)
-- ============================================================
insert into cuarteles (nombre) values ('Cuartel Principal');

insert into carros (cuartel_id, codigo, nombre, tipo)
select id, codigo, nombre, tipo from (
  select
    (select id from cuarteles limit 1) as id,
    unnest(array['B6','RX6','R6','M6']) as codigo,
    unnest(array['Bomba 6','Rescate 6','Rescate 6 (liviano)','Municiones/Materiales 6']) as nombre,
    unnest(array['Bomba','Rescate','Rescate','Logístico']) as tipo
) t;

-- Storage: crear buckets desde el panel de Supabase (o vía API):
--   levantamientos-fotos   (público de lectura, subida solo autenticados)
--   facturas-adjuntos      (privado, lectura solo admin)
