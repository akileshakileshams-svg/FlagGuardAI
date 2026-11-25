import { useState, useEffect, useCallback } from 'react'
import { Activity, AlertTriangle, ShieldCheck, Play, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell
} from 'recharts'

const API = 'http://127.0.0.1:8080'

type Metric = {
  version: string
  requests: number
  failures: number
  successes: number
  error_rate: number
  avg_latency_ms: number
  risk: string
}

type Risk = {
  status: string
  difference_percentage_points?: number
  rollback_recommended?: boolean
  recommendation?: string
}

export default function Monitoring() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [risk, setRisk] = useState<Risk | null>(null)
  const [customers, setCustomers] = useState(500)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [flag, setFlag] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch(`${API}/api/metrics`),
        fetch(`${API}/api/risk`),
        fetch(`${API}/api/flags/checkout_v2`)
      ])

      if (responses.some(r => !r.ok)) {
        throw new Error('Backend request failed')
      }

      const [m, r, f] = await Promise.all(
        responses.map(res => res.json())
      )

      const items = Array.isArray(m) ? m : m.value
      if (!Array.isArray(items)) {
        throw new Error('Invalid metrics response')
      }

      setMetrics(items)
      setRisk(r)
      setFlag(f.enabled)
      setError('')
    } catch {
      setError('Cannot retrieve monitoring data.')
      setFlag(null)
      setRisk(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [refresh])

  async function simulate() {
    setBusy(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(
        `${API}/api/simulate?customers=${customers}`,
        { method: 'POST' }
      )

      if (!response.ok) throw new Error('Simulation failed')

      const result = await response.json()
      setMessage(
        `${result.customers} simulated customers completed on ${result.version}`
      )

      await refresh()
    } catch {
      setError('Simulation failed. Check backend and CORS.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">RELEASE INTELLIGENCE</span>
          <h2>Release Risk Monitor</h2>
          <p>Rule-based analysis of simulated checkout traffic.</p>
        </div>
        <Activity size={65} />
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <div className="panel-heading">
          <h2>Traffic Simulator</h2>
          <span className="off">Simulated data</span>
        </div>

        <p>
          Current checkout: {
            flag === null ? 'Unknown' :
            flag ? 'Express V2' : 'Stable V1'
          }
        </p>

        <div className="sim-controls">
          <input
            type="number"
            min="100"
            max="5000"
            value={customers}
            onChange={e => setCustomers(Number(e.target.value))}
          />

          <button
            className="refresh"
            onClick={simulate}
            disabled={busy || flag === null ||
              customers < 100 || customers > 5000 ||
              !Number.isInteger(customers)}
          >
            <Play size={17} />
            {busy ? 'Simulating...' : 'Run Simulation'}
          </button>

          <button className="refresh" onClick={refresh}>
            <RefreshCw size={17} /> Refresh
          </button>
        </div>

        {message && <p className="sim-message">{message}</p>}
      </section>

      <section className="stats">
        {metrics.map(m => (
          <div className="stat" key={m.version}>
            <Activity size={22} />
            <p>{m.version === 'v1' ? 'Stable V1' : 'Express V2'}</p>
            <h2>{m.error_rate}%</h2>
            <p>{m.requests} simulated requests</p>
            <p>{m.failures} failures</p>
            <p>{m.avg_latency_ms} ms latency</p>
            <span className={m.risk === 'HIGH' ? 'bad' : 'off'}>
              {m.risk}
            </span>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Checkout Failure Rate</h2>

        <div style={{ width: '100%', height: 300, marginTop: 25 }}>
          <ResponsiveContainer>
            <BarChart data={metrics}>
              <CartesianGrid stroke="#29354a" strokeDasharray="3 3" />
              <XAxis dataKey="version" stroke="#94a3b8" />
              <YAxis unit="%" stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="error_rate" name="Failure rate (%)">
                {metrics.map(m => (
                  <Cell
                    key={m.version}
                    fill={m.version === 'v1' ? '#34d399' : '#f87171'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Release Risk Assessment</h2>
          <span className={risk?.status === 'HIGH' ? 'bad' : 'off'}>
            {risk?.status ?? 'UNKNOWN'}
          </span>
        </div>

        {risk?.rollback_recommended ? (
          <div className="risk-alert">
            <AlertTriangle size={35} />
            <div>
              <h2>Rollback Recommended</h2>
              <p>
                New release failure rate exceeds stable release by
                {' '}{risk.difference_percentage_points} percentage points.
              </p>
              <p>Human approval required. No rollback executed.</p>
            </div>
          </div>
        ) : (
          <div className="service">
            <ShieldCheck size={25} />
            {risk?.recommendation ??
              (risk ? 'No critical risk detected.' : 'Risk data unavailable.')}
          </div>
        )}
      </section>
    </>
  )
}
