import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ESTADOS_CERRADOS } from '../lib/constants'
import { estadoDeCarro, contarAbiertosPorCarro } from '../lib/estadoCarros'

// Semáforo del material mayor. Se usa en Inicio y en Reportes Carros.
export default function EstadoCarros({ compacto = false }) {
  const [carros, setCarros] = useState([])
  const [conteo, setConteo] = useState({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('carros')
        .select('id, codigo, fuera_servicio, nota_estado')
        .eq('activo', true)
        .order('codigo'),
      supabase
        .from('levantamientos')
        .select('id, carro_id, estado')
        .not('estado', 'in', `(${ESTADOS_CERRADOS.join(',')})`)
    ]).then(([{ data: cars }, { data: levs }]) => {
      setCarros(cars ?? [])
      setConteo(contarAbiertosPorCarro(levs ?? []))
      setCargando(false)
    })
  }, [])

  if (cargando) return <p className="cargando">Cargando estado de carros…</p>
  if (carros.length === 0) return <p className="muted">No hay carros registrados.</p>

  return (
    <div className={`grilla-carros ${compacto ? 'compacta' : ''}`}>
      {carros.map((carro) => {
        const abiertos = conteo[carro.id] ?? 0
        const estado = estadoDeCarro(carro, abiertos)
        return (
          <Link
            key={carro.id}
            to={`/reportes-carros?carro=${carro.id}`}
            className="tarjeta-carro"
            style={{ borderTopColor: estado.color }}
          >
            <span className="carro-codigo">{carro.codigo}</span>
            <span className="carro-estado" style={{ color: estado.color }}>
              ● {estado.etiqueta}
            </span>
            <span className="muted-chico">
              {abiertos === 0 ? 'Sin novedades' : `${abiertos} novedad(es) abierta(s)`}
            </span>
            {carro.fuera_servicio && carro.nota_estado && (
              <span className="muted-chico nota-carro">{carro.nota_estado}</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
