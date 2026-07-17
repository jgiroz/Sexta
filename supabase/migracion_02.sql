-- ============================================================
-- Migración 02: subcategoría para "Carro Bomba"
-- (Material menor / Material motorizado como submenú)
-- ============================================================

create type subcategoria_carro as enum ('material_menor', 'material_motorizado');

alter table levantamientos
  add column subcategoria subcategoria_carro;
