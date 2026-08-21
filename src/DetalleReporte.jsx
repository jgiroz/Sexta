import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// Vista completa de un reporte enviado.
// El botón de imprimir abre el diálogo del navegador, donde se puede
// elegir "Guardar como PDF". Así no hace falta cargar una librería
// de PDF en la aplicación.
export default function DetalleReporte() {
  const { id } = useParams()
  const [reporte, setReporte] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('formulario_respuestas')
      .select(
        'id, creado_at, total_alertas, observaciones, datos, fotos, carros(codigo), formularios(nombre), autor:profiles(nombre_completo)'
      )
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setReporte(data)
        setCargando(false)
      })
  }, [id])

  if (cargando) return <div className="pagina cargando">Cargando…</div>
  if (error) return <div className="pagina error">{error}</div>
  if (!reporte) return <div className="pagina">Reporte no encontrado.</div>

  const datos = reporte.datos ?? []
  const fotos = reporte.fotos ?? []

  // Se agrupa por sección, respetando el orden en que se guardó.
  const secciones = []
  datos.forEach((d) => {
    const titulo = d.seccion || 'Sin sección'
    let grupo = secciones.find((s) => s.titulo === titulo)
    if (!grupo) {
      grupo = { titulo, items: [] }
      secciones.push(grupo)
    }
    grupo.items.push(d)
  })

  return (
    <div className="pagina pagina-inicio zona-imprimible">
      <div className="no-imprimir">
        <Link to="/reportes-carros" className="btn-link">
          ← Volver a reportes
        </Link>
      </div>

      <div className="cabecera-reporte">
        <div>
          <h2>{reporte.formularios?.nombre ?? 'Reporte'}</h2>
          <p className="muted-chico">
            {reporte.carros?.codigo ? `Carro ${reporte.carros.codigo} · ` : ''}
            {new Date(reporte.creado_at).toLocaleString('es-CL')} ·{' '}
            {reporte.autor?.nombre_completo ?? '—'}
          </p>
        </div>
        <button className="btn-secundario no-imprimir" onClick={() => window.print()}>
          🖨 Imprimir / Guardar PDF
        </button>
      </div>

      <p className={reporte.total_alertas > 0 ? 'aviso-atencion' : 'aviso-ok'}>
        {reporte.total_alertas > 0
          ? `⚠ ${reporte.total_alertas} alerta(s) detectada(s) en este control.`
          : 'Sin alertas: todos los ítems conformes.'}
      </p>

      {secciones.map((seccion) => (
        <section key={seccion.titulo} className="bloque-seccion">
          <h3>{seccion.titulo}</h3>
          <table className="tabla-simple">
            <tbody>
              {seccion.items.map((item, i) => (
                <tr key={i} className={item.alerta ? 'fila-con-alerta' : ''}>
                  <td style={{ width: '45%' }}>{item.etiqueta}</td>
                  <td style={{ width: '20%', fontWeight: 700 }}>
                    {item.alerta && '⚠ '}
                    {item.respuesta}
                  </td>
                  <td className="muted-chico">{item.descripcion ?? item.motivo ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {reporte.observaciones && (
        <section className="bloque-seccion">
          <h3>OBSERVACIONES GENERALES</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{reporte.observaciones}</p>
        </section>
      )}

      {fotos.length > 0 && (
        <section className="bloque-seccion">
          <h3>FOTOGRAFÍAS</h3>
          <div className="galeria-fotos">
            {fotos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="miniatura-grande">
                <img src={url} alt={`Foto ${i + 1}`} />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
