import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { construirMenu } from '../lib/menu'
import { ESTADOS, ESTADOS_CERRADOS, PRIORIDADES, etiquetaDe, colorDe } from '../lib/constants'
import Badge from '../components/Badge'

// Pantalla de entrada.
// Primero lo que le corresponde a la persona (sus pendientes y, más
// adelante, los compromisos y solicitudes abiertas). Debajo, los
// accesos del menú, que en celular son la única forma de navegar.
export default function Inicio() {
  const permisos = useAuth()
  const { session, profile } = permisos

  const [pendientes, setPendientes] = useState([])
  const [cargando, setCargando] = useState(true)

  const { items, configuracion } = construirMenu(permisos)
  const accesos = [...items.filter((i) => i.a !== '/'), ...configuracion]

  useEffect(() => {
    if (!session) return
    supabase
      .from('levantamientos')
      .select('id, titulo, estado, prioridad, creado_at, carros(codigo)')
      .or(`asignado_a.eq.${session.user.id},reportado_por.eq.${session.user.id}`)
      .not('estado', 'in', `(${ESTADOS_CERRADOS.join(',')})`)
      .order('creado_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setPendientes(data ?? [])
        setCargando(false)
      })
  }, [session])

  const primerNombre = profile?.nombre_completo?.split(' ')[0] ?? ''

  return (
    <div className="pagina pagina-inicio">
      <h2>Hola{primerNombre ? `, ${primerNombre}` : ''}</h2>

      {/* Aquí irán, más arriba que todo, las solicitudes abiertas de
          Capitán y Tenientes para inscribirse. Se agregan al construir
          esos módulos. */}

      <section className="bloque-inicio">
        <div className="bloque-inicio-cabecera">
          <h3>Mis pendientes</h3>
          <Link to="/mis-tareas" className="btn-link">
            Ver todos
          </Link>
        </div>

        {cargando && <p className="cargando">Cargando…</p>}
        {!cargando && pendientes.length === 0 && (
          <p className="muted">No tienes levantamientos pendientes. 🎉</p>
        )}

        {/* Se ven 5; el resto se alcanza con la barra de desplazamiento. */}
        <div className="lista-compacta">
          {pendientes.map((l) => (
            <Link to={`/levantamiento/${l.id}`} key={l.id} className="fila-compacta">
              <span className="punto-estado" style={{ background: colorDe(ESTADOS, l.estado) }} />
              <span className="fila-compacta-titulo">{l.titulo}</span>
              <span className="fila-compacta-meta">
                {l.carros?.codigo && <Badge texto={l.carros.codigo} color="#34495e" />}
                <Badge texto={etiquetaDe(ESTADOS, l.estado)} color={colorDe(ESTADOS, l.estado)} />
                <Badge
                  texto={etiquetaDe(PRIORIDADES, l.prioridad)}
                  color={colorDe(PRIORIDADES, l.prioridad)}
                />
                <span className="muted-chico fecha-compacta">
                  {new Date(l.creado_at).toLocaleDateString('es-CL')}
                </span>
              </span>
            </Link>
          ))}
        </div>
        {pendientes.length > 5 && (
          <p className="muted-chico">Desplázate en la lista para ver los {pendientes.length}.</p>
        )}
      </section>

      <section className="bloque-inicio">
        <h3>Accesos</h3>
        <div className="fila-accesos">
          <Link to="/nuevo" className="acceso destacado">
            <span className="acceso-icono">🧯</span>
            Levantamiento de problema
          </Link>
          {accesos.map((item) =>
            item.proximamente ? (
              <span key={item.a} className="acceso proximamente">
                <span className="acceso-icono">{item.icono}</span>
                {item.texto}
                <span className="etiqueta-pronto">pronto</span>
              </span>
            ) : (
              <Link key={item.a} to={item.a} className="acceso">
                <span className="acceso-icono">{item.icono}</span>
                {item.texto}
              </Link>
            )
          )}
        </div>
      </section>
    </div>
  )
}
