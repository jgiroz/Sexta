import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) return <div className="cargando">Cargando…</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}
