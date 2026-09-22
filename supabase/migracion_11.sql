-- ============================================================
-- Migración 11
-- "¿Quién hace el reporte?" para cuentas compartidas.
--
-- Los cuarteleros comparten la tablet con una sola cuenta (L6), así que
-- todo quedaba a nombre de esa cuenta. Ahora se registra además la
-- persona que efectivamente hizo el reporte.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Personal de cuartel: la lista de nombres que aparece en la tablet
-- ------------------------------------------------------------
create table if not exists personal_cuartel (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

alter table personal_cuartel enable row level security;

-- Todos los autenticados la leen (la necesitan para elegir);
-- admin y capitán la administran.
drop policy if exists "personal_select" on personal_cuartel;
create policy "personal_select" on personal_cuartel for select
  using (auth.role() = 'authenticated');

drop policy if exists "personal_write" on personal_cuartel;
create policy "personal_write" on personal_cuartel for all
  using (fn_puede_editar_formularios()) with check (fn_puede_editar_formularios());

-- ------------------------------------------------------------
-- 2) Guardar el nombre en lo que se reporta
--    Se guarda el texto y no un vínculo, para que el registro histórico
--    no cambie si después se corrige o se borra un nombre de la lista.
-- ------------------------------------------------------------
alter table levantamientos
  add column if not exists reportado_por_nombre text;

alter table formulario_respuestas
  add column if not exists realizado_por_nombre text;
