-- ============================================================
-- Migración 08
-- Fotos en las respuestas de formulario (Reporte Material Mayor).
-- Se guardan las direcciones de las imágenes ya subidas a Storage.
-- ============================================================

alter table formulario_respuestas
  add column if not exists fotos jsonb not null default '[]'::jsonb;
