-- ============================================================
-- Migración 03: módulos por rol (oficiales, voluntarios, cuarteleros),
-- reportes diarios y configuración de correos por categoría/carro.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Oficiales tienen los mismos permisos operativos que admin
--    (asignar, cambiar estado, eliminar, cargar facturas),
--    pero NO gestión de usuarios ni catálogo de carros.
-- ------------------------------------------------------------
create or replace function fn_puede_gestionar()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and (rol = 'admin' or tipo = 'oficial')
  );
$$ language sql security definer stable;

drop policy if exists "levantamientos_update_admin_o_creador" on levantamientos;
create policy "levantamientos_update_gestor_o_creador" on levantamientos for update
  using (fn_puede_gestionar() or reportado_por = auth.uid());

drop policy if exists "levantamientos_delete_admin" on levantamientos;
create policy "levantamientos_delete_gestor" on levantamientos for delete
  using (fn_puede_gestionar());

drop policy if exists "facturas_write_admin" on facturas;
create policy "facturas_write_gestor" on facturas for all
  using (fn_puede_gestionar()) with check (fn_puede_gestionar());

-- ------------------------------------------------------------
-- 2) REPORTES DIARIOS (cuarteleros) - material mayor / equipos motorizados
--    El formulario detallado se define más adelante; por ahora
--    guarda un texto libre para no bloquear el flujo.
-- ------------------------------------------------------------
create type tipo_reporte_diario as enum ('material_mayor', 'equipos_motorizados');

create table reportes_diarios (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_reporte_diario not null,
  autor_id uuid not null references profiles(id),
  contenido text,
  creado_at timestamptz not null default now()
);

alter table reportes_diarios enable row level security;

create policy "reportes_select_propio_o_gestor" on reportes_diarios for select
  using (autor_id = auth.uid() or fn_puede_gestionar());
create policy "reportes_insert_propio" on reportes_diarios for insert
  with check (autor_id = auth.uid());

-- ------------------------------------------------------------
-- 3) CONFIGURACIÓN DE CORREOS por categoría / carro (solo admin)
--    El envío real de correos se conecta en una etapa siguiente;
--    por ahora esto solo guarda a quién deberían llegar.
-- ------------------------------------------------------------
create table notificaciones_email (
  id uuid primary key default gen_random_uuid(),
  categoria categoria_levantamiento not null,
  carro_id uuid references carros(id) on delete cascade,
  email text not null,
  creado_at timestamptz not null default now()
);

alter table notificaciones_email enable row level security;

create policy "notificaciones_select_admin" on notificaciones_email for select
  using (fn_es_admin());
create policy "notificaciones_write_admin" on notificaciones_email for all
  using (fn_es_admin()) with check (fn_es_admin());
