import Experiments from './Experiments'
import AIAnalyst from './AIAnalyst'
import Replay from './Replay'
import Rollback from './Rollback'
import Monitoring from './Monitoring'
import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, LayoutDashboard, Flag, Activity,
  History, FlaskConical, Users, Settings,
  RefreshCw, CheckCircle2, AlertTriangle,
  Server, ExternalLink
} from 'lucide-react'
import './App.css'

type FeatureFlag = {
  id: number
  feature: {
    name: string
    description: string
    type: string
  }
  enabled: boolean
  feature_state_value: string | null
}

const API = 'http://127.0.0.1:8080'

function App() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [backend, setBackend] = useState(false)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState('Overview')
  const [updated, setUpdated] = useState('Not synced')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const health = await fetch(`${API}/health`)
      setBackend(health.ok)
    } catch {
      setBackend(false)
    }

    try {
      const response = await fetch(`${API}/api/flags`)
      if (!response.ok) throw new Error('Flagsmith unavailable')

      const data = await response.json()
      const items = Array.isArray(data) ? data : data.value

      if (!Array.isArray(items)) {
        throw new Error('Unexpected API response')
      }

      setFlags(items)
      setConnected(true)
      setUpdated(new Date().toLocaleTimeString())
    } catch {
      setConnected(false)
      setError('Unable to connect to Flagsmith. Check your backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, 15000)
    return () => clearInterval(timer)
  }, [refresh])

  const enabled = flags.filter(f => f.enabled).length

  const menu = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Feature Flags', icon: Flag },
    { name: 'Monitoring', icon: Activity },
    { name: 'Safe Rollback', icon: History },
    { name: 'Release Replay', icon: History },
    { name: 'AI Analyst', icon: Activity },
    { name: 'Experiments', icon: FlaskConical },
    { name: 'Simulator', icon: Users },
    { name: 'Settings', icon: Settings }
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={34} />
          <div>
            <h2>FlagGuard AI</h2>
            <span>Release Intelligence</span>
          </div>
        </div>

        <div className="menu-label">WORKSPACE</div>

        <nav>
          {menu.map(item => (
            <button
              key={item.name}
              className={page === item.name ? 'nav active' : 'nav'}
              onClick={() => setPage(item.name)}
            >
              <item.icon size={19} />
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="dot" />
          Self-hosted workspace
          <small>Toggle Wars - Track 03</small>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <span className="eyebrow">DEVELOPMENT ENVIRONMENT</span>
            <h1>{page}</h1>
            <p>Ship smarter. Release with confidence.</p>
          </div>

          <button className="refresh" onClick={refresh} disabled={loading}>
            <RefreshCw size={17} />
            {loading ? 'Syncing...' : 'Refresh'}
          </button>
        </header>

        {error && (
          <div className="error">
            <AlertTriangle size={20} /> {error}
          </div>
        )}

        {(page === 'Overview' || page === 'Feature Flags') && (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow">RELEASE SAFETY PLATFORM</span>
                <h2>Your releases. Under control.</h2>
                <p>Monitor live feature flags powered by Flagsmith.</p>
              </div>
              <ShieldCheck size={78} />
            </section>

            <section className="stats">
              {[
                { label: 'Total flags', value: connected ? flags.length : '--', icon: Flag },
                { label: 'Enabled flags', value: connected ? enabled : '--', icon: CheckCircle2 },
                { label: 'Disabled flags', value: connected ? flags.length - enabled : '--', icon: Activity },
                { label: 'Risk monitoring', value: 'Pending', icon: AlertTriangle }
              ].map(item => (
                <div className="stat" key={item.label}>
                  <item.icon size={22} />
                  <p>{item.label}</p>
                  <h2>{item.value}</h2>
                </div>
              ))}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>Live Feature Flags</h2>
                <span className={connected ? 'good' : 'bad'}>
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connected && flags.map(flag => (
                      <tr key={flag.id}>
                        <td>
                          <strong>{flag.feature.name}</strong>
                          <small>{flag.feature.description}</small>
                        </td>
                        <td>{flag.feature.type}</td>
                        <td>
                          <span className={flag.enabled ? 'good' : 'off'}>
                            {flag.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {connected && flags.length === 0 && <p>No flags found.</p>}
              <p className="muted">Last successful sync: {updated}</p>
            </section>
          </>
        )}

        {(page === 'Overview' || page === 'Settings') && (
          <section className="panel">
            <h2>System Health</h2>
            {[
              { name: 'FastAPI Backend', ok: backend },
              { name: 'Flagsmith API', ok: connected }
            ].map(service => (
              <div className="service" key={service.name}>
                <Server size={19} />
                <span>{service.name}</span>
                <span className={service.ok ? 'good' : 'bad'}>
                  {service.ok ? 'Online' : 'Offline'}
                </span>
              </div>
            ))}

            <a href="http://localhost:8000" target="_blank" rel="noreferrer">
              Open Flagsmith <ExternalLink size={14} />
            </a>
          </section>
        )}

        {(page === 'Monitoring' || page === 'Simulator') && <Monitoring />}
        {page === 'Safe Rollback' && <Rollback />}
        {page === 'Release Replay' && <Replay />}
        {page === 'AI Analyst' && <AIAnalyst />}
        {page === 'Experiments' && <Experiments />}
        {!['Overview', 'Feature Flags', 'Settings', 'Monitoring', 'Simulator', 'Safe Rollback', 'Release Replay', 'AI Analyst', 'Experiments'].includes(page) && (
          <section className="panel placeholder">
            <ShieldCheck size={48} />
            <h2>{page}</h2>
            <p>This module is not implemented yet.</p>
          </section>
        )}
      </main>
    </div>
  )
}

export default App





