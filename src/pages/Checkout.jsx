import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { formatPrice } from '../utils/currency.js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

function readEnvSquareConfig() {
  const rawAppId = import.meta.env?.VITE_SQUARE_APPLICATION_ID
  const rawLocationId = import.meta.env?.VITE_SQUARE_LOCATION_ID
  const rawEnvironment = import.meta.env?.VITE_SQUARE_ENVIRONMENT

  const applicationId = typeof rawAppId === 'string' ? rawAppId.trim() : ''
  const locationId = typeof rawLocationId === 'string' ? rawLocationId.trim() : ''
  const environment = (typeof rawEnvironment === 'string' ? rawEnvironment.trim().toLowerCase() : 'sandbox') === 'production'
    ? 'production'
    : 'sandbox'

  if (!applicationId || !locationId) {
    return null
  }

  return { applicationId, locationId, environment }
}

const SQUARE_SCRIPT_URL = {
  production: 'https://web.squarecdn.com/v1/square.js',
  sandbox: 'https://sandbox.web.squarecdn.com/v1/square.js',
}

const squareSdkPromises = {}

function ensureSquareSdk(environment = 'sandbox') {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null)
  }
  const normalized = environment === 'production' ? 'production' : 'sandbox'
  if (window.Square && window.__NS_SQUARE_ENV === normalized) {
    return Promise.resolve(window.Square)
  }
  if (squareSdkPromises[normalized]) {
    return squareSdkPromises[normalized]
  }
  squareSdkPromises[normalized] = new Promise((resolve, reject) => {
    try {
      const existingScripts = Array.from(document.querySelectorAll('script[data-square-sdk]'))
      existingScripts.forEach(script => {
        if (script.dataset.squareSdk !== normalized) {
          script.remove()
        }
      })

      if (window.__NS_SQUARE_ENV && window.__NS_SQUARE_ENV !== normalized) {
        delete window.Square
        window.__NS_SQUARE_ENV = undefined
      }

      const existing = document.querySelector(`script[data-square-sdk="${normalized}"]`)
      if (existing && window.Square) {
        window.__NS_SQUARE_ENV = normalized
        resolve(window.Square)
        return
      }

      const script = document.createElement('script')
      script.src = SQUARE_SCRIPT_URL[normalized] || SQUARE_SCRIPT_URL.sandbox
      script.async = true
      script.dataset.squareSdk = normalized
      script.onload = () => {
        if (window.Square) {
          window.__NS_SQUARE_ENV = normalized
          resolve(window.Square)
        } else {
          script.remove()
          reject(new Error('Square SDK loaded but window.Square missing'))
        }
      }
      script.onerror = () => {
        script.remove()
        reject(new Error('Failed to load Square SDK'))
      }
      document.head.appendChild(script)
    } catch (err) {
      reject(err)
    }
  }).catch(err => {
    delete squareSdkPromises[normalized]
    throw err
  })

  return squareSdkPromises[normalized]
}

export default function Checkout() {
  const { items, subtotal } = useCart()
  const [placed, setPlaced] = useState(false)
  const envSquareConfig = useMemo(() => readEnvSquareConfig(), [])
  const [squareConfig, setSquareConfig] = useState(envSquareConfig)
  const [configLoading, setConfigLoading] = useState(!envSquareConfig)
  const [configError, setConfigError] = useState('')

  const fetchSquareConfig = useCallback(async () => {
    setConfigError('')
    setConfigLoading(true)
    try {
      const callable = httpsCallable(functions, 'getSquarePublicConfig')
      const response = await callable()
      const data = response?.data || response
      const appId = typeof data?.applicationId === 'string' ? data.applicationId.trim() : ''
      const locationId = typeof data?.locationId === 'string' ? data.locationId.trim() : ''
      if (!appId || !locationId) {
        throw new Error('Incomplete Square configuration returned from server.')
      }
      const environment = data?.environment === 'production' ? 'production' : 'sandbox'
      setSquareConfig({ applicationId: appId, locationId, environment })
    } catch (err) {
      console.error('[checkout] Failed to load Square configuration', err)
      setConfigError(err?.message || 'Unable to load payment configuration.')
    } finally {
      setConfigLoading(false)
    }
  }, [functions, setConfigError, setConfigLoading, setSquareConfig])

  useEffect(() => {
    if (squareConfig) {
      setConfigLoading(false)
      return
    }
    fetchSquareConfig()
  }, [squareConfig, fetchSquareConfig])

  if (configLoading) {
    return (
      <div className="card">
        <h2>Preparing checkout…</h2>
        <p className="muted">Loading payment gateway configuration.</p>
      </div>
    )
  }

  if (!squareConfig) {
    return (
      <div className="card">
        <h2>Square not configured</h2>
        <p>
          Provide your Square credentials either as Vite env vars before building or as Firebase Functions secrets:
        </p>
        <pre style={{background:'#f6f8fa', padding:12, borderRadius:6}}>
{`VITE_SQUARE_APPLICATION_ID=...
VITE_SQUARE_LOCATION_ID=...
VITE_SQUARE_ENVIRONMENT=production

firebase functions:secrets:set SQUARE_APPLICATION_ID
firebase functions:secrets:set SQUARE_LOCATION_ID
firebase functions:secrets:set SQUARE_ENVIRONMENT`}
        </pre>
        {configError ? <p style={{ color: 'crimson' }}>{configError}</p> : <p>After updating, redeploy and restart the site.</p>}
        {!configLoading && (
          <button type="button" className="btn" onClick={fetchSquareConfig} style={{ marginTop: '0.75rem' }}>
            Retry loading configuration
          </button>
        )}
      </div>
    )
  }

  if (placed) {
    return (
      <div className="card">
        <h1 className="h1">Order placed</h1>
        <p>Thanks! You'll receive a confirmation email shortly.</p>
      </div>
    )
  }

  return <CheckoutForm items={items} subtotal={subtotal} onPlaced={() => setPlaced(true)} squareConfig={squareConfig} />
}

function CheckoutForm({ items, subtotal, onPlaced, squareConfig }) {
  const { clearCart } = useCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [country, setCountry] = useState('United Kingdom')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [card, setCard] = useState(null)
  const [payments, setPayments] = useState(null)
  const cardInstanceRef = useRef(null)
  const applicationId = squareConfig?.applicationId || ''
  const locationId = squareConfig?.locationId || ''
  const environment = squareConfig?.environment === 'production' ? 'production' : 'sandbox'

  // Initialize Square Web Payments SDK - only once per config
  useEffect(() => {
    if (!applicationId || !locationId) {
      return
    }

    let mounted = true
    let localCardInstance = null

    async function initSquare() {
      console.log('[checkout] initSquare called', { environment, hasCard: Boolean(cardInstanceRef.current) })

      try {
        await ensureSquareSdk(environment)
      } catch (sdkErr) {
        console.error('[checkout] Failed to load Square SDK', sdkErr)
        if (mounted) setError('Payment system failed to load. Please refresh the page.')
        return
      }

      if (!mounted) return

      // Prevent double initialization (React StrictMode/dev or fast refresh)
      if (cardInstanceRef.current || (typeof window !== 'undefined' && window.__NS_SQUARE_CARD_MOUNTED)) {
        console.log('[checkout] Card already initialized, skipping')
        return
      }

      if (!window.Square) {
        console.error('[checkout] Square SDK unavailable after load')
        if (mounted) setError('Payment system failed to load. Please refresh the page.')
        return
      }

      console.log('[checkout] Square SDK loaded, initializing...')
      try {
        const paymentsInstance = window.Square.payments(applicationId, locationId)
        console.log('[checkout] Payments instance created:', paymentsInstance)

        const cardInstance = await paymentsInstance.card()
        console.log('[checkout] Card instance created:', cardInstance)

        const container = document.getElementById('card-container')
        if (container && container.childElementCount > 0) {
          container.innerHTML = ''
        }

        await cardInstance.attach('#card-container')
        console.log('[checkout] Card attached to container')

        cardInstanceRef.current = cardInstance
        localCardInstance = cardInstance
        if (typeof window !== 'undefined') {
          window.__NS_SQUARE_CARD_MOUNTED = true
        }

        if (mounted) {
          setPayments(paymentsInstance)
          setCard(cardInstance)
          console.log('[checkout] Card state updated, card:', cardInstance)
        }
      } catch (e) {
        console.error('[checkout] Failed to initialize Square:', e)
        if (mounted) setError('Failed to initialize payment form. Please refresh the page.')
      }
    }

    initSquare()

    return () => {
      console.log('[checkout] Cleanup running')
      mounted = false
      try {
        const inst = localCardInstance || cardInstanceRef.current
        if (inst && typeof inst.destroy === 'function') {
          inst.destroy()
        }
      } catch (e) {
        // ignore
      }
      try {
        const container = document.getElementById('card-container')
        if (container) container.innerHTML = ''
      } catch {}
      if (typeof window !== 'undefined') {
        window.__NS_SQUARE_CARD_MOUNTED = false
      }
      cardInstanceRef.current = null
    }
  }, [applicationId, locationId, environment])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    
    console.log('[checkout] Submit started', { card, payments })
    
    if (!card || !payments) {
      setError('Payment form not ready. Please wait or refresh the page.')
      return
    }

    if (!locationId) {
      setError('Payment configuration missing. Please refresh the page.')
      return
    }

    if (!Number.isInteger(subtotal) || subtotal <= 0) {
      setError('Your cart is empty or invalid total.')
      return
    }

    setLoading(true)
    try {
      console.log('[checkout] Step 1: Preparing payment...')
      // Step 1: Validate stock and prepare payment data
      const createPayment = httpsCallable(functions, 'createPayment')
      const itemsSummary = items.map(i => `${i.product?.name || 'Item'}×${i.qty}`).join(', ').slice(0, 450)
      const itemsJson = JSON.stringify(items.map(i => ({ productId: i.product?.id || i.productId, qty: i.qty }))).slice(0, 450)
      
      const prepareRes = await createPayment({
        amount: subtotal,
        currency: 'gbp',
        locationId,
        itemsSummary, 
        itemsJson, 
        userEmail: email, 
        userName: name,
        address,
        city,
        postcode,
        countryCode: countryCodeFromName(country) || 'GB',
      })

      console.log('[checkout] Prepare response:', prepareRes)
      if (!prepareRes?.data) throw new Error('Failed to prepare payment')

      console.log('[checkout] Step 2: Tokenizing card...')
      // Step 2: Tokenize the card
      const tokenResult = await card.tokenize()
      console.log('[checkout] Token result:', tokenResult)
      
      if (tokenResult.status === 'OK') {
        console.log('[checkout] Step 3: Processing payment...')
        // Step 3: Process payment with the token
        const processPayment = httpsCallable(functions, 'processSquarePayment')
        const paymentRes = await processPayment({
          sourceId: tokenResult.token,
          amount: subtotal,
          currency: 'GBP',
          locationId,
          itemsSummary,
          itemsJson,
          userEmail: email,
          userName: name,
          address,
          city,
          postcode,
          countryCode: countryCodeFromName(country) || 'GB',
          verificationToken: tokenResult.details?.card?.verificationToken,
        })

        console.log('[checkout] Payment response:', paymentRes)
        if (paymentRes?.data?.status === 'COMPLETED') {
          // Clear the cart now that payment succeeded
          try { clearCart() } catch {}
          onPlaced()
        } else {
          throw new Error(`Payment status: ${paymentRes?.data?.status || 'unknown'}`)
        }
      } else {
        const errorMessages = tokenResult.errors?.map(e => e.message).join(', ') || 'Card tokenization failed'
        throw new Error(errorMessages)
      }
    } catch (err) {
      console.error('[checkout] Error during payment:', err)
      const code = (err?.code || '').replace('functions/', '')
      const details = err?.details || err?.customData?.serverResponse || err?.customData?.message
      const fallback = err?.message || 'Payment failed'
      let msg = fallback
      if (typeof details === 'string') {
        msg = details
      } else if (details && typeof details === 'object' && details.message) {
        msg = details.message
      }
      setError(code ? `${code}: ${msg}` : msg)
    } finally {
      setLoading(false)
      console.log('[checkout] Submit finished')
    }
  }

  return (
    <div className="grid" style={{gridTemplateColumns:'1fr .7fr', gap:'2rem'}}>
      <div className="card">
        <h2>Shipping</h2>
        <form onSubmit={onSubmit}>
          <div className="field"><label>Full name</label><input required value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="field"><label>Address</label><input required value={address} onChange={e=>setAddress(e.target.value)} /></div>
          <div className="field"><label>City</label><input required value={city} onChange={e=>setCity(e.target.value)} /></div>
          <div className="row">
            <div className="field" style={{flex:1}}><label>Postcode</label><input required value={postcode} onChange={e=>setPostcode(e.target.value)} /></div>
            <div className="field" style={{flex:1}}><label>Country</label><input required value={country} onChange={e=>setCountry(e.target.value)} /></div>
          </div>
          <div className="divider" />
          <h2>Payment</h2>
          <p style={{color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1rem'}}>
            💳 Secure payment powered by <strong style={{color: 'var(--primary)'}}>Square</strong>
          </p>
          <div className="field"><label>Email</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="field">
            <label>Card Details</label>
            <div id="card-container" style={{
              padding:'.72rem .82rem', 
              border:'1.5px solid var(--border)', 
              borderRadius:9, 
              minHeight: 56,
              background: 'var(--surface)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
            }}></div>
            <p style={{fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem'}}>
              🔒 Your payment information is encrypted and secure
            </p>
          </div>
          {error && <div style={{ color:'crimson', marginTop: 8 }}>{error}</div>}
          <button 
            type="submit" 
            className="btn" 
            disabled={loading || !card}
            onClick={() => console.log('[checkout] Button clicked! Card state:', card)}
          >
            {loading ? 'Processing…' : `Pay ${formatPrice(subtotal)}`}
          </button>
        </form>
      </div>
      <div className="card">
        <h2>Summary</h2>
        {items.map(i => {
          const name = i.product?.name || 'Item unavailable'
          return (
            <div key={i.key} className="row" style={{justifyContent:'space-between', opacity: i.product ? 1 : 0.75}}>
              <div>{name} {i.artist ? `(with ${i.artist.name})` : '(No Custom Art)'} × {i.qty}</div>
              <div style={{fontWeight:800}}>{formatPrice(i.lineTotal)}</div>
            </div>
          )
        })}
        <div className="divider" />
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>Total</div>
          <div style={{fontWeight:900}}>{formatPrice(subtotal)}</div>
        </div>
      </div>
    </div>
  )
}

function countryCodeFromName(name) {
  if (!name) return null
  const n = name.trim().toLowerCase()
  if (n === 'united kingdom' || n === 'uk' || n === 'great britain' || n === 'gb') return 'GB'
  return null
}
