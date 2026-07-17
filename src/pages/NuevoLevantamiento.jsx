import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, BUCKET_FOTOS } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { CATEGORIAS, SUBCATEGORIAS_CARRO } from '../lib/constants'
import { comprimirImagen } from '../lib/imagen'

export default function NuevoLevantamiento() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [carros, setCarros] = useState([])
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('otro')
  const [subcategoria, setSubcategoria] = useState('')
  const [carroId, setCarroId] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [prioridad, setPrioridad] = useState('media')
  const [foto, setFoto] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [comprimiendo, setComprimiendo] = useState(false)
  const [error, setError] = useState('')

  const esCarro = categoria === 'carro'

  useEffect(() => {
    supabase
      .from('carros')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .then(({ data }) => setCarros(data ?? []))
  }, [])

  const cambiarCategoria = (valor) => {
    setCategoria(valor)
    if (valor !== 'carro') {
      setSubcategoria('')
    }
  }

  const elegirFoto = async (e) => {
    const archivo = e.target.files?.[0] ?? null
    if (!archivo) {
      setFoto(null)
      return
    }
    setComprimiendo(true)
    try {
      const comprimida = await comprimirImagen(archivo)
      setFoto(comprimida)
    } finally {
      setComprimiendo(false)
    }
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    if (esCarro && !carroId) {
      setError('Selecciona el carro cuando la categoría es "Carro bomba".')
      return
    }
    if (esCarro && !subcategoria) {
      setError('Selecciona si es material menor o material motorizado.')
      return
    }

    setEnviando(true)
    try {
      let foto_url = null

      if (foto) {
        const ext = foto.name.split('.').pop()
        const ruta = `${session.user.id}/${Date.now()}.${ext}`
        const { error: errSubida } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(ruta, foto)
        if (errSubida) throw errSubida
        const { data: pub } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta)
        foto_url = pub.publicUrl
      }

      const { data, error: errInsert } = await supabase
        .from('levantamientos')
        .insert({
          titulo,
          descripcion,
          categoria,
          subcategoria: esCarro ? subcategoria : null,
          carro_id: carroId || null,
          ubicacion,
          prioridad,
          foto_url,
          reportado_por: session.user.id
        })
        .select('id')
        .single()

      if (errInsert) throw errInsert
      navigate(`/levantamiento/${data.id}`)
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar el levantamiento')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <h2>Nuevo levantamiento</h2>
      <form onSubmit={enviar} className="form">
        <label>
          Título
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Expansor dañado en su punta"
            required
          />
        </label>

        <label>
          Descripción
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            required
          />
        </label>

        <label>
          Categoría
          <select value={categoria} onChange={(e) => cambiarCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {esCarro && (
          <label>
            Tipo de material
            <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} required>
              <option value="">— Selecciona —</option>
              {SUBCATEGORIAS_CARRO.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          {esCarro ? 'Carro' : 'Carro relacionado (opcional)'}
          <select value={carroId} onChange={(e) => setCarroId(e.target.value)}>
            <option value="">{esCarro ? '— Selecciona el carro —' : '— No aplica —'}</option>
            {carros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre ? `${c.codigo} — ${c.nombre}` : c.codigo}
              </option>
            ))}
          </select>
        </label>

        <label>
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </label>

        <label>
          Ubicación
          <input
            type="text"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Ej: Segundo piso, sala de máquinas"
          />
        </label>

        <label>
          Foto (opcional)
          <input type="file" accept="image/*" onChange={elegirFoto} />
        </label>
        {comprimiendo && <p className="muted-chico">Optimizando imagen…</p>}

        {error && <p className="error">{error}</p>}

        <button className="btn-primario" type="submit" disabled={enviando || comprimiendo}>
          {enviando ? 'Guardando…' : 'Guardar levantamiento'}
        </button>
      </form>
    </div>
  )
}
