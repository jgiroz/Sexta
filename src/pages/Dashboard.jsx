import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const ESTADOS_ABIERTOS = ['pendiente', 'asignado', 'en_progreso']
const ESTADOS_CERRADOS = ['resuelto', 'cerrado']

function claveMes(fechaISO) {
  const d = new Date(fechaISO)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nombreMes(clave) {
  const [anio, mes] = clave.split('-')
  const fecha = new Date(Number(anio), Number(mes) - 1, 1)
  return fecha.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' })
}

export default function Dashboard() {
  const { esAdmin } = useAuth()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('levantamientos')
      .select('id, estado, creado_at, asignado_a, responsable:profiles!levantamientos_asignado_a_fkey(nombre_completo)')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setDatos(data ?? [])
        setCargando(false)
      })
  }, [])

  const pendientesPorUsuario = useMemo(() => {
    const mapa = new Map()
    datos
      .filter((d) => !ESTADOS_CERRADOS.includes(d.estado))
      .forEach((d) => {
        const nombre = d.responsable?.nombre_completo ?? 'Sin asignar'
        mapa.set(nombre, (mapa.get(nombre) ?? 0) + 1)
      })
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }, [datos])

  const porMes = useMemo(() => {
    const mapa = new Map()
    datos.forEach((d) => {
      const clave = claveMes(d.creado_at)
      if (!mapa.has(clave)) mapa.set(clave, { mes: clave, abiertas: 0, cerradas: 0 })
      const fila = mapa.get(clave)
      if (ESTADOS_CERRADOS.includes(d.estado)) fila.cerradas += 1
      else fila.abiertas += 1
    })
    return [...mapa.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((f) => ({ ...f, mesLabel: nombreMes(f.mes) }))
      .slice(-12)
  }, [datos])

  const rankingCierres = useMemo(() => {
    const mapa = new Map()
    datos
      .filter((d) => ESTADOS_CERRADOS.includes(d.estado) && d.responsable?.nombre_completo)
      .forEach((d) => {
        const nombre = d.responsable.nombre_completo
        mapa.set(nombre, (mapa.get(nombre) ?? 0) + 1)
      })
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [datos])

  if (!esAdmin) return <Navigate to="/" replace />
  if (cargando) return <div className="pagina cargando">Cargando…</div>

  return (
    <div className="pagina pagina-dashboard">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Panel de gestión</h2>
      {error && <p className="error">{error}</p>}

      <section className="tarjeta-dashboard">
        <h3>Solicitudes abiertas vs cerradas por mes</h3>
        {porMes.length === 0 ? (
          <p className="muted">Aún no hay datos suficientes.</p>
        ) : (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={porMes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mesLabel" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="abiertas" name="Abiertas" fill="#e67e22" />
                <Bar dataKey="cerradas" name="Cerradas" fill="#27ae60" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="tarjeta-dashboard">
        <h3>Tareas pendientes por usuario</h3>
        {pendientesPorUsuario.length === 0 ? (
          <p className="muted">No hay tareas pendientes. 🎉</p>
        ) : (
          <table className="tabla-simple">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Pendientes</th>
              </tr>
            </thead>
            <tbody>
              {pendientesPorUsuario.map(([nombre, cantidad]) => (
                <tr key={nombre}>
                  <td>{nombre}</td>
                  <td>{cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="tarjeta-dashboard">
        <h3>Voluntarios que más solicitudes cierran</h3>
        {rankingCierres.length === 0 ? (
          <p className="muted">Todavía no hay solicitudes cerradas.</p>
        ) : (
          <table className="tabla-simple">
            <thead>
              <tr>
                <th>#</th>
                <th>Voluntario</th>
                <th>Cerradas</th>
              </tr>
            </thead>
            <tbody>
              {rankingCierres.map(([nombre, cantidad], i) => (
                <tr key={nombre}>
                  <td>{i + 1}</td>
                  <td>{nombre}</td>
                  <td>{cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
