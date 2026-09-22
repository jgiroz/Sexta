-- ============================================================
-- Migración 07 · PASO 2 de 2
-- Ejecutar DESPUÉS del paso 1, en una consulta aparte.
--
--   1) Los oficiales pasan a ser Tenientes
--   2) Permisos: quién gestiona y quién edita formularios
--   3) Formularios configurables desde la aplicación
--   4) Destinatarios de correo por formulario
--   5) Semilla: formulario de control del carro B6
-- ============================================================

-- ------------------------------------------------------------
-- 1) Los "oficiales" existentes pasan a ser Tenientes.
--    Teniente y Capitán tienen los mismos permisos operativos.
-- ------------------------------------------------------------
update profiles set tipo = 'teniente' where tipo = 'oficial';

-- ------------------------------------------------------------
-- 2) Permisos
-- ------------------------------------------------------------

-- Gestionar levantamientos: admin, capitán y teniente.
create or replace function fn_puede_gestionar()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (rol = 'admin' or tipo in ('oficial', 'teniente', 'capitan'))
  );
$$ language sql security definer stable;

-- Editar formularios y sus destinatarios: solo admin y capitán.
create or replace function fn_puede_editar_formularios()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (rol = 'admin' or tipo = 'capitan')
  );
$$ language sql security definer stable;

-- ------------------------------------------------------------
-- 3) Formularios configurables
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_pregunta') then
    create type tipo_pregunta as enum ('ok_falla', 'opciones', 'numero', 'texto');
  end if;
end$$;

create table if not exists formularios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  carro_id uuid references carros(id) on delete cascade,
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

create table if not exists formulario_secciones (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references formularios(id) on delete cascade,
  titulo text not null,
  orden integer not null default 0
);

-- config (jsonb) según el tipo de pregunta:
--   ok_falla  -> {}                        el FALLA genera la alerta
--   opciones  -> {"opciones":[{"valor":"1_2","etiqueta":"1/2 estanque","alerta":true}, ...]}
--   numero    -> {"unidad":"km","alerta_menor_que":null,"alerta_mayor_que":null}
--   texto     -> {"alerta_si_tiene_texto":false}
create table if not exists formulario_preguntas (
  id uuid primary key default gen_random_uuid(),
  seccion_id uuid not null references formulario_secciones(id) on delete cascade,
  etiqueta text not null,
  tipo tipo_pregunta not null default 'ok_falla',
  orden integer not null default 0,
  requerido boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  -- si la respuesta dispara alerta, ¿se crea además un levantamiento?
  genera_levantamiento boolean not null default true,
  activo boolean not null default true
);

create index if not exists idx_secciones_formulario on formulario_secciones (formulario_id, orden);
create index if not exists idx_preguntas_seccion on formulario_preguntas (seccion_id, orden);

-- Respuestas: se guarda una copia completa de lo respondido, para que
-- editar el formulario más adelante no altere los registros antiguos.
create table if not exists formulario_respuestas (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references formularios(id) on delete cascade,
  carro_id uuid references carros(id) on delete set null,
  autor_id uuid not null references profiles(id),
  datos jsonb not null default '[]'::jsonb,
  total_alertas integer not null default 0,
  observaciones text,
  creado_at timestamptz not null default now()
);

create index if not exists idx_respuestas_form_fecha
  on formulario_respuestas (formulario_id, creado_at desc);

-- ------------------------------------------------------------
-- 4) Destinatarios de correo por formulario
-- ------------------------------------------------------------
create table if not exists formulario_destinatarios (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references formularios(id) on delete cascade,
  email text not null,
  creado_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table formularios enable row level security;
alter table formulario_secciones enable row level security;
alter table formulario_preguntas enable row level security;
alter table formulario_respuestas enable row level security;
alter table formulario_destinatarios enable row level security;

-- Definición del formulario: todos los autenticados pueden leerla
-- (la necesitan para llenarlo); solo admin y capitán la modifican.
drop policy if exists "formularios_select" on formularios;
create policy "formularios_select" on formularios for select
  using (auth.role() = 'authenticated');
drop policy if exists "formularios_write" on formularios;
create policy "formularios_write" on formularios for all
  using (fn_puede_editar_formularios()) with check (fn_puede_editar_formularios());

drop policy if exists "secciones_select" on formulario_secciones;
create policy "secciones_select" on formulario_secciones for select
  using (auth.role() = 'authenticated');
drop policy if exists "secciones_write" on formulario_secciones;
create policy "secciones_write" on formulario_secciones for all
  using (fn_puede_editar_formularios()) with check (fn_puede_editar_formularios());

drop policy if exists "preguntas_select" on formulario_preguntas;
create policy "preguntas_select" on formulario_preguntas for select
  using (auth.role() = 'authenticated');
drop policy if exists "preguntas_write" on formulario_preguntas;
create policy "preguntas_write" on formulario_preguntas for all
  using (fn_puede_editar_formularios()) with check (fn_puede_editar_formularios());

-- Respuestas: las lee cualquier autenticado, las crea quien las llena.
drop policy if exists "respuestas_select" on formulario_respuestas;
create policy "respuestas_select" on formulario_respuestas for select
  using (auth.role() = 'authenticated');
drop policy if exists "respuestas_insert" on formulario_respuestas;
create policy "respuestas_insert" on formulario_respuestas for insert
  with check (autor_id = auth.uid());

-- Destinatarios: solo admin y capitán, en lectura y escritura.
drop policy if exists "destinatarios_select" on formulario_destinatarios;
create policy "destinatarios_select" on formulario_destinatarios for select
  using (fn_puede_editar_formularios());
drop policy if exists "destinatarios_write" on formulario_destinatarios;
create policy "destinatarios_write" on formulario_destinatarios for all
  using (fn_puede_editar_formularios()) with check (fn_puede_editar_formularios());

-- ------------------------------------------------------------
-- 5) SEMILLA: formulario de control del carro B6
--    Es un ejemplo listo para usar. Todo esto se puede editar
--    después desde la aplicación, sin tocar la base de datos.
-- ------------------------------------------------------------
do $$
declare
  v_carro uuid;
  v_form uuid;
begin
  select id into v_carro from carros where codigo = 'B6' limit 1;
  if v_carro is null then
    raise notice 'No existe el carro B6, se omite la semilla del formulario.';
    return;
  end if;

  if exists (select 1 from formularios where carro_id = v_carro) then
    raise notice 'El carro B6 ya tiene formulario, se omite la semilla.';
    return;
  end if;

  insert into formularios (nombre, descripcion, carro_id)
  values ('Control carro bomba B6', 'Lista de verificación del carro B6', v_carro)
  returning id into v_form;

  insert into formulario_secciones (formulario_id, titulo, orden)
  select v_form, t.titulo, t.orden
  from (values
    ('DATOS GENERALES', 1),
    ('INSTRUMENTOS DE TABLERO', 2),
    ('SISTEMA ELECTRICO', 3),
    ('SISTEMA DE ALARMA', 4),
    ('SISTEMA DE COMUNICACIONES', 5),
    ('NEUMATICOS', 6),
    ('SISTEMA DE FRENOS', 7),
    ('SISTEMA DE DIRECCION', 8),
    ('SISTEMA DE ESCAPE', 9),
    ('ESTANQUE DE COMBUSTIBLE', 10),
    ('SISTEMA DE ACOPLE', 11),
    ('CARROCERIA', 12),
    ('DOCUMENTACION DEL CARRO', 13),
    ('ACCESORIOS DEL CARRO', 14),
    ('ACCESORIOS CUERPO DE BOMBA', 15)
  ) as t(titulo, orden);

  insert into formulario_preguntas (seccion_id, etiqueta, tipo, orden, requerido, config, genera_levantamiento)
  select s.id, p.etiqueta, p.tipo::tipo_pregunta, p.orden, p.requerido, p.config::jsonb, p.genera_lev
  from formulario_secciones s
  join (values
    -- DATOS GENERALES
    ('DATOS GENERALES','Kilometraje','numero',1,true,'{"unidad":"km"}',false),
    ('DATOS GENERALES','Horas bomba','numero',2,true,'{"unidad":"h"}',false),

    -- INSTRUMENTOS DE TABLERO
    ('INSTRUMENTOS DE TABLERO','Tacometro','ok_falla',1,false,'{}',true),
    ('INSTRUMENTOS DE TABLERO','Marcador de temperatura','ok_falla',2,false,'{}',true),
    ('INSTRUMENTOS DE TABLERO','Marcador de bateria','ok_falla',3,false,'{}',true),
    ('INSTRUMENTOS DE TABLERO','Velocimetro','ok_falla',4,false,'{}',true),
    ('INSTRUMENTOS DE TABLERO','Led acople freno de cuña','ok_falla',5,false,'{}',true),
    ('INSTRUMENTOS DE TABLERO','Led acople cuerpo bomba','ok_falla',6,false,'{}',true),
    ('INSTRUMENTOS DE TABLERO','Luces de tablero','ok_falla',7,false,'{}',true),

    -- SISTEMA ELECTRICO
    ('SISTEMA ELECTRICO','Sistema de encendido (arranque)','ok_falla',1,false,'{}',true),
    ('SISTEMA ELECTRICO','Luces altas y bajas','ok_falla',2,false,'{}',true),
    ('SISTEMA ELECTRICO','Luces de viraje','ok_falla',3,false,'{}',true),
    ('SISTEMA ELECTRICO','Luces de freno','ok_falla',4,false,'{}',true),
    ('SISTEMA ELECTRICO','Luces de retroceso','ok_falla',5,false,'{}',true),
    ('SISTEMA ELECTRICO','Luces de emergencia','ok_falla',6,false,'{}',true),
    ('SISTEMA ELECTRICO','Luz de patente','ok_falla',7,false,'{}',true),
    ('SISTEMA ELECTRICO','Neblineros','ok_falla',8,false,'{}',true),
    ('SISTEMA ELECTRICO','Limpiaparabrisas','ok_falla',9,false,'{}',true),
    ('SISTEMA ELECTRICO','Bocina electrica','ok_falla',10,false,'{}',true),
    ('SISTEMA ELECTRICO','Encendido de balizas y compartimientos','ok_falla',11,false,'{}',true),

    -- SISTEMA DE ALARMA
    ('SISTEMA DE ALARMA','Baliza','ok_falla',1,false,'{}',true),
    ('SISTEMA DE ALARMA','Papi','ok_falla',2,false,'{}',true),

    -- COMUNICACIONES
    ('SISTEMA DE COMUNICACIONES','Equipo de radio','ok_falla',1,false,'{}',true),
    ('SISTEMA DE COMUNICACIONES','Microfono','ok_falla',2,false,'{}',true),
    ('SISTEMA DE COMUNICACIONES','Cables de poder','ok_falla',3,false,'{}',true),
    ('SISTEMA DE COMUNICACIONES','Antena','ok_falla',4,false,'{}',true),

    -- NEUMATICOS
    ('NEUMATICOS','Presion','ok_falla',1,false,'{}',true),
    ('NEUMATICOS','Desgaste de borde','ok_falla',2,false,'{}',true),
    ('NEUMATICOS','Estado general (grietas u otro)','ok_falla',3,false,'{}',true),
    ('NEUMATICOS','Pernos de sujecion','ok_falla',4,false,'{}',true),
    ('NEUMATICOS','Neumatico de repuesto','ok_falla',5,false,'{}',true),

    -- FRENOS
    ('SISTEMA DE FRENOS','Freno de pedal','ok_falla',1,false,'{}',true),
    ('SISTEMA DE FRENOS','Freno de estacionamiento','ok_falla',2,false,'{}',true),

    -- DIRECCION
    ('SISTEMA DE DIRECCION','Barra de direccion','ok_falla',1,false,'{}',true),
    ('SISTEMA DE DIRECCION','Direccion hidraulica','ok_falla',2,false,'{}',true),

    -- ESCAPE
    ('SISTEMA DE ESCAPE','Silenciador y tubo de escape','ok_falla',1,false,'{}',true),

    -- COMBUSTIBLE  (el nivel usa opciones con alerta en 1/2 o menos)
    ('ESTANQUE DE COMBUSTIBLE','Nivel de combustible','opciones',1,true,
      '{"opciones":[{"valor":"lleno","etiqueta":"Lleno","alerta":false},{"valor":"3_4","etiqueta":"3/4 de estanque","alerta":false},{"valor":"1_2","etiqueta":"1/2 estanque","alerta":true},{"valor":"1_4","etiqueta":"1/4 de estanque","alerta":true},{"valor":"reserva","etiqueta":"Reserva o vacio","alerta":true}]}',
      true),
    ('ESTANQUE DE COMBUSTIBLE','Tapa','ok_falla',2,false,'{}',true),
    ('ESTANQUE DE COMBUSTIBLE','Estructura','ok_falla',3,false,'{}',true),

    -- ACOPLE
    ('SISTEMA DE ACOPLE','Muela de enganche trasera','ok_falla',1,false,'{}',true),
    ('SISTEMA DE ACOPLE','Enganche delantero','ok_falla',2,false,'{}',true),
    ('SISTEMA DE ACOPLE','Tuerca seguro de pasador principal','ok_falla',3,false,'{}',true),

    -- CARROCERIA
    ('CARROCERIA','Puertas delanteras','ok_falla',1,false,'{}',true),
    ('CARROCERIA','Puertas traseras','ok_falla',2,false,'{}',true),
    ('CARROCERIA','Cerrojos','ok_falla',3,false,'{}',true),
    ('CARROCERIA','Manillas de apertura de puertas','ok_falla',4,false,'{}',true),
    ('CARROCERIA','Alzavidrios','ok_falla',5,false,'{}',true),
    ('CARROCERIA','Compartimientos','ok_falla',6,false,'{}',true),
    ('CARROCERIA','Puertas de compartimientos','ok_falla',7,false,'{}',true),
    ('CARROCERIA','Pisaderas','ok_falla',8,false,'{}',true),
    ('CARROCERIA','Asientos delanteros','ok_falla',9,false,'{}',true),
    ('CARROCERIA','Asientos traseros','ok_falla',10,false,'{}',true),
    ('CARROCERIA','Vidrios','ok_falla',11,false,'{}',true),

    -- DOCUMENTACION
    ('DOCUMENTACION DEL CARRO','Permiso de circulacion','ok_falla',1,false,'{}',true),
    ('DOCUMENTACION DEL CARRO','Seguro automotriz obligatorio','ok_falla',2,false,'{}',true),
    ('DOCUMENTACION DEL CARRO','Revision tecnica','ok_falla',3,false,'{}',true),

    -- ACCESORIOS CARRO
    ('ACCESORIOS DEL CARRO','Espejos laterales','ok_falla',1,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Cinturon de seguridad 3 puntas','ok_falla',2,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Extintor','ok_falla',3,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Botiquin','ok_falla',4,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Triangulos','ok_falla',5,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Cuñas','ok_falla',6,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Llave de rueda con barretilla','ok_falla',7,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Parabrisas','ok_falla',8,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Vidrios laterales','ok_falla',9,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Caja de herramientas','ok_falla',10,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Faro busca camino','ok_falla',11,false,'{}',true),
    ('ACCESORIOS DEL CARRO','Lampara interior','ok_falla',12,false,'{}',true),

    -- CUERPO DE BOMBA
    ('ACCESORIOS CUERPO DE BOMBA','Parada de emergencia','ok_falla',1,false,'{}',true),
    ('ACCESORIOS CUERPO DE BOMBA','Marcador de nivel','ok_falla',2,false,'{}',true),
    ('ACCESORIOS CUERPO DE BOMBA','Tacometro','ok_falla',3,false,'{}',true),
    ('ACCESORIOS CUERPO DE BOMBA','Vacuometro','ok_falla',4,false,'{}',true),
    ('ACCESORIOS CUERPO DE BOMBA','Portamangueras','ok_falla',5,false,'{}',true),
    ('ACCESORIOS CUERPO DE BOMBA','Portaescalas','ok_falla',6,false,'{}',true),
    ('ACCESORIOS CUERPO DE BOMBA','Estanque de agua','ok_falla',7,false,'{}',true),
    ('ACCESORIOS CUERPO DE BOMBA','Valvulas de corte','ok_falla',8,false,'{}',true),
    ('ACCESORIOS CUERPO DE BOMBA','Acoples','ok_falla',9,false,'{}',true)
  ) as p(seccion, etiqueta, tipo, orden, requerido, config, genera_lev)
    on p.seccion = s.titulo
  where s.formulario_id = v_form;

  raise notice 'Formulario del B6 creado correctamente.';
end$$;
