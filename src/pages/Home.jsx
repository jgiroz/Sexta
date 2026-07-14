import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ESTADOS, PRIORIDADES, etiquetaDe, colorDe } from '../lib/constants'
import Badge from '../components/Badge'

export default function Home() {
  const [levantamientos, setLevantamientos] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = async () => {
    setCargando(true)
    let query = supabase
      .from('levantamientos')
      .select('id, titulo, categoria, estado, prioridad, ubicacion, foto_url, creado_at, carros(codigo)')
      .order('creado_at', { ascending: false })

    if (filtroEstado !== 'todos') {
      query = query.eq('estado', filtroEstado)
    }

    const { data, error } = await query
    if (error) setError(error.message)
    else setLevantamientos(data)
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado])

  return (
    <div className="pagina">
      <div className="pagina-header">
        <h2>Levantamientos</h2>
        <Link to="/nuevo" className="btn-primario btn-fab-like">
          + Nuevo
        </Link>
      </div>

      <div className="filtros">
        <button
          className={`chip-filtro ${filtroEstado === 'todos' ? 'activo' : ''}`}
          onClick={() => setFiltroEstado('todos')}
        >
          Todos
        </button>
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            className={`chip-filtro ${filtroEstado === e.value ? 'activo' : ''}`}
            onClick={() => setFiltroEstado(e.value)}
          >
            {e.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {!cargando && levantamientos.length === 0 && (
        <p className="vacio">No hay levantamientos con este filtro.</p>
      )}

      <div className="lista">
        {levantamientos.map((l) => (
          <Link to={`/levantamiento/${l.id}`} key={l.id} className="tarjeta-item">
            {l.foto_url && <img src={l.foto_url} alt="" className="tarjeta-foto" />}
            <div className="tarjeta-contenido">
              <div className="tarjeta-badges">
                <Badge texto={etiquetaDe(ESTADOS, l.estado)} color={colorDe(ESTADOS, l.estado)} />
                <Badge texto={etiquetaDe(PRIORIDADES, l.prioridad)} color={colorDe(PRIORIDADES, l.prioridad)} />
                {l.carros?.codigo && <Badge texto={l.carros.codigo} color="#34495e" />}
              </div>
              <h3>{l.titulo}</h3>
              {l.ubicacion && <p className="muted">📍 {l.ubicacion}</p>}
              <p className="muted-chico">
                {new Date(l.creado_at).toLocaleString('es-CL')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
