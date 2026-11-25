import { useState, useEffect } from 'react'
import {
  History, Activity, ShieldCheck,
  AlertTriangle, RefreshCw
} from 'lucide-react'

type ReplayEvent = {
  id: string
  type: string
  title: string
  description: string
  timestamp: string
  source: string
  error_rate?: number
  latency_ms?: number
}

export default function Replay() {
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)

    try {
      const response = await fetch(
        'http://127.0.0.1:8080/api/replay'
      )

      if (!response.ok) {
        throw new Error('Replay API unavailable')
      }

      const data = await response.json()
      const items = Array.isArray(data) ? data : data.value

      if (!Array.isArray(items)) {
        throw new Error('Invalid replay response')
      }

      setEvents(items)
      setError('')
    } catch {
      setError('Unable to load release history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">RELEASE FORENSICS</span>
          <h2>Safe Release Replay</h2>
          <p>Review recorded simulations and rollback events.</p>
        </div>
        <History size={65} />
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <div className="panel-heading">
          <h2>Release Event Timeline</h2>
          <button className="refresh"
            onClick={refresh} disabled={loading}>
            <RefreshCw size={17} /> Refresh
          </button>
        </div>

        <p className="muted">
          Simulation records and actual management audit
          events are displayed separately by source.
        </p>

        <div className="timeline">
          {events.map(event => (
            <div className="timeline-item" key={event.id}>
              <div className="timeline-icon">
                {event.type === 'SUCCESS' ?
                  <ShieldCheck color="#34d399" /> :
                  event.type === 'SIMULATION' ?
                  <Activity color="#818cf8" /> :
                  <AlertTriangle color="#fbbf24" />}
              </div>

              <div className="timeline-content">
                <span className="eyebrow">
                  {new Date(event.timestamp).toLocaleString()}
                </span>

                <h2>{event.title}</h2>
                <p>{event.description}</p>

                <span className={
                  event.type === 'SUCCESS' ? 'good' : 'off'
                }>
                  {event.type}
                </span>

                <p className="muted">
                  Source: {event.source}
                </p>
              </div>
            </div>
          ))}
        </div>

        {!loading && events.length === 0 &&
          <p>No release events recorded yet.</p>}
      </section>
    </>
  )
}
