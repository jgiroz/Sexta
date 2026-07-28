import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { ESTADOS, ESTADOS_CERRADOS, PRIORIDADES, etiquetaDe, colorDe } from '../lib/constants'
import Badge from '../components/Badge'

export default function MisTareas() {
  const { session } = useAuth()
  const [levantamientos, setLevantamientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Por defecto solo lo abierto; el historial se muestra a pedido.
  const [verCerrados, setVerCerrados] = useState(false)

  useEffect(() => {
    if (!session) return
    setCargando(true)

    let consulta = supabase
      .from('levantamientos')
      .select(
        'id, titulo, categoria, estado, prioridad, ubicacion, foto_url, creado_at, asignado_a, reportado_por, carros(codigo)'
      )
      .or(`asignado_a.eq.${session.user.id},reportado_por.eq.${session.user.id}`)

    if (!verCerrados) {
      consulta = consulta.not('estado', 'in', `(${ESTADOS_CERRADOS.join(',')})`)
    }

    consulta.order('creado_at', { ascending: false }).then(({ data, error }) => {
      if (error) setError(error.message)
      else setLevantamientos(data ?? [])
      setCargando(false)
    })
  }, [session, verCerrados])

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>{verCerrados ? 'Mis tareas e historial' : 'Pendientes asignados'}</h2>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {!cargando && levantamientos.length === 0 && (
        <p className="vacio">
          {verCerrados
            ? 'No tienes levantamientos asignados ni reportados todavía.'
            : 'No tienes pendientes. 🎉'}
        </p>
      )}

      <div className="lista">
        {levantamientos.map((l) => (
          <Link to={`/levantamiento/${l.id}`} key={l.id} className="tarjeta-item">
            {l.foto_url && <img src={l.foto_url} alt="" className="tarjeta-foto" />}
            <div className="tarjeta-contenido">
              <div className="tarjeta-badges">
                <Badge texto={etiquetaDe(ESTADOS, l.estado)} color={colorDe(ESTADOS, l.estado)} />
                <Badge
                  texto={etiquetaDe(PRIORIDADES, l.prioridad)}
                  color={colorDe(PRIORIDADES, l.prioridad)}
                />
                {l.carros?.codigo && <Badge texto={l.carros.codigo} color="#34495e" />}
                {l.asignado_a === session?.user?.id && (
                  <Badge texto="Asignado a ti" color="#c0392b" />
                )}
              </div>
              <h3>{l.titulo}</h3>
              {l.ubicacion && <p className="muted">📍 {l.ubicacion}</p>}
              <p className="muted-chico">{new Date(l.creado_at).toLocaleString('es-CL')}</p>
            </div>
          </Link>
        ))}
      </div>

      {!cargando && (
        <button
          className="btn-secundario btn-ancho-completo"
          onClick={() => setVerCerrados((v) => !v)}
        >
          {verCerrados ? '← Ver solo pendientes' : '📁 Ver también resueltos y cerrados'}
        </button>
      )}
    </div>
  )
}
