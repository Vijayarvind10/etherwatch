export function inferHttpOrigin() {
  const envOrigin = import.meta.env.VITE_CONTROLLER_ORIGIN?.trim()
  if (envOrigin) return envOrigin
  const {protocol, hostname, port} = window.location
  if (port === '5173' || port === '4173') return `${protocol}//${hostname}:8080`
  return `${protocol}//${hostname}${port ? ':' + port : ''}`
}

function toWsOrigin(origin) {
  if (origin.startsWith('ws://') || origin.startsWith('wss://')) return origin
  if (origin.startsWith('https://')) return `wss://${origin.slice(8)}`
  return `ws://${origin.slice(7)}`
}

export function connectWS(path, callbacks = {}) {
  let ws = null
  let retryDelay = 1000
  const MAX_DELAY = 30000
  let stopped = false

  function connect() {
    if (stopped) return
    const url = `${toWsOrigin(inferHttpOrigin())}${path}`
    ws = new WebSocket(url)
    ws.onopen = e => { retryDelay = 1000; callbacks.onopen?.(e) }
    ws.onmessage = e => callbacks.onmessage?.(e)
    ws.onerror = e => callbacks.onerror?.(e)
    ws.onclose = e => {
      callbacks.onclose?.(e)
      if (!stopped) {
        setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, MAX_DELAY)
      }
    }
  }

  connect()
  return { close() { stopped = true; ws?.close() } }
}
