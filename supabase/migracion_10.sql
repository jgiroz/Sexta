-- ============================================================
-- Migración 10
-- Reporte de carro resumido: 14 sistemas en vez de 77 componentes.
-- Se crea para los cuatro carros, con la variación de cada uno:
--   B6  y RX6 -> cuerpo de bomba
--   R6        -> generador incorporado
--   M6        -> escala hidráulica
--
-- IMPORTANTE: el formulario detallado del B6 NO se borra, se DESACTIVA.
-- Borrarlo eliminaría también los reportes ya enviados con él, porque
-- las respuestas cuelgan del formulario. Desactivado desaparece de la
-- lista del cuartelero, pero el historial queda intacto.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Sacar de circulación los formularios anteriores
-- ------------------------------------------------------------
update formularios
set activo = false
where carro_id is not null
  and nombre not like 'Reporte Material Mayor%';

-- ------------------------------------------------------------
-- 2) Crear el formulario resumido de cada carro
-- ------------------------------------------------------------
do $$
declare
  v record;
  v_carro uuid;
  v_form uuid;
begin
  for v in
    select * from (values
      ('B6',  'Cuerpo de bomba',    'Horometro cuerpo de bomba'),
      ('RX6', 'Cuerpo de bomba',    'Horometro cuerpo de bomba'),
      ('R6',  'Generador incorporado', 'Horometro generador'),
      ('M6',  'Escala hidraulica',  'Horometro escala hidraulica')
    ) as t(codigo, equipo, horometro)
  loop
    select id into v_carro from carros where codigo = v.codigo limit 1;

    if v_carro is null then
      raise notice 'No existe el carro %, se omite.', v.codigo;
      continue;
    end if;

    -- No duplicar si ya se corrió esta migración
    if exists (
      select 1 from formularios
      where carro_id = v_carro and nombre = 'Reporte Material Mayor ' || v.codigo
    ) then
      raise notice 'El carro % ya tiene el formulario resumido.', v.codigo;
      continue;
    end if;

    insert into formularios (nombre, descripcion, carro_id, activo)
    values (
      'Reporte Material Mayor ' || v.codigo,
      'Control diario del carro ' || v.codigo,
      v_carro,
      true
    )
    returning id into v_form;

    insert into formulario_secciones (formulario_id, titulo, orden)
    values (v_form, 'DATOS GENERALES', 1), (v_form, 'REVISION POR SISTEMA', 2);

    -- Datos medidos
    insert into formulario_preguntas
      (seccion_id, etiqueta, tipo, orden, requerido, config, genera_levantamiento)
    select s.id, p.etiqueta, p.tipo::tipo_pregunta, p.orden, p.requerido, p.config::jsonb, p.gen
    from formulario_secciones s
    join (values
      ('Kilometraje', 'numero', 1, true, '{"unidad":"km"}', false),
      (v.horometro,  'numero', 2, true, '{"unidad":"h"}',  false),
      ('Nivel de combustible', 'opciones', 3, true,
        '{"opciones":[{"valor":"lleno","etiqueta":"Lleno","alerta":false},{"valor":"3_4","etiqueta":"3/4 de estanque","alerta":false},{"valor":"1_2","etiqueta":"1/2 estanque","alerta":true},{"valor":"1_4","etiqueta":"1/4 de estanque","alerta":true},{"valor":"reserva","etiqueta":"Reserva o vacio","alerta":true}]}',
        true)
    ) as p(etiqueta, tipo, orden, requerido, config, gen) on true
    where s.formulario_id = v_form and s.titulo = 'DATOS GENERALES';

    -- Revisión por sistema: un OK/FALLA por sistema completo.
    -- El item 14 cambia según el equipo de cada carro.
    insert into formulario_preguntas
      (seccion_id, etiqueta, tipo, orden, requerido, config, genera_levantamiento)
    select s.id, p.etiqueta, 'ok_falla'::tipo_pregunta, p.orden, false, '{}'::jsonb, true
    from formulario_secciones s
    join (values
      ('Instrumentos de tablero', 1),
      ('Sistema electrico y luces', 2),
      ('Sistema de alarma', 3),
      ('Comunicaciones', 4),
      ('Neumaticos', 5),
      ('Frenos', 6),
      ('Direccion', 7),
      ('Escape', 8),
      ('Estanque de combustible', 9),
      ('Sistema de acople', 10),
      ('Carroceria', 11),
      ('Documentacion', 12),
      ('Accesorios del carro', 13),
      (v.equipo, 14)
    ) as p(etiqueta, orden) on true
    where s.formulario_id = v_form and s.titulo = 'REVISION POR SISTEMA';

    raise notice 'Formulario resumido creado para %.', v.codigo;
  end loop;
end$$;
