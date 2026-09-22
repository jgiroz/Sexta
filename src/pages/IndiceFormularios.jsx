import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// Formularios: índice con los dos tipos que se pueden configurar.
export default function IndiceFormularios() {
  const { puedeEditarFormularios } = useAuth()
  if (!puedeEditarFormularios) return <Navigate to="/" replace />

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Formularios</h2>
      <p className="muted">
        Desde aquí cambias lo que pregunta cada formulario sin depender de nadie.
      </p>

      <div className="botones-inicio-simple">
        <Link to="/formularios/carros" className="tarjeta-boton-grande">
          🚒 Reporte diario material mayor
          <span className="muted-chico">
            Ítems por carro, alertas y destinatarios de correo
          </span>
        </Link>
        <Link to="/formularios/levantamientos" className="tarjeta-boton-grande">
          🧯 Levantamientos
          <span className="muted-chico">Categorías, carros y prioridades</span>
        </Link>
      </div>
    </div>
  )
}
