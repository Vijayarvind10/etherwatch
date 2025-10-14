import React, {useEffect, useMemo, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {connectWS, inferHttpOrigin} from './ws'
import DeviceCard from './DeviceCard'

function App(){
  const [state, setState] = useState({t:0, devices:[]})
  const controllerOrigin = useMemo(()=> inferHttpOrigin(), [])
  const alerts = useMemo(()=> state.devices.filter(d => d.status && d.status !== 'OK'), [state.devices])
  const lastUpdate = state.t ? new Date(state.t).toLocaleTimeString() : '—'

  useEffect(()=>{
    const ws = connectWS('/ws')
    ws.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data)
        setState(msg)
      }catch(e){ console.error(e) }
    }
    return ()=> ws.close()
  },[])

  return (
    <div style={{padding:20,fontFamily:'Arial'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
        <h2 style={{margin:0}}>EtherWatch Dashboard</h2>
        <div style={{fontSize:12,color:'#555'}}>Last update: {lastUpdate}</div>
      </div>
      {alerts.length > 0 && (
        <div style={{marginTop:12,padding:12,borderRadius:8,background:'#fff3cd',border:'1px solid #ffeeba',color:'#856404',fontSize:13}}>
          <strong>{alerts.length}</strong> device{alerts.length>1?'s':''} require attention:&nbsp;
          {alerts.map((d, idx)=> (
            <span key={d.id}>
              {idx>0?', ':''}{d.id} ({d.status})
            </span>
          ))}
        </div>
      )}
      <div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:16}}>
        {state.devices.map(d=> <DeviceCard key={d.id} d={d} controllerOrigin={controllerOrigin} />)}
        {state.devices.length === 0 && (
          <div style={{fontSize:13,color:'#666'}}>Waiting for devices… start an agent to begin streaming telemetry.</div>
        )}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
