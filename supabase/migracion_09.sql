-- ============================================================
-- Migración 09
--   1) Rol Maquinista
--   2) Estado operativo del carro (fuera de servicio)
--   3) Permiso para que el mando cambie ese estado
--
-- NOTA: si al ejecutar todo junto aparece el error
-- "unsafe use of new value of enum type", ejecuta primero SOLO la
-- línea del punto 1 y después el resto en una consulta aparte.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Nuevo cargo: Maquinista
-- ------------------------------------------------------------
alter type tipo_personal add value if not exists 'maquinista';

-- ------------------------------------------------------------
-- 2) Estado operativo del carro
--    El color se calcula así:
--      ROJO    -> fuera_servicio = true (lo marca el mando a mano)
--      NARANJO -> tiene levantamientos abiertos (falla reportada)
--      VERDE   -> operativo y sin novedades
-- ------------------------------------------------------------
alter table carros
  add column if not exists fuera_servicio boolean not null default false;

alter table carros
  add column if not exists nota_estado text;

alter table carros
  add column if not exists estado_actualizado_at timestamptz;

alter table carros
  add column if not exists estado_actualizado_por uuid references profiles(id);

-- ------------------------------------------------------------
-- 3) Capitán, tenientes y admin pueden cambiar el estado del carro.
--    Crear o eliminar carros sigue siendo solo del admin.
-- ------------------------------------------------------------
drop policy if exists "carros_update_gestor" on carros;
create policy "carros_update_gestor" on carros for update
  using (fn_puede_gestionar()) with check (fn_puede_gestionar());
