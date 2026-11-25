import { useState, useEffect } from 'react'
import {
  FlaskConical, Users, Trophy, TrendingUp,
  ShieldCheck, RefreshCw, AlertTriangle
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'

type Variant = {
  key: string
  name: string
  users: number
  conversions: number
  conversion_rate: number | null
  lift: number | null
  chance_to_win: number | null
  ci_low: number | null
  ci_high: number | null
}

type Experiment = {
  name: string
  status: string
  hypothesis: string
  users: number
  conversions: number
  variants: Variant[]
  candidate: Variant | null
  as_of: string
  last_error_at: string | null
  is_final: boolean
}

function percent(value: number | null | undefined) {
  return value == null
    ? '--'
    : `${(value * 100).toFixed(1)}%`
}

export default function Experiments() {
  const [data, setData] = useState<Experiment | null>(null)
  const [risk, setRisk] = useState('UNKNOWN')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    setError('')
    setRisk('UNKNOWN')

    try {
      const response = await fetch(
        'http://127.0.0.1:8080/api/experiments'
      )

      if (!response.ok) {
        throw new Error('Experiment API unavailable')
      }

      setData(await response.json())

      const riskResponse = await fetch(
        'http://127.0.0.1:8080/api/risk'
      )

      if (riskResponse.ok) {
        const result = await riskResponse.json()
        setRisk(result.status || 'UNKNOWN')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const candidate = data?.candidate

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">
            NATIVE FLAGSMITH EXPERIMENTATION
          </span>
          <h2>Experimentation Centre</h2>
          <p>Experiment. Measure. Release safely.</p>
        </div>
        <FlaskConical size={65} />
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <div className="panel-heading">
          <h2>{data?.name || 'Checkout Experiment'}</h2>
          <button className="refresh"
            disabled={loading} onClick={refresh}>
            <RefreshCw size={18} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <p>{data?.hypothesis}</p>
        <p className="muted">
          Status: {data?.status || 'Unknown'}
          {' | '}Synthetic traffic
        </p>
      </section>

      <section className="stats">
        <div className="stat">
          <Users size={24}/>
          <p>Enrolled users</p>
          <h2>{data?.users.toLocaleString() ?? '--'}</h2>
        </div>
        <div className="stat">
          <TrendingUp size={24}/>
          <p>Conversions</p>
          <h2>{data?.conversions.toLocaleString() ?? '--'}</h2>
        </div>
        <div className="stat">
          <Trophy size={24}/>
          <p>Express win probability</p>
          <h2>
            {candidate?.chance_to_win != null &&
             candidate.chance_to_win > 0.99
              ? '>99%'
              : percent(candidate?.chance_to_win)}
          </h2>
        </div>
        <div className="stat">
          <TrendingUp size={24}/>
          <p>Relative conversion lift</p>
          <h2>{percent(candidate?.lift)}</h2>
        </div>
      </section>

      <section className="panel">
        <h2>Conversion Performance</h2>
        <div style={{width: '100%', height: 320}}>
          <ResponsiveContainer>
            <BarChart data={data?.variants || []}>
              <CartesianGrid
                stroke="#263247" strokeDasharray="3 3"/>
              <XAxis dataKey="name" stroke="#94a3b8"/>
              <YAxis domain={[0,100]}
                tickFormatter={v => `${v}%`}
                stroke="#94a3b8"/>
              <Tooltip
                formatter={v => `${v}%`}
                contentStyle={{
                  background: '#111827',
                  border: '1px solid #334155'
                }}
                cursor={{fill: '#1e293b'}}/>
              <Bar dataKey="conversion_rate"
                name="Conversion rate"
                radius={[5,5,0,0]}>
                {(data?.variants || []).map(v => (
                  <Cell key={v.key}
                    fill={v.key === 'control'
                      ? '#6366f1' : '#34d399'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <h2>Native Bayesian Results</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Variation</th>
                <th>Exposures</th>
                <th>Conversions</th>
                <th>Rate</th>
                <th>Relative lift</th>
                <th>95% credible interval</th>
              </tr>
            </thead>
            <tbody>
              {data?.variants.map(v => (
                <tr key={v.key}>
                  <td>{v.name}</td>
                  <td>{v.users}</td>
                  <td>{v.conversions}</td>
                  <td>{v.conversion_rate == null
                    ? '--' : `${v.conversion_rate}%`}</td>
                  <td>{percent(v.lift)}</td>
                  <td>
                    {v.ci_low == null ? 'Baseline / Pending' :
                      `${percent(v.ci_low)} to ${percent(v.ci_high)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="muted">
          Source: Native Flagsmith results
        </p>
        <p className="muted">
          As of: {data?.as_of
            ? new Date(data.as_of).toLocaleString()
            : 'Pending'}
        </p>
        {data?.last_error_at && (
          <p className="muted">
            Flagsmith has reported a computation error.
            Review results before relying on them.
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Intelligent Release Safety Gate</h2>
          <ShieldCheck size={25}/>
        </div>

        <div className="service">
          <span>Experiment candidate</span>
          <span>{candidate?.name || 'Pending'}</span>
        </div>

        <div className="service">
          <span>Historical checkout simulation risk</span>
          <span>{risk}</span>
        </div>

        <div className="service">
          <span>Evidence correlation</span>
          <span>Not verified</span>
        </div>

        <div className="gate-warning">
          <AlertTriangle size={28}/>
          <div>
            <h3>Review required before rollout</h3>
            <p>
              Conversion success alone does not guarantee
              release safety. Experiment data and historical
              risk data come from separate simulations.
              Validate the same release before approval.
            </p>
          </div>
        </div>

        <p className="muted">
          Advisory only. No automatic rollout is executed.
        </p>
      </section>
    </>
  )
}
