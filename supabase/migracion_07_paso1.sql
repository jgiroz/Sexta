-- ============================================================
-- Migración 07 · PASO 1 de 2
--
-- IMPORTANTE: este archivo se ejecuta SOLO y COMPLETO, y después
-- hay que ejecutar el paso 2 por separado.
--
-- Motivo: PostgreSQL no permite usar un valor de enum recién creado
-- dentro de la misma transacción en que se creó. Si se juntan los dos
-- pasos, el paso 2 falla con "unsafe use of new value of enum type".
-- ============================================================

alter type tipo_personal add value if not exists 'teniente';
alter type tipo_personal add value if not exists 'capitan';
