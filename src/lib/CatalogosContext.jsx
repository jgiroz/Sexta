import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { CATEGORIAS, PRIORIDADES } from './constants'

// ------------------------------------------------------------
// Categorías y prioridades vienen de la base de datos, para que se
// puedan editar desde la aplicación. Si las tablas todavía no existen
// (migración no ejecutada) o están vacías, se usan las listas fijas de
// constants.js como respaldo, así la aplicación nunca queda en blanco.
// ------------------------------------------------------------
const CatalogosContext = createContext(null)

// Las listas de la base traen 'clave'; el resto de la aplicación
// trabaja con 'value', así que se normaliza aquí.
function normalizar(filas) {
  return (filas ?? []).map((f) => ({
    value: f.clave,
    label: f.etiqueta,
    color: f.color,
    pideCarro: f.pide_carro,
    pideSubcategoria: f.pide_subcategoria
  }))
}

export function CatalogosProvider({ children }) {
  const [categorias, setCategorias] = useState(CATEGORIAS)
  const [prioridades, setPrioridades] = useState(PRIORIDADES)
  const [cargado, setCargado] = useState(false)

  const cargar = useCallback(async () => {
    const [{ data: cats }, { data: prios }] = await Promise.all([
      supabase
        .from('categorias_levantamiento')
        .select('clave, etiqueta, pide_carro, pide_subcategoria')
        .eq('activo', true)
        .order('orden'),
      supabase
        .from('prioridades_levantamiento')
        .select('clave, etiqueta, color')
        .eq('activo', true)
        .order('orden')
    ])

    if (cats && cats.length > 0) setCategorias(normalizar(cats))
    if (prios && prios.length > 0) setPrioridades(normalizar(prios))
    setCargado(true)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <CatalogosContext.Provider value={{ categorias, prioridades, cargado, recargar: cargar }}>
      {children}
    </CatalogosContext.Provider>
  )
}

export function useCatalogos() {
  const ctx = useContext(CatalogosContext)
  // Si alguien lo usa fuera del proveedor, devuelve las listas fijas
  // en vez de reventar.
  if (!ctx) {
    return { categorias: CATEGORIAS, prioridades: PRIORIDADES, cargado: false, recargar: () => {} }
  }
  return ctx
}
