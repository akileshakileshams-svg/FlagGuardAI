import { useEffect, useState, useRef } from 'react'
import {
  ShoppingBag, Headphones, Watch, Speaker,
  ShieldCheck, CreditCard, RefreshCw
} from 'lucide-react'
import './App.css'

const API = 'http://127.0.0.1:8080'
const SDK = 'http://127.0.0.1:8081'

type Assignment = {
  identity: string
  variant: 'control' | 'express'
  enrolled: boolean
}

const products = [
  { id: 1, name: 'Studio Headphones', price: 2999, icon: Headphones },
  { id: 2, name: 'Smart Watch', price: 4999, icon: Watch },
  { id: 3, name: 'Bluetooth Speaker', price: 1999, icon: Speaker }
]

function App() {
  const [enabled, setEnabled] = useState(false)
  const [connected, setConnected] = useState(false)
  const [cart, setCart] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'safety' | 'experiment'>('safety')
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [completed, setCompleted] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  async function refresh() {
    try {
      const response = await fetch(`${API}/api/flags/checkout_v2`)
      if (!response.ok) throw new Error()
      const data = await response.json()
      if (typeof data.enabled !== 'boolean') throw new Error()
      setEnabled(data.enabled)
      setConnected(true)
    } catch {
      setConnected(false)
      setEnabled(false)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [])

  async function startExperiment() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setAssignment(null)
    setCompleted(false)
    setMessage('Requesting native Flagsmith assignment...')

    try {
      const response = await fetch(
        `${SDK}/api/experiment/assign`,
        { method: 'POST' }
      )

      const data = await response.json()

      if (!response.ok || !data.enrolled ||
          typeof data.identity !== 'string' ||
          !['control', 'express'].includes(data.variant)) {
        throw new Error(data.error || 'Assignment failed')
      }

      setAssignment(data)
      setMessage('Native experiment assignment successful.')
    } catch {
      setMessage('Experiment unavailable. Start a new demo session to retry.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const express = mode === 'experiment'
    ? assignment?.variant === 'express'
    : enabled

  const total = cart.reduce((sum, id) =>
    sum + (products.find(p => p.id === id)?.price ?? 0), 0)

  async function checkout() {
    if (!cart.length || lock.current) return

    if (mode === 'safety') {
      setMessage('Demo order completed. No real payment was taken.')
      setCart([])
      return
    }

    if (!assignment || completed) return

    lock.current = true
    setBusy(true)

    try {
      const response = await fetch(
        `${SDK}/api/experiment/convert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identity: assignment.identity
          })
        }
      )

      const data = await response.json()

      if (!response.ok || data.status !== 'submitted') {
        throw new Error(data.error || 'Delivery uncertain')
      }

      setCompleted(true)
      setCart([])

      setMessage(data.duplicate
        ? 'Conversion already submitted. Duplicate prevented.'
        : 'Demo checkout completed. Conversion submitted to Flagsmith.')

    } catch {
      setMessage('Conversion delivery uncertain. Retry with the same identity.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <div className="store">
      <header>
        <div className="brand">
          <ShoppingBag size={30} />
          <h2>DemoStore</h2>
        </div>

        <span className={connected ? 'online' : 'offline'}>
          {connected ? 'Flagsmith Connected' : 'Offline - Stable Fallback'}
        </span>

        <button onClick={refresh}>
          <RefreshCw size={17} /> Sync
        </button>
      </header>

      <section className="hero">
        <span>POWERED BY FLAGGUARD AI</span>
        <h1>Upgrade your everyday.</h1>
        <p>Live release safety and native experimentation.</p>
      </section>

      <section className="mode-panel">
        <h3>Select demonstration mode</h3>

        <div className="mode-buttons">
          <button
            disabled={busy}
            className={mode === 'safety' ? 'selected-mode' : ''}
            onClick={() => {
              setMode('safety')
              setMessage('')
            }}>
            Release Safety
          </button>

          <button
            disabled={busy}
            className={mode === 'experiment' ? 'selected-mode' : ''}
            onClick={() => {
              setMode('experiment')
              setMessage('')
            }}>
            A/B Experiment
          </button>
        </div>

        {mode === 'safety' ? (
          <p>Live feature switching and human-approved rollback.</p>
        ) : (
          <div className="experiment-info">
            <h3>Native Flagsmith Experiment</h3>
            <p>Feature: checkout_experiment</p>
            <p>Source: Manual demo test - not production traffic</p>
            <p>Variant: {assignment?.variant ?? 'Not assigned'}</p>
            <p>Identity: {assignment?.identity ?? 'Start a session'}</p>
            <p>Status: {completed ? 'Submitted' : assignment ? 'Enrolled' : 'Not enrolled'}</p>

            <button
              disabled={busy}
              onClick={startExperiment}>
              {assignment ? 'New Demo Customer' : 'Start Experiment Session'}
            </button>
          </div>
        )}
      </section>

      <section className="products">
        {products.map(p => (
          <article key={p.id}>
            <div className="product-image">
              <p.icon size={90} strokeWidth={1.2} />
            </div>
            <h3>{p.name}</h3>
            <h2>INR {p.price.toLocaleString('en-IN')}</h2>
            <button disabled={busy} onClick={() => {
              setCart(old => [...old, p.id])
              setMessage('')
            }}>Add to cart</button>
          </article>
        ))}
      </section>

      <section className={express ? 'checkout express' : 'checkout'}>
        <div className="checkout-title">
          <ShieldCheck size={28} />
          <h2>{express ? 'Express Checkout' : 'Standard Checkout'}</h2>
        </div>

        {mode === 'safety' ? (
          <p>Feature flag: checkout_v2 = {enabled ? 'ON' : 'OFF'}</p>
        ) : (
          <p>Native experiment variant: {assignment?.variant ?? 'Pending'}</p>
        )}

        <p>Items in cart: {cart.length}</p>

        {cart.map((id, index) => (
          <div className="cart-row" key={index}>
            <span>{products.find(p => p.id === id)?.name}</span>
            <button disabled={busy} onClick={() =>
              setCart(old => old.filter((_, i) => i !== index))
            }>Remove</button>
          </div>
        ))}

        <h2>Total: INR {total.toLocaleString('en-IN')}</h2>

        {!express && (
          <div className="fields">
            <input placeholder="Demo name only" />
            <input placeholder="Demo delivery address only" />
            <input placeholder="Demo postal code" />
          </div>
        )}

        {express && <p>Express checkout - fewer steps.</p>}

        <button
          className="pay"
          disabled={
            !cart.length || busy ||
            (mode === 'experiment' && (!assignment || completed))
          }
          onClick={checkout}>
          <CreditCard size={20} />
          {busy ? 'Processing...' : express
            ? 'Place demo order instantly'
            : 'Complete demo order'}
        </button>

        {message && <p className="message" role="status">{message}</p>}
      </section>

      <footer>
        DemoStore - FlagGuard AI - Toggle Wars Track 03
        <p>No real payments or production customer data.</p>
      </footer>
    </div>
  )
}

export default App
