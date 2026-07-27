import { useState } from 'react'
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const TITULOS = {
  material_mayor: 'Reporte diario · Material mayor',
  equipos_motorizados: 'Reporte diario · Equipos motorizados'
}

export default function ReporteDiario() {
  const { tipo } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [contenido, setContenido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  if (!TITULOS[tipo]) return <Navigate to="/" replace />

  const enviar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    const { error } = await supabase.from('reportes_diarios').insert({
      tipo,
      autor_id: session.user.id,
      contenido: contenido.trim() || null
    })
    setGuardando(false)
    if (error) setError(error.message)
    else {
      setOk(true)
      setContenido('')
    }
  }

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>{TITULOS[tipo]}</h2>
      <p className="muted">
        Formulario en construcción — por ahora puedes dejar una nota de texto libre.
        Más adelante se agregarán los campos definitivos de este reporte.
      </p>

      {ok && (
        <div className="aviso-ok">
          Reporte guardado.
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secundario" onClick={() => setOk(false)}>
              Cargar otro
            </button>
            <button className="btn-primario" onClick={() => navigate('/')}>
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {!ok && (
        <form onSubmit={enviar} className="form">
          <label>
            Nota / observaciones
            <textarea
              rows={6}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Escribe aquí el reporte…"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn-primario" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar reporte'}
          </button>
        </form>
      )}
    </div>
  )
}
