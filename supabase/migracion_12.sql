-- ============================================================
-- Migración 12
-- Categorías y prioridades editables desde la aplicación.
--
-- Hasta ahora eran tipos fijos de PostgreSQL: para agregar una
-- categoría había que tocar la base de datos. Pasan a ser tablas
-- normales, administrables desde Formularios › Levantamientos.
--
-- Los levantamientos existentes NO se alteran: conservan el mismo
-- texto que tenían ('carro', 'epp', 'media', etc.).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Las columnas dejan de ser tipo fijo y pasan a texto
--    Hay que quitar el valor por defecto antes de cambiar el tipo
--    y volver a ponerlo después.
-- ------------------------------------------------------------
alter table levantamientos alter column categoria drop default;
alter table levantamientos alter column categoria type text using categoria::text;
alter table levantamientos alter column categoria set default 'otro';

alter table levantamientos alter column prioridad drop default;
alter table levantamientos alter column prioridad type text using prioridad::text;
alter table levantamientos alter column prioridad set default 'media';

alter table notificaciones_email alter column categoria type text using categoria::text;

-- ------------------------------------------------------------
-- 2) Catálogo de categorías
--    'clave' es el valor que se guarda en los levantamientos y no
--    debería cambiarse una vez en uso; 'etiqueta' es lo que se ve.
--    pide_carro / pide_subcategoria replican el comportamiento que
--    hoy tiene "Carro bomba", para que una categoría nueva pueda
--    hacer lo mismo sin tocar el código.
-- ------------------------------------------------------------
create table if not exists categorias_levantamiento (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  etiqueta text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  pide_carro boolean not null default false,
  pide_subcategoria boolean not null default false,
  creado_at timestamptz not null default now()
);

insert into categorias_levantamiento (clave, etiqueta, orden, pide_carro, pide_subcategoria)
values
  ('infraestructura', 'Cuartel',     1, false, false),
  ('carro',           'Carro bomba', 2, true,  true),
  ('epp',             'EPP',         3, false, false),
  ('otro',            'Otro',        4, false, false)
on conflict (clave) do nothing;

-- ------------------------------------------------------------
-- 3) Catálogo de prioridades
-- ------------------------------------------------------------
create table if not exists prioridades_levantamiento (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  etiqueta text not null,
  color text not null default '#95a5a6',
  orden integer not null default 0,
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

insert into prioridades_levantamiento (clave, etiqueta, color, orden)
values
  ('baja',    'Baja',    '#95a5a6', 1),
  ('media',   'Media',   '#f1c40f', 2),
  ('alta',    'Alta',    '#e67e22', 3),
  ('urgente', 'Urgente', '#c0392b', 4)
on conflict (clave) do nothing;

-- ------------------------------------------------------------
-- 4) Permisos
--    Todos los autenticados leen (los formularios los necesitan);
--    admin y capitán administran, igual que los formularios.
-- ------------------------------------------------------------
alter table categorias_levantamiento enable row level security;
alter table prioridades_levantamiento enable row level security;

drop policy if exists "categorias_select" on categorias_levantamiento;
create policy "categorias_select" on categorias_levantamiento for select
  using (auth.role() = 'authenticated');
drop policy if exists "categorias_write" on categorias_levantamiento;
create policy "categorias_write" on categorias_levantamiento for all
  using (fn_puede_editar_formularios()) with check (fn_puede_editar_formularios());

drop policy if exists "prioridades_select" on prioridades_levantamiento;
create policy "prioridades_select" on prioridades_levantamiento for select
  using (auth.role() = 'authenticated');
drop policy if exists "prioridades_write" on prioridades_levantamiento;
create policy "prioridades_write" on prioridades_levantamiento for all
  using (fn_puede_editar_formularios()) with check (fn_puede_editar_formularios());

-- ------------------------------------------------------------
-- 5) Los carros también se administran desde la aplicación
--    (crear y eliminar; el estado operativo ya estaba permitido)
-- ------------------------------------------------------------
drop policy if exists "carros_write_gestor" on carros;
create policy "carros_write_gestor" on carros for all
  using (fn_puede_editar_formularios()) with check (fn_puede_editar_formularios());
