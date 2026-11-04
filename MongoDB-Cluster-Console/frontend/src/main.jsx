import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

const navItems = ['Dashboard', 'Replica Set', 'Distributed Systems', 'Products', 'Logs']

function useApi(path, interval = null) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [trigger, setTrigger] = useState(0)

  useEffect(() => {
    let mounted = true
    setState(s => ({ ...s, loading: true }))
    fetch(`${API_BASE}${path}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => mounted && setState({ loading: false, data, error: null }))
      .catch((error) => mounted && setState({ loading: false, data: null, error: error.message }))
    
    if (interval) {
      const id = setInterval(() => setTrigger(t => t + 1), interval)
      return () => {
        mounted = false
        clearInterval(id)
      }
    }
    return () => { mounted = false }
  }, [path, trigger])

  return { ...state, refresh: () => setTrigger(t => t + 1) }
}

function Panel({ title, value, detail, color = '#0f172a' }) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelLabel}>{title}</div>
      <div style={{ ...styles.panelValue, color }}>{value}</div>
      {detail ? <div style={styles.panelDetail}>{detail}</div> : null}
    </section>
  )
}

function ReplicaSetView() {
  const rs = useApi('/replicaset/status', 3000)
  
  if (rs.loading && !rs.data) return <div>Loading Replica Set status...</div>
  if (rs.error) return <div style={{color: 'red'}}>Error: {rs.error}</div>

  return (
    <div style={styles.viewContainer}>
      <h2 style={styles.sectionTitle}>Replica Set Status</h2>
      <div style={styles.grid}>
        {rs.data?.members?.map((member, i) => (
          <div key={i} style={{...styles.card, borderTop: `4px solid ${member.state === 'PRIMARY' ? '#10b981' : '#3b82f6'}`}}>
            <h3 style={{marginTop: 0}}>{member.host}</h3>
            <div style={{fontSize: 24, fontWeight: 'bold', color: member.state === 'PRIMARY' ? '#10b981' : '#3b82f6'}}>
              {member.state}
            </div>
            <div style={{marginTop: 8, color: member.health === 1 ? '#10b981' : '#ef4444'}}>
              {member.health === 1 ? '● Healthy' : '○ Unhealthy'}
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 24}}>
        <Panel title="Replica Set Name" value={rs.data?.replicaSet ?? 'N/A'} detail="Configured in MongoDB" />
      </div>
    </div>
  )
}

function ProductsView() {
  const products = useApi('/products')
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [testResult, setTestResult] = useState(null)

  const handleCreate = async () => {
    await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, name, price: parseFloat(price) })
    })
    products.refresh()
  }

  const handleTestRead = async () => {
    const res = await fetch(`${API_BASE}/products/test-read`)
    setTestResult(await res.json())
  }

  const handleTestWrite = async (w) => {
    const res = await fetch(`${API_BASE}/products/test-write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ w })
    })
    setTestResult(await res.json())
  }

  return (
    <div style={styles.viewContainer}>
      <h2 style={styles.sectionTitle}>Product Workload Generator</h2>
      
      <div style={styles.contentGrid}>
        <div style={styles.card}>
          <h3>Insert Product</h3>
          <div style={{display: 'grid', gap: 10}}>
            <input placeholder="SKU" value={sku} onChange={e => setSku(e.target.value)} style={styles.input} />
            <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={styles.input} />
            <input placeholder="Price" type="number" value={price} onChange={e => setPrice(e.target.value)} style={styles.input} />
            <button onClick={handleCreate} style={styles.button}>Insert Product</button>
          </div>

          <h3 style={{marginTop: 24}}>Observability Tests</h3>
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
            <button onClick={handleTestRead} style={{...styles.button, background: '#3b82f6'}}>Test Read</button>
            <button onClick={() => handleTestWrite(1)} style={{...styles.button, background: '#10b981'}}>Test Write (w:1)</button>
            <button onClick={() => handleTestWrite('majority')} style={{...styles.button, background: '#059669'}}>Test Write (w:majority)</button>
          </div>

          {testResult && (
            <div style={{marginTop: 16, padding: 12, background: '#f1f5f9', borderRadius: 8}}>
              <h4>Last Test Result:</h4>
              <pre style={{fontSize: 12}}>{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          )}
        </div>

        <div style={styles.card}>
          <h3>Current Products</h3>
          <div style={{maxHeight: 400, overflowY: 'auto'}}>
            {products.data?.map(p => (
              <div key={p.id} style={{padding: '8px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between'}}>
                <span><strong>{p.sku}</strong> - {p.name}</span>
                <span>${p.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DistributedSystemsView() {
  const topo = useApi('/driver/topology', 5000)
  const rs = useApi('/replicaset/status', 5000)

  return (
    <div style={styles.viewContainer}>
      <h2 style={styles.sectionTitle}>System Topology</h2>
      
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 40}}>
        <div style={styles.topoNode}>Client (Browser)</div>
        <div style={styles.topoArrow}>↓</div>
        <div style={styles.topoNode}>FastAPI Backend</div>
        <div style={styles.topoArrow}>↓</div>
        <div style={{...styles.topoNode, background: '#475569'}}>PyMongo Driver</div>
        <div style={styles.topoArrow}>↓</div>
        <div style={{display: 'flex', gap: 20}}>
          <div style={{...styles.topoNode, background: '#10b981'}}>Primary: {rs.data?.current_primary ?? 'Loading...'}</div>
          <div style={{display: 'grid', gap: 10}}>
             {rs.data?.members?.filter(m => m.state !== 'PRIMARY').map((m, i) => (
               <div key={i} style={{...styles.topoNode, background: '#3b82f6', fontSize: 12, padding: '8px 12px'}}>{m.host}</div>
             ))}
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        <Panel title="Read Preference" value={topo.data?.read_preference ?? 'N/A'} detail="How the driver selects nodes for reads" />
        <Panel title="Write Concern" value={JSON.stringify(topo.data?.write_concern) ?? 'N/A'} detail="Acknowledge level for writes" />
        <Panel title="Connected Nodes" value={topo.data?.connected_nodes?.length ?? 0} detail="Active connections in driver" />
      </div>
    </div>
  )
}

function LogsView() {
  const logs = useApi('/logs', 2000)

  return (
    <div style={styles.viewContainer}>
      <h2 style={styles.sectionTitle}>Infrastructure Logs</h2>
      <div style={styles.card}>
        <div style={styles.logList}>
          <div style={{...styles.logRow, fontWeight: 'bold', background: '#e2e8f0'}}>
            <span>Timestamp</span>
            <span>Type</span>
            <span>Endpoint</span>
            <span>Node Used</span>
            <span>Op</span>
            <span>Time</span>
            <span>Status</span>
          </div>
          {(logs.data?.items ?? []).map((entry, index) => (
            <div key={index} style={styles.logRow}>
              <span style={styles.logTime}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              <span style={{color: entry.type === 'MONGODB' ? '#10b981' : '#6366f1'}}>{entry.type || 'HTTP'}</span>
              <span>{entry.endpoint || entry.path}</span>
              <span style={{fontSize: 11}}>{entry.node || '-'}</span>
              <span>{entry.operation || entry.method}</span>
              <span>{entry.duration_ms}ms</span>
              <span style={{color: entry.success ? '#10b981' : '#ef4444'}}>{entry.success ? 'OK' : 'FAIL'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DashboardView({ info, health, dbInfo, logs }) {
  return (
    <>
      <section style={styles.grid}>
        <Panel title="MongoDB Connection" value={health.data?.mongodb ?? 'Loading'} detail={health.error ?? 'Health signal from /health'} />
        <Panel title="Current Database" value={info.data?.database ?? 'Loading'} detail={dbInfo.data?.uri ?? 'MongoDB target URI'} />
        <Panel title="Hostname" value={info.data?.hostname ?? 'Loading'} detail={info.data?.environment ?? 'Environment'} />
        <Panel title="Database Version" value={info.data?.database_version ?? 'Unknown'} detail={dbInfo.data?.healthy ? 'Reachable' : 'Waiting for connection'} />
        <Panel title="Application Uptime" value={info.data?.uptime_seconds != null ? `${info.data.uptime_seconds}s` : 'Loading'} detail="FastAPI process runtime" />
        <Panel title="API Health" value={health.data?.application ?? 'Loading'} detail={health.data?.current_error ?? 'No current error'} />
      </section>

      <section style={styles.contentGrid}>
        <article style={styles.card}>
          <h3 style={styles.cardTitle}>System Architecture</h3>
          <pre style={styles.codeBlock}>{`Browser (Client)
  ↓
FastAPI (App Server)
  ↓
PyMongo (Driver)
  ↓
MongoDB Replica Set
  ├── Primary (Write/Read)
  ├── Secondary (Read)
  └── Secondary (Read)`}</pre>
        </article>

        <article style={styles.card}>
          <h3 style={styles.cardTitle}>Live Activity</h3>
          <div style={styles.logList}>
            {(logs.data?.items ?? []).slice(0, 8).map((entry, index) => (
              <div key={index} style={{...styles.logRow, gridTemplateColumns: '80px 1fr 60px'}}>
                <span style={styles.logTime}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span>{entry.endpoint || entry.path}</span>
                <span style={{color: entry.success ? '#10b981' : '#ef4444'}}>{entry.success ? 'OK' : 'FAIL'}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  )
}

function App() {
  const [currentView, setCurrentView] = useState('Dashboard')
  const info = useApi('/info', 10000)
  const health = useApi('/health', 5000)
  const dbInfo = useApi('/database/info', 10000)
  const logs = useApi('/logs', 3000)

  const renderView = () => {
    switch (currentView) {
      case 'Replica Set': return <ReplicaSetView />
      case 'Distributed Systems': return <DistributedSystemsView />
      case 'Products': return <ProductsView />
      case 'Logs': return <LogsView />
      default: return <DashboardView info={info} health={health} dbInfo={dbInfo} logs={logs} />
    }
  }

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.kicker}>Distributed Systems Lab</div>
          <h1 style={styles.title}>MongoDB Cluster Console</h1>
        </div>
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <div 
              key={item} 
              style={{...styles.navItem, background: currentView === item ? '#2563eb' : '#111827', cursor: 'pointer'}}
              onClick={() => setCurrentView(item)}
            >
              {item}
            </div>
          ))}
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={{color: '#fff', fontWeight: 'bold'}}>Phase 2</div>
          <div>Distributed Database</div>
          <div>Replica Set Lab</div>
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={styles.kicker}>Operations Dashboard</div>
            <h2 style={styles.sectionTitle}>{currentView}</h2>
          </div>
          <div style={styles.timestamp}>
            {info.data?.timestamp ? `Live Update ${new Date(info.data.timestamp).toLocaleTimeString()}` : 'Connecting...'}
          </div>
        </header>

        {renderView()}
      </main>
    </div>
  )
}

const styles = {
  shell: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily: 'system-ui, sans-serif'
  },
  sidebar: {
    padding: 24,
    borderRight: '1px solid #dbe2ea',
    background: '#0f172a',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  kicker: { fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 },
  title: { fontSize: 24, lineHeight: 1.1, margin: '10px 0 32px' },
  nav: { display: 'grid', gap: 8 },
  navItem: { padding: '12px 16px', borderRadius: 10, border: '1px solid #1f2937', transition: 'all 0.2s', fontSize: 14 },
  sidebarFooter: { fontSize: 12, color: '#64748b', display: 'grid', gap: 4, padding: 16, background: '#111827', borderRadius: 12 },
  main: { padding: 32, display: 'grid', gap: 32, alignContent: 'start', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16 },
  sectionTitle: { margin: '8px 0 0', fontSize: 32, fontWeight: 800 },
  timestamp: { color: '#64748b', fontSize: 13, background: '#f1f5f9', padding: '6px 12px', borderRadius: 20 },
  grid: { display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' },
  panel: { background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' },
  panelLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', fontWeight: 700 },
  panelValue: { fontSize: 28, fontWeight: 800, marginTop: 12 },
  panelDetail: { color: '#64748b', marginTop: 10, fontSize: 14 },
  contentGrid: { display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr' },
  card: { background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  cardTitle: { marginTop: 0, marginBottom: 20, fontSize: 18, fontWeight: 700 },
  codeBlock: { margin: 0, padding: 20, background: '#0f172a', color: '#e2e8f0', borderRadius: 14, overflowX: 'auto', fontSize: 14, lineHeight: 1.6 },
  logList: { display: 'grid', gap: 4 },
  logRow: { display: 'grid', gridTemplateColumns: '80px 60px 140px 1fr 60px 60px 60px', gap: 12, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', fontSize: 12, alignItems: 'center' },
  logTime: { color: '#94a3b8', fontVariantNumeric: 'tabular-nums' },
  input: { padding: '10px 14px', borderRadius: 8, border: '1px solid #dbe2ea', fontSize: 14 },
  button: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' },
  viewContainer: { display: 'grid', gap: 24 },
  topoNode: { padding: '16px 24px', background: '#0f172a', color: 'white', borderRadius: 12, fontWeight: 'bold', minWidth: 150, textAlign: 'center' },
  topoArrow: { fontSize: 24, color: '#94a3b8' }
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
