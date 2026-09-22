-- ============================================================
-- Migración 04: destinatarios de correo también para reportes
-- diarios, y control de qué correos ya se enviaron.
-- ============================================================

-- ------------------------------------------------------------
-- 1) notificaciones_email: ahora una fila puede ser
--    (a) para levantamientos  -> categoria (+ carro_id opcional)
--    (b) para reportes diarios -> tipo_reporte
-- ------------------------------------------------------------
alter table notificaciones_email
  alter column categoria drop not null;

alter table notificaciones_email
  add column if not exists tipo_reporte tipo_reporte_diario;

-- Una fila debe apuntar a una cosa u otra, nunca a ninguna.
alter table notificaciones_email
  drop constraint if exists notificaciones_ambito_valido;

alter table notificaciones_email
  add constraint notificaciones_ambito_valido check (
    (categoria is not null and tipo_reporte is null)
    or (categoria is null and tipo_reporte is not null)
  );

-- ------------------------------------------------------------
-- 2) Registro de envíos: sirve para no duplicar correos y para
--    poder revisar si algo falló.
-- ------------------------------------------------------------
create table if not exists envios_email (
  id uuid primary key default gen_random_uuid(),
  evento text not null,                 -- levantamiento_creado | levantamiento_cerrado | reporte_diario
  referencia_id uuid not null,          -- id del levantamiento o del reporte
  destinatarios text[] not null default '{}',
  ok boolean not null default false,
  detalle text,
  creado_at timestamptz not null default now()
);

alter table envios_email enable row level security;

drop policy if exists "envios_select_gestor" on envios_email;
create policy "envios_select_gestor" on envios_email for select
  using (fn_puede_gestionar());

-- ------------------------------------------------------------
-- 3) Permitir que la Edge Function lea los datos que necesita.
--    (La función usa la service role key, que ignora RLS, así que
--     no hace falta abrir nada más.)
-- ------------------------------------------------------------
