import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import NuevoLevantamiento from './pages/NuevoLevantamiento'
import DetalleLevantamiento from './pages/DetalleLevantamiento'

const Dashboard = lazy(() => import('./pages/Dashboard'))

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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div className="pagina cargando">Cargando…</div>}>
                <Dashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}
