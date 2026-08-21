// ------------------------------------------------------------
// Definición del menú, en un solo lugar.
// Cada item indica quién lo ve. Los marcados como "proximamente"
// se muestran apagados: sirven para ver la estructura completa
// antes de que esas secciones existan.
// ------------------------------------------------------------

export function construirMenu(permisos) {
  const {
    esAdmin,
    esCapitan,
    esTeniente,
    esOficial,
    esCuartelero,
    esVoluntario,
    esMaquinista,
    puedeGestionar,
    puedeEditarFormularios
  } = permisos

  const mandoOperativo = esCapitan || esTeniente || esAdmin

  const items = [
    { a: '/', icono: '🏠', texto: 'Inicio', visible: true },

    {
      a: '/levantamientos',
      icono: '📝',
      texto: 'Levantamientos',
      visible: puedeGestionar
    },
    {
      a: '/mis-tareas',
      icono: '📌',
      texto: 'Mis pendientes',
      visible: esVoluntario || esCuartelero || esMaquinista
    },
    {
      a: '/control-carro',
      icono: '🚒',
      texto: 'Reporte Material Mayor',
      visible: esCuartelero
    },
    {
      a: '/reportes-carros',
      icono: '🔎',
      texto: 'Reportes Carros',
      visible: mandoOperativo || esCuartelero || esOficial || esMaquinista
    },

    {
      a: '/solicitud-maquinista',
      icono: '🧑‍🚒',
      texto: 'Solicitud Maquinista',
      visible: mandoOperativo,
      proximamente: true
    },
    {
      a: '/solicitud-acuartelamiento',
      icono: '🏛',
      texto: 'Solicitud Acuartelamiento',
      visible: mandoOperativo,
      proximamente: true
    },
    {
      a: '/solicitud-citacion',
      icono: '📣',
      texto: 'Solicitud Citación',
      visible: mandoOperativo,
      proximamente: true
    }
  ]

  const configuracion = [
    { a: '/usuarios', icono: '👤', texto: 'Usuarios', visible: esAdmin },
    { a: '/formularios', icono: '📋', texto: 'Formularios', visible: puedeEditarFormularios },
    { a: '/correos', icono: '✉️', texto: 'Correos', visible: esAdmin },
    {
      a: '/material-mayor',
      icono: '🚨',
      texto: 'Material Mayor',
      visible: mandoOperativo
    }
  ].filter((i) => i.visible)

  return {
    items: items.filter((i) => i.visible),
    configuracion
  }
}
