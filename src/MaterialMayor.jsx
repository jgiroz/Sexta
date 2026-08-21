import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { ESTADOS_CERRADOS } from '../lib/constants'
import { estadoDeCarro, contarAbiertosPorCarro, ESTADO_CARRO } from '../lib/estadoCarros'

// Configuración › Material Mayor
// Aquí el mando marca cada carro como operativo o fuera de servicio.
export default function MaterialMayor() {
  const { session, esCapitan, esTeniente, esAdmin } = useAuth()
  const puedeCambiar = esCapitan || esTeniente || esAdmin

  const [carros, setCarros] = useState([])
  const [conteo, setConteo] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardandoId, setGuardandoId] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: cars, error: errCars }, { data: levs }] = await Promise.all([
      supabase
        .from('carros')
        .select('id, codigo, fuera_servicio, nota_estado, estado_actualizado_at')
        .eq('activo', true)
        .order('codigo'),
      supabase
        .from('levantamientos')
        .select('id, carro_id, estado')
        .not('estado', 'in', `(${ESTADOS_CERRADOS.join(',')})`)
    ])
    if (errCars) setError(errCars.message)
    setCarros(cars ?? [])
    setConteo(contarAbiertosPorCarro(levs ?? []))
    setCargando(false)
  }, [])

  useEffect(() => {
    if (puedeCambiar) cargar()
  }, [puedeCambiar, cargar])

  if (!puedeCambiar) return <Navigate to="/" replace />

  const cambiarEstado = async (carro, fueraServicio) => {
    let nota = carro.nota_estado ?? ''
    if (fueraServicio) {
      const escrita = window.prompt(
        `¿Por qué queda fuera de servicio el ${carro.codigo}?`,
        nota || ''
      )
      if (escrita === null) return
      nota = escrita.trim()
    } else {
      nota = ''
    }

    setGuardandoId(carro.id)
    const { error } = await supabase
      .from('carros')
      .update({
        fuera_servicio: fueraServicio,
        nota_estado: nota || null,
        estado_actualizado_at: new Date().toISOString(),
        estado_actualizado_por: session.user.id
      })
      .eq('id', carro.id)
    setGuardandoId(null)
    if (error) setError(error.message)
    else cargar()
  }

  return (
    <div className="pagina pagina-inicio">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Material Mayor</h2>
      <p className="muted">
        El color naranjo se pone solo cuando el carro tiene novedades abiertas reportadas. El rojo
        lo marcas tú aquí, cuando el carro no puede salir.
      </p>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      <div className="lista">
        {carros.map((carro) => {
          const abiertos = conteo[carro.id] ?? 0
          const estado = estadoDeCarro(carro, abiertos)
          return (
            <div
              key={carro.id}
              className="fila-material"
              style={{ borderLeftColor: estado.color }}
            >
              <div className="fila-material-info">
                <strong className="carro-codigo-grande">{carro.codigo}</strong>
                <span style={{ color: estado.color, fontWeight: 700, fontSize: '0.85rem' }}>
                  ● {estado.etiqueta}
                </span>
                <span className="muted-chico">
                  {abiertos === 0 ? 'Sin novedades abiertas' : `${abiertos} novedad(es) abierta(s)`}
                  {carro.estado_actualizado_at &&
                    ` · actualizado ${new Date(carro.estado_actualizado_at).toLocaleDateString(
                      'es-CL'
                    )}`}
                </span>
                {carro.nota_estado && (
                  <span className="muted-chico nota-carro">Motivo: {carro.nota_estado}</span>
                )}
              </div>

              <div className="fila-material-botones">
                <button
                  className={`chip-estado ${!carro.fuera_servicio ? 'ok-activo' : ''}`}
                  onClick={() => cambiarEstado(carro, false)}
                  disabled={guardandoId === carro.id || !carro.fuera_servicio}
                >
                  Operativo
                </button>
                <button
                  className={`chip-estado ${carro.fuera_servicio ? 'falla-activo' : ''}`}
                  onClick={() => cambiarEstado(carro, true)}
                  disabled={guardandoId === carro.id || carro.fuera_servicio}
                >
                  Fuera de servicio
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="muted-chico" style={{ marginTop: '1rem' }}>
        Referencia: <span style={{ color: ESTADO_CARRO.operativo.color }}>● operativo</span> ·{' '}
        <span style={{ color: ESTADO_CARRO.con_falla.color }}>● con novedades</span> ·{' '}
        <span style={{ color: ESTADO_CARRO.fuera_servicio.color }}>● fuera de servicio</span>
      </p>
    </div>
  )
}
