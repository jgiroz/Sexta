import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import NuevoLevantamiento from './pages/NuevoLevantamiento'
import DetalleLevantamiento from './pages/DetalleLevantamiento'
import MisTareas from './pages/MisTareas'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const ReporteDiario = lazy(() => import('./pages/ReporteDiario'))
const GestionUsuarios = lazy(() => import('./pages/GestionUsuarios'))
const ConfiguracionCorreos = lazy(() => import('./pages/ConfiguracionCorreos'))

const Cargando = () => <div className="pagina cargando">Cargando…</div>

export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nuevo"
          element={
            <ProtectedRoute>
              <NuevoLevantamiento />
            </ProtectedRoute>
          }
        />
        <Route
          path="/levantamiento/:id"
          element={
            <ProtectedRoute>
              <DetalleLevantamiento />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-tareas"
          element={
            <ProtectedRoute>
              <MisTareas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reporte-diario/:tipo"
          element={
            <ProtectedRoute>
              <Suspense fallback={<Cargando />}>
                <ReporteDiario />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<Cargando />}>
                <Dashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <Suspense fallback={<Cargando />}>
                <GestionUsuarios />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/correos"
          element={
            <ProtectedRoute>
              <Suspense fallback={<Cargando />}>
                <ConfiguracionCorreos />
              </Suspense>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}
