import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const cargarPerfil = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error) setProfile(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      cargarPerfil(data.session?.user?.id).finally(() => setLoading(false))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      cargarPerfil(newSession?.user?.id)
    })

    return () => listener.subscription.unsubscribe()
  }, [cargarPerfil])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password, nombreCompleto) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre_completo: nombreCompleto } }
    })

  const signOut = () => supabase.auth.signOut()

  const esAdmin = profile?.rol === 'admin'
  const esCapitan = profile?.tipo === 'capitan'
  const esTeniente = profile?.tipo === 'teniente'
  // 'oficial' se mantiene por compatibilidad con cuentas antiguas.
  const esOficial = profile?.tipo === 'oficial'
  const esCuartelero = profile?.tipo === 'cuartelero'
  const esVoluntario = !esAdmin && !esCapitan && !esTeniente && !esOficial && !esCuartelero

  // Permisos operativos: asignar, cambiar estado, eliminar, facturas.
  const puedeGestionar = esAdmin || esCapitan || esTeniente || esOficial
  // Editar formularios y sus destinatarios de correo.
  const puedeEditarFormularios = esAdmin || esCapitan

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        esAdmin,
        esCapitan,
        esTeniente,
        esOficial,
        esCuartelero,
        esVoluntario,
        puedeGestionar,
        puedeEditarFormularios,
        signIn,
        signUp,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
