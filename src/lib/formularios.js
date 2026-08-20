// ------------------------------------------------------------
// Reglas de alerta de los formularios.
// Se usa tanto al llenar el formulario como al armar el correo,
// así que debe mantenerse igual que la copia de la Edge Function.
// ------------------------------------------------------------

export function respuestaVacia(pregunta) {
  switch (pregunta.tipo) {
    case 'ok_falla':
      return { estado: 'ok', descripcion: '' }
    case 'opciones':
      return { valor: '' }
    case 'numero':
      return { numero: '' }
    case 'texto':
      return { texto: '' }
    default:
      return {}
  }
}

// Devuelve null si no hay alerta, o el motivo en texto si la hay.
export function motivoDeAlerta(pregunta, respuesta) {
  if (!pregunta || !respuesta) return null
  const config = pregunta.config ?? {}

  switch (pregunta.tipo) {
    case 'ok_falla':
      return respuesta.estado === 'falla'
        ? respuesta.descripcion?.trim() || 'Marcado como FALLA'
        : null

    case 'opciones': {
      const elegida = (config.opciones ?? []).find((o) => o.valor === respuesta.valor)
      return elegida?.alerta ? `Se marcó "${elegida.etiqueta}"` : null
    }

    case 'numero': {
      if (respuesta.numero === '' || respuesta.numero == null) return null
      const n = Number(respuesta.numero)
      if (Number.isNaN(n)) return null
      const unidad = config.unidad ? ` ${config.unidad}` : ''
      if (config.alerta_menor_que != null && n < Number(config.alerta_menor_que)) {
        return `Valor ${n}${unidad}, por debajo del mínimo (${config.alerta_menor_que}${unidad})`
      }
      if (config.alerta_mayor_que != null && n > Number(config.alerta_mayor_que)) {
        return `Valor ${n}${unidad}, por encima del máximo (${config.alerta_mayor_que}${unidad})`
      }
      return null
    }

    case 'texto':
      return config.alerta_si_tiene_texto && respuesta.texto?.trim()
        ? respuesta.texto.trim()
        : null

    default:
      return null
  }
}

// Texto legible de lo respondido, para guardar y para el correo.
export function textoDeRespuesta(pregunta, respuesta) {
  const config = pregunta.config ?? {}
  switch (pregunta.tipo) {
    case 'ok_falla':
      return respuesta.estado === 'falla' ? 'FALLA' : 'OK'
    case 'opciones': {
      const elegida = (config.opciones ?? []).find((o) => o.valor === respuesta.valor)
      return elegida?.etiqueta ?? '—'
    }
    case 'numero':
      return respuesta.numero === '' || respuesta.numero == null
        ? '—'
        : `${respuesta.numero}${config.unidad ? ` ${config.unidad}` : ''}`
    case 'texto':
      return respuesta.texto?.trim() || '—'
    default:
      return '—'
  }
}

// ¿La pregunta quedó sin responder?
export function estaSinResponder(pregunta, respuesta) {
  switch (pregunta.tipo) {
    case 'opciones':
      return !respuesta.valor
    case 'numero':
      return respuesta.numero === '' || respuesta.numero == null
    case 'texto':
      return !respuesta.texto?.trim()
    case 'ok_falla':
      return false // siempre parte en OK
    default:
      return false
  }
}
