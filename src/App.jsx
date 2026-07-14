import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import NuevoLevantamiento from './pages/NuevoLevantamiento'
import DetalleLevantamiento from './pages/DetalleLevantamiento'

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
      </Routes>
    </>
  )
}
