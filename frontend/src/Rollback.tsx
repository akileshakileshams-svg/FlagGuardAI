import { useState, useEffect } from 'react'
import { ShieldCheck, History, AlertTriangle } from 'lucide-react'

const API = 'http://127.0.0.1:8080'

type Risk = {
  status: string
  stable_error_rate?: number
  release_error_rate?: number
  rollback_recommended?: boolean
}

type Audit = {
  id: string
  feature: string
  status: string
  previous_state: string
  new_state: string
  created_at: string
}

export default function Rollback() {
  const [risk, setRisk] = useState<Risk | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [approved, setApproved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Audit[]>([])

  async function refresh() {
    try {
      const responses = await Promise.all([
        fetch(`${API}/api/risk`),
        fetch(`${API}/api/flags/checkout_v2`),
        fetch(`${API}/api/rollback/history`)
      ])

      if (responses.some(r => !r.ok)) {
        throw new Error('Backend unavailable')
      }

      const [r, f, h] = await Promise.all(
        responses.map(res => res.json())
      )

      setRisk(r)
      setEnabled(f.enabled)
      setHistory(Array.isArray(h) ? h : h.value ?? [])
      setError('')
    } catch {
      setError('Unable to load rollback data')
      setEnabled(null)
      setRisk(null)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [])

  async function execute() {
    if (!approved || enabled !== true) return

    if (!window.confirm('Disable checkout_v2 in Development?')) {
      return
    }

    setBusy(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(`${API}/api/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail ?? 'Rollback failed')
      }

      setMessage(data.message)
      setApproved(false)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">RELEASE RECOVERY</span>
          <h2>Safe Rollback Centre</h2>
          <p>Human-approved recovery powered by Flagsmith.</p>
        </div>
        <ShieldCheck size={65} />
      </section>

      {error && <div className="error">{error}</div>}

      <section className="stats">
        <div className="stat">
          <p>Stable V1 failure rate</p>
          <h2>{risk?.stable_error_rate ?? '--'}%</h2>
        </div>
        <div className="stat">
          <p>Express V2 failure rate</p>
          <h2>{risk?.release_error_rate ?? '--'}%</h2>
        </div>
        <div className="stat">
          <p>Simulated risk</p>
          <h2>{risk?.status ?? 'Unknown'}</h2>
        </div>
        <div className="stat">
          <p>Current checkout</p>
          <h2>{enabled === null ? 'Unknown' :
            enabled ? 'V2' : 'V1'}</h2>
        </div>
      </section>

      <section className="panel">
        <h2>Rollback Plan</h2>

        <div className="service">
          <span>Feature</span><span>checkout_v2</span>
        </div>
        <div className="service">
          <span>Current state</span>
          <span>{enabled === null ? 'Unknown' :
            enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div className="service">
          <span>Target state</span><span>Disabled</span>
        </div>

        <p style={{ marginTop: 20 }}>
          This recommendation uses simulated traffic,
          not production customer data.
        </p>

        {enabled === false ? (
          <div className="service">
            <ShieldCheck size={25} />
            Stable checkout already active.
          </div>
        ) : (
          <>
            <label className="approval">
              <input
                type="checkbox"
                checked={approved}
                onChange={e => setApproved(e.target.checked)}
              />
              I approve disabling checkout_v2 in this demo.
            </label>

            <button
              className="refresh"
              onClick={execute}
              disabled={!approved || busy || enabled !== true ||
                !risk?.rollback_recommended}
            >
              <History size={18} />
              {busy ? 'Executing...' : 'Approve & Execute Rollback'}
            </button>
          </>
        )}

        {message && <p className="sim-message">{message}</p>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Rollback Audit History</h2>
          <History size={22} />
        </div>
        {history.length === 0 ? (
          <p>No rollback records yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Previous</th>
                  <th>New state</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.id}>
                    <td>{item.feature}</td>
                    <td>{item.previous_state}</td>
                    <td>{item.new_state}</td>
                    <td>{item.status}</td>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">
          <AlertTriangle size={14} /> Local demo audit trail
        </p>
      </section>
    </>
  )
}
