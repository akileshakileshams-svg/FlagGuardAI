import { useState } from 'react'
import {
  BrainCircuit, ShieldCheck, Sparkles, LoaderCircle
} from 'lucide-react'

type Analysis = {
  model: string
  analysis: string
  source: string
  data_source: string
  advisory_only: boolean
  current_flag_enabled?: boolean
}

export default function AIAnalyst() {
  const [report, setReport] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    setReport(null)

    try {
      const response = await fetch(
        'http://127.0.0.1:8080/api/ai/analyse',
        { method: 'POST' }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'AI request failed')
      }

      setReport(data)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'AI unavailable'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">LOCAL ARTIFICIAL INTELLIGENCE</span>
          <h2>AI Risk Analyst</h2>
          <p>Understand release failures with local AI.</p>
        </div>
        <BrainCircuit size={70} />
      </section>

      <section className="stats">
        <div className="stat">
          <BrainCircuit size={24} />
          <p>AI model</p>
          <h2>Qwen 2B</h2>
        </div>

        <div className="stat">
          <ShieldCheck size={24} />
          <p>Processing</p>
          <h2>Local</h2>
        </div>

        <div className="stat">
          <Sparkles size={24} />
          <p>External API fees</p>
          <h2>INR 0</h2>
        </div>

        <div className="stat">
          <ShieldCheck size={24} />
          <p>Permission</p>
          <h2>Read Only</h2>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Release Intelligence Report</h2>
          <span className="off">Advisory only</span>
        </div>

        <p>
          Generate an AI assessment using recorded simulation
          metrics and the current feature flag state.
        </p>

        <button
          className="refresh"
          style={{marginTop: 20}}
          onClick={generate}
          disabled={loading}
        >
          {loading ?
            <LoaderCircle className="ai-spinner" size={20}/> :
            <Sparkles size={20}/>}
          {loading ? 'Analysing release...' : 'Generate AI Analysis'}
        </button>

        {loading && (
          <p className="muted">
            Local model processing. Response speed depends
            on available system memory and GPU resources.
          </p>
        )}

        {error && (
          <div className="error" style={{marginTop: 20}}>
            {error}
          </div>
        )}

        {report && (
          <div className="ai-report">
            <div className="panel-heading">
              <h2>AI Assessment</h2>
              <span className="good">Generated</span>
            </div>

            {report.analysis.split('\n').map((line, i) =>
              line.trim() ? (
                <p key={i}>
                  {line.replace(/\*\*/g, '')}
                </p>
              ) : null
            )}

            <div className="service">
              <span>Model</span>
              <span>{report.model}</span>
            </div>

            <div className="service">
              <span>Data source</span>
              <span>{report.data_source}</span>
            </div>

            <div className="service">
              <span>Current checkout</span>
              <span>
                {report.current_flag_enabled === undefined ?
                  'Unknown' :
                  report.current_flag_enabled ?
                    'Express V2' : 'Stable V1'}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="service">
          <ShieldCheck size={25} />
          <p>
            AI cannot modify feature flags.
            Rollback requires human approval.
            Reports use simulated data and may contain errors.
          </p>
        </div>
      </section>
    </>
  )
}
