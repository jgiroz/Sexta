// ============================================================
// Edge Function: enviar-correo
// Sexta Compañía de Bomberos - notificaciones por correo
//
// Envía por SMTP. Sirve tanto con Gmail (contraseña de aplicación)
// como con la casilla del dominio propio del cuartel: solo cambian
// los secretos SMTP_* en Supabase, el código es el mismo.
//
// Se dispara desde Database Webhooks de Supabase:
//   - INSERT en levantamientos   -> "levantamiento_creado"
//   - UPDATE en levantamientos   -> "levantamiento_cerrado" (solo al pasar a resuelto/cerrado)
//   - INSERT en reportes_diarios -> "reporte_diario"
//
// Arma un PDF con la foto incrustada y lo manda como adjunto.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ------------------------------------------------------------
// Servidor de salida (SMTP).
//
// Por defecto usa Gmail. Para pasar al correo del dominio propio
// basta con cambiar estos secretos en Supabase, sin tocar el código:
//
//   SMTP_HOST      -> mail.sechstela.cl        (lo entrega el hosting)
//   SMTP_PORT      -> 465  (o 587 si el hosting lo indica)
//   SMTP_USUARIO   -> notificaciones@sechstela.cl
//   SMTP_PASSWORD  -> la contraseña de esa casilla
//
// Los nombres antiguos GMAIL_* se siguen aceptando para no romper
// la configuración que ya esté funcionando.
// ------------------------------------------------------------
const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com'
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465')
const SMTP_USUARIO = Deno.env.get('SMTP_USUARIO') ?? Deno.env.get('GMAIL_USUARIO')!
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') ?? Deno.env.get('GMAIL_APP_PASSWORD')!
const NOMBRE_COMPANIA = Deno.env.get('NOMBRE_COMPANIA') ?? 'Sexta Compañía de Bomberos'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

// ------------------------------------------------------------
// Etiquetas (deben coincidir con src/lib/constants.js del front)
// ------------------------------------------------------------
const CATEGORIAS: Record<string, string> = {
  infraestructura: 'Cuartel',
  carro: 'Carro bomba',
  epp: 'EPP',
  otro: 'Otro',
  material_menor: 'Material menor',
  material_motorizado: 'Material motorizado'
}
const SUBCATEGORIAS: Record<string, string> = {
  material_menor: 'Material menor',
  material_motorizado: 'Material motorizado'
}
const ESTADOS: Record<string, string> = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado'
}
const PRIORIDADES: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente'
}
const TIPOS_REPORTE: Record<string, string> = {
  material_mayor: 'Material mayor',
  equipos_motorizados: 'Equipos motorizados'
}

const ESTADOS_CIERRE = ['resuelto', 'cerrado']

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

// Helvetica (WinAnsi) no admite emojis ni caracteres raros.
// Los acentos y la ñ sí, así que solo limpiamos lo que rompería el PDF.
function limpiar(texto: unknown): string {
  if (texto === null || texto === undefined) return ''
  return String(texto).replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
}

function fechaCL(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago' })
  } catch {
    return iso
  }
}

function escaparHtml(texto: unknown): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Parte un texto largo en líneas que quepan en el ancho dado,
// respetando los saltos de línea que traiga el texto original.
function partirLineas(texto: string, fuente: any, tam: number, anchoMax: number): string[] {
  const lineas: string[] = []

  // Importante: se divide por saltos de línea ANTES de limpiar, porque
  // limpiar() elimina el \n al no estar en el rango de caracteres válidos.
  for (const parrafoBruto of String(texto ?? '').split('\n')) {
    const parrafo = limpiar(parrafoBruto)
    if (!parrafo.trim()) {
      lineas.push('') // línea en blanco, para separar bloques
      continue
    }
    const palabras = parrafo.split(/\s+/).filter(Boolean)
    let actual = ''
    for (const palabra of palabras) {
      const intento = actual ? `${actual} ${palabra}` : palabra
      if (fuente.widthOfTextAtSize(intento, tam) > anchoMax && actual) {
        lineas.push(actual)
        actual = palabra
      } else {
        actual = intento
      }
    }
    if (actual) lineas.push(actual)
  }

  return lineas.length ? lineas : ['-']
}

// ------------------------------------------------------------
// Generación del PDF
// ------------------------------------------------------------
type Campo = { etiqueta: string; valor: string }

async function construirPdf(opciones: {
  titulo: string
  subtitulo: string
  campos: Campo[]
  textoLargo?: { etiqueta: string; valor: string }
  fotoUrl?: string | null
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const ANCHO = 595.28
  const ALTO = 841.89
  let pagina = pdf.addPage([ANCHO, ALTO]) // A4

  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)

  const rojo = rgb(0.753, 0.224, 0.169)
  const gris = rgb(0.45, 0.48, 0.5)
  const negro = rgb(0.17, 0.24, 0.31)

  const margen = 50
  const anchoUtil = ANCHO - margen * 2
  let y = ALTO

  // Franja superior
  pagina.drawRectangle({ x: 0, y: ALTO - 70, width: ANCHO, height: 70, color: rojo })
  pagina.drawText(limpiar(NOMBRE_COMPANIA), {
    x: margen,
    y: ALTO - 38,
    size: 16,
    font: negrita,
    color: rgb(1, 1, 1)
  })
  pagina.drawText(limpiar(opciones.subtitulo), {
    x: margen,
    y: ALTO - 56,
    size: 10,
    font: normal,
    color: rgb(1, 1, 1)
  })
  y = ALTO - 100

  const nuevaPaginaSiHaceFalta = (necesario: number) => {
    if (y - necesario < margen) {
      pagina = pdf.addPage([ANCHO, ALTO])
      y = ALTO - margen
    }
  }

  // Título del documento
  for (const linea of partirLineas(opciones.titulo, negrita, 18, anchoUtil)) {
    nuevaPaginaSiHaceFalta(26)
    pagina.drawText(linea, { x: margen, y, size: 18, font: negrita, color: negro })
    y -= 24
  }
  y -= 8

  // Campos etiqueta / valor
  for (const campo of opciones.campos) {
    nuevaPaginaSiHaceFalta(40)
    pagina.drawText(limpiar(campo.etiqueta).toUpperCase(), {
      x: margen,
      y,
      size: 8,
      font: negrita,
      color: gris
    })
    y -= 13
    for (const linea of partirLineas(campo.valor || '-', normal, 11, anchoUtil)) {
      nuevaPaginaSiHaceFalta(16)
      pagina.drawText(linea, { x: margen, y, size: 11, font: normal, color: negro })
      y -= 14
    }
    y -= 6
  }

  // Bloque de texto largo (descripción / contenido del reporte)
  if (opciones.textoLargo) {
    nuevaPaginaSiHaceFalta(46)
    y -= 6
    pagina.drawLine({
      start: { x: margen, y: y + 8 },
      end: { x: ANCHO - margen, y: y + 8 },
      thickness: 0.7,
      color: rgb(0.86, 0.87, 0.89)
    })
    y -= 8
    pagina.drawText(limpiar(opciones.textoLargo.etiqueta).toUpperCase(), {
      x: margen,
      y,
      size: 8,
      font: negrita,
      color: gris
    })
    y -= 15
    for (const linea of partirLineas(opciones.textoLargo.valor || '-', normal, 11, anchoUtil)) {
      nuevaPaginaSiHaceFalta(16)
      // Las líneas vacías solo dejan espacio, no se dibujan.
      if (linea) {
        pagina.drawText(linea, { x: margen, y, size: 11, font: normal, color: negro })
      }
      y -= 15
    }
    y -= 10
  }

  // Foto
  if (opciones.fotoUrl) {
    try {
      const respuesta = await fetch(opciones.fotoUrl)
      if (respuesta.ok) {
        const bytes = new Uint8Array(await respuesta.arrayBuffer())
        let imagen
        try {
          imagen = await pdf.embedJpg(bytes)
        } catch {
          imagen = await pdf.embedPng(bytes)
        }

        const anchoFoto = Math.min(anchoUtil, imagen.width)
        const escala = anchoFoto / imagen.width
        const altoFoto = imagen.height * escala

        if (y - altoFoto - 30 < margen) {
          pagina = pdf.addPage([ANCHO, ALTO])
          y = ALTO - margen
        }

        pagina.drawText('FOTOGRAFIA', { x: margen, y, size: 8, font: negrita, color: gris })
        y -= altoFoto + 10
        pagina.drawImage(imagen, { x: margen, y, width: anchoFoto, height: altoFoto })
        y -= 20
      }
    } catch (err) {
      console.error('No se pudo incrustar la foto en el PDF:', err)
    }
  }

  // Pie
  pagina.drawText(
    limpiar(`Documento generado automaticamente el ${fechaCL(new Date().toISOString())}`),
    { x: margen, y: 30, size: 8, font: normal, color: gris }
  )

  return await pdf.save()
}

// ------------------------------------------------------------
// Envío por SMTP (Gmail o servidor del dominio propio)
// ------------------------------------------------------------
async function enviarCorreo(opciones: {
  destinatarios: string[]
  asunto: string
  html: string
  pdf: Uint8Array
  nombreArchivo: string
}): Promise<{ ok: boolean; detalle: string }> {
  const cliente = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      // 465 usa TLS directo; 587 arranca sin cifrar y lo activa después (STARTTLS).
      tls: SMTP_PORT === 465,
      auth: {
        username: SMTP_USUARIO,
        password: SMTP_PASSWORD
      }
    }
  })

  try {
    await cliente.send({
      from: `${NOMBRE_COMPANIA} <${SMTP_USUARIO}>`,
      to: opciones.destinatarios,
      subject: opciones.asunto,
      content: 'Este correo requiere un lector compatible con HTML.',
      html: opciones.html,
      attachments: [
        {
          filename: opciones.nombreArchivo,
          content: encodeBase64(opciones.pdf),
          encoding: 'base64',
          contentType: 'application/pdf'
        }
      ]
    })
    return { ok: true, detalle: 'enviado' }
  } catch (err) {
    console.error('Error SMTP:', err)
    return { ok: false, detalle: String(err).slice(0, 500) }
  } finally {
    try {
      await cliente.close()
    } catch {
      // la conexión ya podría estar cerrada
    }
  }
}

// ------------------------------------------------------------
// Plantilla HTML del correo
// ------------------------------------------------------------
function plantillaHtml(opciones: {
  encabezado: string
  titulo: string
  campos: Campo[]
  textoLargo?: { etiqueta: string; valor: string }
  fotoUrl?: string | null
}): string {
  const filas = opciones.campos
    .map(
      (c) => `
      <tr>
        <td style="padding:6px 12px 6px 0;color:#7f8c8d;font-size:12px;text-transform:uppercase;white-space:nowrap;vertical-align:top;">${escaparHtml(
          c.etiqueta
        )}</td>
        <td style="padding:6px 0;color:#2c3e50;font-size:14px;">${escaparHtml(c.valor || '-')}</td>
      </tr>`
    )
    .join('')

  const bloqueTexto = opciones.textoLargo
    ? `<div style="margin-top:18px;padding-top:14px;border-top:1px solid #dcdfe3;">
         <div style="color:#7f8c8d;font-size:12px;text-transform:uppercase;margin-bottom:6px;">${escaparHtml(
           opciones.textoLargo.etiqueta
         )}</div>
         <div style="color:#2c3e50;font-size:14px;white-space:pre-wrap;">${escaparHtml(
           opciones.textoLargo.valor || '-'
         )}</div>
       </div>`
    : ''

  const bloqueFoto = opciones.fotoUrl
    ? `<div style="margin-top:18px;">
         <img src="${escaparHtml(
           opciones.fotoUrl
         )}" alt="Fotografia del levantamiento" style="max-width:100%;border-radius:8px;" />
       </div>`
    : ''

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:620px;margin:0 auto;padding:24px 16px;">
      <div style="background:#c0392b;color:#ffffff;padding:18px 20px;border-radius:10px 10px 0 0;">
        <div style="font-size:17px;font-weight:bold;">${escaparHtml(NOMBRE_COMPANIA)}</div>
        <div style="font-size:12px;opacity:0.9;">${escaparHtml(opciones.encabezado)}</div>
      </div>
      <div style="background:#ffffff;padding:22px 20px;border-radius:0 0 10px 10px;">
        <h1 style="margin:0 0 14px;font-size:19px;color:#2c3e50;">${escaparHtml(opciones.titulo)}</h1>
        <table style="width:100%;border-collapse:collapse;">${filas}</table>
        ${bloqueTexto}
        ${bloqueFoto}
        <p style="margin-top:22px;color:#95a5a6;font-size:12px;">
          Se adjunta el detalle en PDF. Este correo se gener&oacute; autom&aacute;ticamente, no responder.
        </p>
      </div>
    </div>
  </body>
</html>`
}

// ------------------------------------------------------------
// Buscar destinatarios configurados
// ------------------------------------------------------------
async function destinatariosLevantamiento(
  categoria: string,
  carroId: string | null
): Promise<string[]> {
  const { data, error } = await supabase
    .from('notificaciones_email')
    .select('email, carro_id')
    .eq('categoria', categoria)

  if (error) {
    console.error('Error buscando destinatarios:', error.message)
    return []
  }

  // Incluye los correos generales de la categoría (carro_id null)
  // y los específicos del carro afectado.
  const correos = (data ?? [])
    .filter((f) => f.carro_id === null || (carroId && f.carro_id === carroId))
    .map((f) => f.email)

  return [...new Set(correos)]
}

async function destinatariosReporte(tipo: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('notificaciones_email')
    .select('email')
    .eq('tipo_reporte', tipo)

  if (error) {
    console.error('Error buscando destinatarios de reporte:', error.message)
    return []
  }
  return [...new Set((data ?? []).map((f) => f.email))]
}

async function nombreDe(perfilId: string | null): Promise<string> {
  if (!perfilId) return 'Sin asignar'
  const { data } = await supabase
    .from('profiles')
    .select('nombre_completo')
    .eq('id', perfilId)
    .single()
  return data?.nombre_completo ?? '-'
}

// Dominios internos que no reciben correo de verdad (cuentas de cuartelero).
const DOMINIOS_INTERNOS = ['.local', '.invalid', '.test', '.example']

function esCorreoEntregable(correo: string | null | undefined): boolean {
  if (!correo) return false
  const limpio = correo.trim().toLowerCase()
  if (!limpio.includes('@')) return false
  return !DOMINIOS_INTERNOS.some((d) => limpio.endsWith(d))
}

// Correo del responsable asignado: primero el "correo de contacto" que
// definió el admin; si no hay, el correo de la cuenta. Las direcciones
// internas se descartan para no generar rebotes.
async function correoDelAsignado(perfilId: string | null): Promise<string[]> {
  if (!perfilId) return []

  const { data: perfil } = await supabase
    .from('profiles')
    .select('email_contacto')
    .eq('id', perfilId)
    .single()

  if (esCorreoEntregable(perfil?.email_contacto)) {
    return [perfil!.email_contacto!.trim()]
  }

  try {
    const { data } = await supabase.auth.admin.getUserById(perfilId)
    const correoCuenta = data?.user?.email
    if (esCorreoEntregable(correoCuenta)) return [correoCuenta!]
    console.log('El asignado no tiene un correo entregable:', correoCuenta)
  } catch (err) {
    console.error('No se pudo leer el correo de la cuenta:', err)
  }

  return []
}

// Las categorias y prioridades se administran desde la aplicacion, asi que
// la etiqueta se busca en la base. Si no aparece, se usan los nombres
// historicos de arriba y, en ultimo caso, la clave tal cual.
async function etiquetaCategoria(clave: string): Promise<string> {
  if (!clave) return '-'
  const { data } = await supabase
    .from('categorias_levantamiento')
    .select('etiqueta')
    .eq('clave', clave)
    .maybeSingle()
  return data?.etiqueta ?? CATEGORIAS[clave] ?? clave
}

async function etiquetaPrioridad(clave: string): Promise<string> {
  if (!clave) return '-'
  const { data } = await supabase
    .from('prioridades_levantamiento')
    .select('etiqueta')
    .eq('clave', clave)
    .maybeSingle()
  return data?.etiqueta ?? PRIORIDADES[clave] ?? clave
}

async function codigoCarro(carroId: string | null): Promise<string> {
  if (!carroId) return 'No aplica'
  const { data } = await supabase.from('carros').select('codigo').eq('id', carroId).single()
  return data?.codigo ?? '-'
}

async function registrarEnvio(
  evento: string,
  referenciaId: string,
  destinatarios: string[],
  ok: boolean,
  detalle: string
) {
  await supabase.from('envios_email').insert({
    evento,
    referencia_id: referenciaId,
    destinatarios,
    ok,
    detalle: detalle.slice(0, 500)
  })
}

// ------------------------------------------------------------
// Manejadores por evento
// ------------------------------------------------------------
async function manejarLevantamiento(fila: any, evento: string) {
  const esCierre = evento === 'levantamiento_cerrado'
  const esAsignacion = evento === 'levantamiento_asignado'

  // Predeterminados de la categoría/carro + el responsable asignado.
  const [predeterminados, correoAsignado] = await Promise.all([
    destinatariosLevantamiento(fila.categoria, fila.carro_id),
    correoDelAsignado(fila.asignado_a)
  ])

  // Se filtra la lista completa. Basta UNA direccion invalida para que
  // varios servidores SMTP rechacen el mensaje entero, dejando sin correo
  // incluso a los destinatarios validos.
  const destinatarios = [...new Set([...predeterminados, ...correoAsignado])].filter(
    esCorreoEntregable
  )

  if (destinatarios.length === 0) {
    console.log('Sin destinatarios entregables para la categoria', fila.categoria)
    return { enviado: false, motivo: 'sin destinatarios entregables' }
  }

  const [reportante, responsable, carro, etqCategoria, etqPrioridad] = await Promise.all([
    nombreDe(fila.reportado_por),
    nombreDe(fila.asignado_a),
    codigoCarro(fila.carro_id),
    etiquetaCategoria(fila.categoria),
    etiquetaPrioridad(fila.prioridad)
  ])

  const encabezado = esCierre
    ? 'Levantamiento resuelto / cerrado'
    : esAsignacion
      ? 'Levantamiento asignado a un responsable'
      : 'Nuevo levantamiento de problema'

  const campos: Campo[] = [
    { etiqueta: 'Estado', valor: ESTADOS[fila.estado] ?? fila.estado },
    { etiqueta: 'Prioridad', valor: etqPrioridad },
    { etiqueta: 'Categoria', valor: etqCategoria },
    ...(fila.subcategoria
      ? [
          {
            etiqueta: 'Tipo de material',
            valor: SUBCATEGORIAS[fila.subcategoria] ?? fila.subcategoria
          }
        ]
      : []),
    { etiqueta: 'Carro', valor: carro },
    { etiqueta: 'Ubicacion', valor: fila.ubicacion || 'No indicada' },
    {
      etiqueta: 'Reportado por',
      // Si viene de una cuenta compartida (tablet del cuartel), se muestra
      // la persona y entre parentesis la cuenta usada.
      valor: fila.reportado_por_nombre
        ? `${fila.reportado_por_nombre} (desde ${reportante})`
        : reportante
    },
    { etiqueta: 'Responsable asignado', valor: responsable },
    { etiqueta: 'Fecha de reporte', valor: fechaCL(fila.creado_at) },
    ...(esCierre ? [{ etiqueta: 'Fecha de cierre', valor: fechaCL(fila.actualizado_at) }] : [])
  ]

  const pdf = await construirPdf({
    titulo: fila.titulo,
    subtitulo: encabezado,
    campos,
    textoLargo: { etiqueta: 'Descripcion', valor: fila.descripcion },
    fotoUrl: fila.foto_url
  })

  const html = plantillaHtml({
    encabezado,
    titulo: fila.titulo,
    campos,
    textoLargo: { etiqueta: 'Descripcion', valor: fila.descripcion },
    fotoUrl: fila.foto_url
  })

  const prefijo = esCierre ? '[Cerrado]' : esAsignacion ? '[Asignado]' : '[Nuevo]'
  const resultado = await enviarCorreo({
    destinatarios,
    asunto: `${prefijo} ${fila.titulo} - ${etqCategoria}${
      carro !== 'No aplica' ? ` (${carro})` : ''
    }`,
    html,
    pdf,
    nombreArchivo: `levantamiento-${String(fila.id).slice(0, 8)}.pdf`
  })

  await registrarEnvio(evento, fila.id, destinatarios, resultado.ok, resultado.detalle)
  return { enviado: resultado.ok, destinatarios, detalle: resultado.detalle }
}

type ItemChecklist = {
  clave?: string
  etiqueta?: string
  estado?: string
  descripcion?: string | null
}

async function manejarReporteDiario(fila: any) {
  const items: ItemChecklist[] = Array.isArray(fila.items) ? fila.items : []
  const fallas = items.filter((i) => i.estado === 'falla')
  const observaciones = (fila.observaciones ?? fila.contenido ?? '').trim()

  // Solo se avisa si hay algo que reportar: alguna falla u observaciones.
  const hayAnomalia = fallas.length > 0 || observaciones.length > 0
  if (!hayAnomalia) {
    console.log('Reporte sin anomalias, no se envia correo')
    return { enviado: false, motivo: 'sin anomalias' }
  }

  const destinatarios = (await destinatariosReporte(fila.tipo)).filter(esCorreoEntregable)
  if (destinatarios.length === 0) {
    console.log('Sin destinatarios entregables para el reporte', fila.tipo)
    return { enviado: false, motivo: 'sin destinatarios entregables' }
  }

  const [autor, carro] = await Promise.all([
    nombreDe(fila.autor_id),
    codigoCarro(fila.carro_id)
  ])

  const etiquetaTipo = TIPOS_REPORTE[fila.tipo] ?? fila.tipo
  const conCarro = carro !== 'No aplica'
  const titulo = conCarro
    ? `Reporte diario ${carro} - ${etiquetaTipo}`
    : `Reporte diario - ${etiquetaTipo}`

  const campos: Campo[] = [
    { etiqueta: 'Tipo de reporte', valor: etiquetaTipo },
    ...(conCarro ? [{ etiqueta: 'Carro', valor: carro }] : []),
    ...(fila.kilometraje != null
      ? [{ etiqueta: 'Kilometraje', valor: `${Number(fila.kilometraje).toLocaleString('es-CL')} km` }]
      : []),
    ...(fila.horas_bomba != null
      ? [{ etiqueta: 'Horas bomba', valor: `${Number(fila.horas_bomba).toLocaleString('es-CL')} h` }]
      : []),
    { etiqueta: 'Realizado por', valor: autor },
    { etiqueta: 'Fecha', valor: fechaCL(fila.creado_at) },
    ...(items.length > 0
      ? [
          {
            etiqueta: 'Resultado de la revision',
            valor:
              fallas.length > 0
                ? `${fallas.length} de ${items.length} item(s) en FALLA`
                : `Los ${items.length} items OK`
          }
        ]
      : [])
  ]

  // Un bloque de texto con el detalle de cada falla y las observaciones.
  const partes: string[] = []
  if (fallas.length > 0) {
    partes.push('FALLAS DETECTADAS:')
    fallas.forEach((f) => {
      partes.push(`- ${f.etiqueta ?? f.clave}: ${f.descripcion ?? 'sin descripcion'}`)
    })
  }
  const itemsOk = items.filter((i) => i.estado === 'ok')
  if (itemsOk.length > 0) {
    partes.push('')
    partes.push(`SIN NOVEDAD: ${itemsOk.map((i) => i.etiqueta ?? i.clave).join(', ')}`)
  }
  if (observaciones) {
    partes.push('')
    partes.push('OBSERVACIONES:')
    partes.push(observaciones)
  }
  const detalle = { etiqueta: 'Detalle', valor: partes.join('\n') }

  const pdf = await construirPdf({
    titulo,
    subtitulo: 'Reporte diario de cuartelero',
    campos,
    textoLargo: detalle
  })

  const html = plantillaHtml({
    encabezado: 'Reporte diario de cuartelero',
    titulo,
    campos,
    textoLargo: detalle
  })

  const resultado = await enviarCorreo({
    destinatarios,
    asunto: `[Reporte diario]${conCarro ? ` ${carro}` : ''} ${etiquetaTipo}${
      fallas.length > 0 ? ` - ${fallas.length} falla(s)` : ''
    } - ${new Date(fila.creado_at).toLocaleDateString('es-CL')}`,
    html,
    pdf,
    nombreArchivo: `reporte-${fila.tipo}-${String(fila.id).slice(0, 8)}.pdf`
  })

  await registrarEnvio('reporte_diario', fila.id, destinatarios, resultado.ok, resultado.detalle)
  return { enviado: resultado.ok, destinatarios, detalle: resultado.detalle }
}

// ------------------------------------------------------------
// Formularios configurables
// ------------------------------------------------------------
type DatoFormulario = {
  seccion?: string
  etiqueta?: string
  tipo?: string
  respuesta?: string
  descripcion?: string | null
  alerta?: boolean
  motivo?: string | null
}

async function manejarFormulario(fila: any) {
  const datos: DatoFormulario[] = Array.isArray(fila.datos) ? fila.datos : []
  const alertas = datos.filter((d) => d.alerta)
  const observaciones = (fila.observaciones ?? '').trim()

  // Solo se avisa si hay algo que reportar.
  if (alertas.length === 0 && !observaciones) {
    console.log('Formulario sin alertas ni observaciones, no se envia correo')
    return { enviado: false, motivo: 'sin novedades' }
  }

  const { data: destData, error: errDest } = await supabase
    .from('formulario_destinatarios')
    .select('email')
    .eq('formulario_id', fila.formulario_id)

  if (errDest) console.error('Error buscando destinatarios del formulario:', errDest.message)

  const destinatarios = [...new Set((destData ?? []).map((d) => d.email))].filter(
    esCorreoEntregable
  )

  if (destinatarios.length === 0) {
    console.log('El formulario no tiene destinatarios entregables')
    return { enviado: false, motivo: 'sin destinatarios entregables' }
  }

  const { data: form } = await supabase
    .from('formularios')
    .select('nombre')
    .eq('id', fila.formulario_id)
    .single()

  const [autor, carro] = await Promise.all([
    nombreDe(fila.autor_id),
    codigoCarro(fila.carro_id)
  ])

  const nombreForm = form?.nombre ?? 'Formulario'
  const conCarro = carro !== 'No aplica'
  const titulo = conCarro ? `${nombreForm} - ${carro}` : nombreForm

  // Los valores medidos (números) se muestran aunque no sean alerta:
  // sirven de contexto para quien lee el correo.
  const medidas = datos.filter((d) => d.tipo === 'numero' && d.respuesta && d.respuesta !== '-')

  const campos: Campo[] = [
    ...(conCarro ? [{ etiqueta: 'Carro', valor: carro }] : []),
    {
      etiqueta: 'Realizado por',
      valor: fila.realizado_por_nombre
        ? `${fila.realizado_por_nombre} (desde ${autor})`
        : autor
    },
    { etiqueta: 'Fecha', valor: fechaCL(fila.creado_at) },
    {
      etiqueta: 'Resultado',
      valor:
        alertas.length > 0
          ? `${alertas.length} alerta(s) de ${datos.length} item(s) revisados`
          : `Sin alertas, ${datos.length} item(s) revisados`
    },
    ...medidas.map((m) => ({ etiqueta: m.etiqueta ?? '-', valor: m.respuesta ?? '-' }))
  ]

  // Detalle agrupado por seccion, para que se lea como la planilla.
  const partes: string[] = []
  if (alertas.length > 0) {
    partes.push('ALERTAS DETECTADAS:')
    let seccionActual = ''
    for (const a of alertas) {
      if (a.seccion && a.seccion !== seccionActual) {
        seccionActual = a.seccion
        partes.push('')
        partes.push(`[${seccionActual}]`)
      }
      partes.push(`- ${a.etiqueta}: ${a.motivo ?? a.respuesta ?? 'sin detalle'}`)
    }
  }
  if (observaciones) {
    partes.push('')
    partes.push('OBSERVACIONES GENERALES:')
    partes.push(observaciones)
  }
  const detalle = { etiqueta: 'Detalle', valor: partes.join('\n') }

  const pdf = await construirPdf({
    titulo,
    subtitulo: 'Control de carro bomba',
    campos,
    textoLargo: detalle
  })

  const html = plantillaHtml({
    encabezado: 'Control de carro bomba',
    titulo,
    campos,
    textoLargo: detalle
  })

  const resultado = await enviarCorreo({
    destinatarios,
    asunto: `[${conCarro ? carro : 'Formulario'}] ${nombreForm}${
      alertas.length > 0 ? ` - ${alertas.length} alerta(s)` : ''
    } - ${new Date(fila.creado_at).toLocaleDateString('es-CL')}`,
    html,
    pdf,
    nombreArchivo: `formulario-${String(fila.id).slice(0, 8)}.pdf`
  })

  await registrarEnvio('formulario', fila.id, destinatarios, resultado.ok, resultado.detalle)
  return { enviado: resultado.ok, destinatarios, detalle: resultado.detalle }
}

// ------------------------------------------------------------
// Punto de entrada
// ------------------------------------------------------------
Deno.serve(async (peticion) => {
  if (peticion.method !== 'POST') {
    return new Response('Metodo no permitido', { status: 405 })
  }

  try {
    const cuerpo = await peticion.json()
    const tabla = cuerpo.table
    const tipo = cuerpo.type
    const fila = cuerpo.record
    const anterior = cuerpo.old_record

    let resultado: unknown = { ignorado: true }

    if (tabla === 'levantamientos' && tipo === 'INSERT') {
      // Los levantamientos que nacen de un reporte diario o de un
      // formulario no mandan correo propio: esos ya envían un único
      // correo resumen con todas las alertas juntas.
      if (fila?.origen === 'reporte_diario' || fila?.origen === 'formulario') {
        resultado = { enviado: false, motivo: `generado por ${fila.origen}` }
      } else {
        resultado = await manejarLevantamiento(fila, 'levantamiento_creado')
      }
    } else if (tabla === 'levantamientos' && tipo === 'UPDATE') {
      const estadoAntes = anterior?.estado
      const estadoAhora = fila?.estado
      const asignadoAntes = anterior?.asignado_a ?? null
      const asignadoAhora = fila?.asignado_a ?? null

      const seCerro = estadoAntes !== estadoAhora && ESTADOS_CIERRE.includes(estadoAhora)
      const seAsigno = asignadoAntes !== asignadoAhora && asignadoAhora !== null

      // El cierre tiene prioridad: si en el mismo guardado se asignó y se
      // cerró, se manda un solo correo de cierre (que ya incluye al asignado).
      if (seCerro) {
        resultado = await manejarLevantamiento(fila, 'levantamiento_cerrado')
      } else if (seAsigno) {
        resultado = await manejarLevantamiento(fila, 'levantamiento_asignado')
      }
    } else if (tabla === 'reportes_diarios' && tipo === 'INSERT') {
      resultado = await manejarReporteDiario(fila)
    } else if (tabla === 'formulario_respuestas' && tipo === 'INSERT') {
      resultado = await manejarFormulario(fila)
    }

    return new Response(JSON.stringify(resultado), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Error en enviar-correo:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
