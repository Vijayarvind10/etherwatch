export function inferHttpOrigin() {
  const envOrigin = import.meta.env.VITE_CONTROLLER_ORIGIN?.trim()
  if (envOrigin) {
    return envOrigin
  }

  const {protocol, hostname, port} = window.location
  const isViteDefaultPort = port === '5173' || port === '4173'

  if (isViteDefaultPort) {
    // default controller port during local dev
    return `${protocol}//${hostname}:8080`
  }

  const hostPort = port ? `:${port}` : ''
  return `${protocol}//${hostname}${hostPort}`
}

function toWsOrigin(origin) {
  if (origin.startsWith('ws://') || origin.startsWith('wss://')) {
    return origin
  }
  if (origin.startsWith('https://')) {
    return `wss://${origin.slice('https://'.length)}`
  }
  if (origin.startsWith('http://')) {
    return `ws://${origin.slice('http://'.length)}`
  }
  return origin
}

export function connectWS(path){
  const wsOrigin = toWsOrigin(inferHttpOrigin())
  const url = `${wsOrigin}${path}`
  const ws = new WebSocket(url)
  ws.onopen = ()=> console.log('ws open')
  ws.onclose = ()=> console.log('ws close')
  ws.onerror = (e)=> console.error('ws err', e)
  return ws
}
