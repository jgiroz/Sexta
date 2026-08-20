import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// El cuartelero elige qué formulario va a llenar.
export default function ElegirFormulario() {
  const [formularios, setFormularios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('formularios')
      .select('id, nombre, descripcion, carros(codigo)')
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setFormularios(data ?? [])
        setCargando(false)
      })
  }, [])

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Control de carro</h2>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}
      {!cargando && formularios.length === 0 && (
        <p className="vacio">
          No hay formularios disponibles. El administrador o el capitán debe crearlos primero.
        </p>
      )}

      <div className="botones-inicio-simple">
        {formularios.map((f) => (
          <Link key={f.id} to={`/formulario/${f.id}`} className="tarjeta-boton-grande">
            📋 {f.nombre}
          </Link>
        ))}
      </div>
    </div>
  )
}
