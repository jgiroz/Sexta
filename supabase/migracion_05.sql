-- ============================================================
-- Migración 05
--   1) Correo real de contacto por persona (para avisar al asignado)
--   2) Reporte diario de material mayor con estructura completa
--   3) Vínculo entre reporte y los levantamientos que genera
--   4) Lectura de reportes para consultar horómetros
-- ============================================================

-- ------------------------------------------------------------
-- 1) Correo de contacto
--    Las cuentas de cuartelero usan correos internos (l6@sexta.local)
--    que no existen de verdad. Aquí el admin puede indicar el correo
--    real al que se le debe avisar.
-- ------------------------------------------------------------
alter table profiles
  add column if not exists email_contacto text;

-- ------------------------------------------------------------
-- 2) Reporte diario: campos del formulario de material mayor
--    'items' guarda el checklist como JSON para poder agregar o
--    quitar ítems más adelante sin cambiar la base de datos.
-- ------------------------------------------------------------
alter table reportes_diarios
  add column if not exists carro_id uuid references carros(id) on delete set null;

alter table reportes_diarios
  add column if not exists kilometraje numeric(12,1);

alter table reportes_diarios
  add column if not exists horas_bomba numeric(12,1);

alter table reportes_diarios
  add column if not exists items jsonb not null default '[]'::jsonb;

alter table reportes_diarios
  add column if not exists observaciones text;

-- Índice para consultar tendencias por carro y fecha.
create index if not exists idx_reportes_carro_fecha
  on reportes_diarios (carro_id, creado_at desc);

-- ------------------------------------------------------------
-- 3) Levantamientos generados desde un reporte
--    'origen' permite que la Edge Function NO mande un correo por
--    cada falla: el reporte ya envía un correo resumen.
-- ------------------------------------------------------------
alter table levantamientos
  add column if not exists origen text;

alter table levantamientos
  add column if not exists reporte_id uuid references reportes_diarios(id) on delete set null;

create index if not exists idx_levantamientos_reporte
  on levantamientos (reporte_id);

-- ------------------------------------------------------------
-- 4) Lectura de reportes para todos los autenticados
--    Necesario para que los cuarteleros consulten los horómetros
--    históricos, no solo los propios.
-- ------------------------------------------------------------
drop policy if exists "reportes_select_propio_o_gestor" on reportes_diarios;
create policy "reportes_select_auth" on reportes_diarios for select
  using (auth.role() = 'authenticated');
