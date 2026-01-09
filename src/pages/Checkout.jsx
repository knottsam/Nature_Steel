import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { useCart } from '../context/CartContext.jsx'
import { formatPrice } from '../utils/currency.js'
import { functions, app, configHealth } from '../firebase'
import SEO from '../components/SEO.jsx'
import { trackBeginCheckout } from '../utils/analytics.js'

function readEnvSquareConfig() {
  const rawAppId = import.meta.env?.VITE_SQUARE_APPLICATION_ID
  const rawLocationId = import.meta.env?.VITE_SQUARE_LOCATION_ID
  const rawEnvironment = import.meta.env?.VITE_SQUARE_ENVIRONMENT

  const applicationId = typeof rawAppId === 'string' ? rawAppId.trim() : ''
  const locationId = typeof rawLocationId === 'string' ? rawLocationId.trim() : ''
  const environment =
    (typeof rawEnvironment === 'string' ? rawEnvironment.trim().toLowerCase() : 'sandbox') === 'production'
      ? 'production'
      : 'sandbox'

  if (!applicationId || !locationId) {
    return null
  }

  return { applicationId, locationId, environment }
}

export default function Checkout() {
  const { items, subtotal } = useCart()
  const envSquareConfig = useMemo(() => readEnvSquareConfig(), [])
  const [squareConfig, setSquareConfig] = useState(envSquareConfig)
  const [configLoading, setConfigLoading] = useState(!envSquareConfig)
  const [configError, setConfigError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')

  // Check Firebase configuration
  if (!configHealth.ok) {
    return (
      <div className='card'>
        <h2>Firebase Configuration Error</h2>
        <p>Missing Firebase environment variables:</p>
        <ul>
          {configHealth.missing.map(key => (
            <li key={key}>{key}</li>
          ))}
        </ul>
        <p>Please check your <code>.env.local</code> file and ensure all Firebase configuration is present.</p>
      </div>
    )
  }

  if (!app) {
    return (
      <div className='card'>
        <h2>Firebase Initialization Error</h2>
        <p>Firebase app failed to initialize. Check the browser console for details.</p>
        <p>Common issues:</p>
        <ul>
          <li>Invalid Firebase configuration values</li>
          <li>Missing or incorrect environment variables</li>
          <li>Network connectivity issues</li>
        </ul>
      </div>
    )
  }

  if (!functions) {
    return (
      <div className='card'>
        <h2>Firebase Functions Error</h2>
        <p>Firebase functions failed to initialize. Check the browser console for details.</p>
        <p>This usually means the Firebase app was initialized but functions could not be configured.</p>
      </div>
    )
  }

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
  }, [])

  useEffect(() => {
    if (squareConfig) {
      setConfigLoading(false)
      return
    }
    fetchSquareConfig()
  }, [squareConfig, fetchSquareConfig])

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 0), 0), [items])

  // Track begin checkout
  useEffect(() => {
    if (items.length > 0 && subtotal > 0) {
      trackBeginCheckout(items, subtotal)
    }
  }, [items, subtotal])

  const startHostedCheckout = useCallback(
    async (event) => {
      event.preventDefault()
      setError('')

      if (!Number.isInteger(subtotal) || subtotal <= 0 || totalItems === 0) {
        setError('Your cart is empty or total is invalid.')
        return
      }

      if (!squareConfig) {
        setError('Payment configuration missing. Please refresh the page.')
        return
      }

      setLoading(true)
      try {
        const createLink = httpsCallable(functions, 'createSquareCheckoutLink')
        const itemsSummary = items
          .map((item) => `${item.product?.name || 'Item'} x${item.qty}`)
          .join(', ')
          .slice(0, 450)
        const itemsPayload = JSON.stringify(
          items.map((item) => ({
            productId: item.product?.id || item.productId,
            artistId: item.artist?.id || item.artistId || null,
            material: item.material || null,
            qty: item.qty,
          }))
        ).slice(0, 4500)

        const payload = {
          amount: subtotal,
          currency: 'GBP',
          itemsSummary,
          itemsJson: itemsPayload,
          userEmail: email,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        }

        const response = await createLink(payload)
        const data = response?.data || response
        const checkoutUrl = data?.checkoutUrl || data?.url
        if (!checkoutUrl) {
          throw new Error('Square checkout link missing URL.')
        }
        if (!data?.redirectConfigured) {
          console.warn('[checkout] Square redirect back to this site is not configured (likely due to a non-HTTPS origin).')
        }
        window.location.assign(checkoutUrl)
      } catch (err) {
        console.error('[checkout] createSquareCheckoutLink failed', err)
        const code = (err?.code || '').replace('functions/', '')
        const details =
          typeof err?.details === 'string'
            ? err.details
            : err?.details?.message || err?.message
        const message = details || 'Unable to start Square checkout.'
        setError(code ? `${code}: ${message}` : message)
        setLoading(false)
      }
    },
    [items, subtotal, totalItems, squareConfig, email]
  )

  if (configLoading) {
    return (
      <div className='card'>
        <h2>Preparing checkout...</h2>
        <p className='muted'>Loading payment gateway configuration.</p>
      </div>
    )
  }

  if (!squareConfig) {
    return (
      <div className='card'>
        <h2>Square not configured</h2>
        <p>Provide your Square credentials either as Vite env vars before building or as Firebase Functions secrets:</p>
        <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 6 }}>
{`VITE_SQUARE_APPLICATION_ID=...
VITE_SQUARE_LOCATION_ID=...
VITE_SQUARE_ENVIRONMENT=production

firebase functions:secrets:set SQUARE_APPLICATION_ID
firebase functions:secrets:set SQUARE_LOCATION_ID
firebase functions:secrets:set SQUARE_ENVIRONMENT`}
        </pre>
        {configError ? (
          <p style={{ color: 'crimson' }}>{configError}</p>
        ) : (
          <p>After updating, redeploy and restart the site.</p>
        )}
        <div style={{ marginTop: '0.75rem' }}>
          <button type='button' className='btn' onClick={fetchSquareConfig}>
            Retry loading configuration
          </button>
          <Link to='/cart' style={{ marginLeft: 12 }}>
            Return to cart
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <SEO title='Checkout' description='Secure Square checkout for Nature & Steel Bespoke.' />
      <div className='grid' style={{ gap: '2rem' }}>
        <section className='card'>
          <h2 className='h2'>Contact Email</h2>
          <form onSubmit={startHostedCheckout}>
            <p className='muted'>
              We use this email address to pre-fill Square and send your order updates.
            </p>
            <div className='field'>
              <label>Email</label>
              <input
                required
                type='email'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className='divider' />
            <h2 className='h2'>Payment</h2>
            <p className='muted' style={{ marginBottom: '1rem' }}>
              You will be redirected to a secure Square checkout where you can pay by card, Apple Pay, or Google Pay.
              Square will collect your name and delivery address after the redirect.
            </p>
            {error && (
              <div style={{ color: 'crimson', marginBottom: 12 }}>
                {error}
              </div>
            )}
            <button type='submit' className='btn' disabled={loading || subtotal <= 0 || totalItems === 0}>
              {loading ? 'Redirecting...' : `Continue to Square (${formatPrice(subtotal)})`}
            </button>
            <p className='muted' style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
              Receipts are sent automatically by Square once payment completes.
            </p>
          </form>
        </section>

        <div className='card'>
          <h2 className='h2'>Summary</h2>
          {items.length === 0 && <p className='muted'>Your cart is empty.</p>}
          {items.map((item, index) => {
            const nameLabel = item.product?.name || 'Item unavailable'
            return (
              <div
                key={item.key || item.product?.id || index}
                className='row'
                style={{ justifyContent: 'space-between', opacity: item.product ? 1 : 0.75 }}
              >
                <div>
                  {nameLabel} {item.artist ? `(with ${item.artist.name})` : '(No Custom Art)'} x{item.qty}
                  {item.deliveryCost > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      + {formatPrice(item.deliveryCost * item.qty)} delivery
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 800 }}>{formatPrice(item.lineTotal)}</div>
              </div>
            )
          })}
          <div className='divider' />
          <div className='row' style={{ justifyContent: 'space-between' }}>
            <div>Total</div>
            <div style={{ fontWeight: 900 }}>{formatPrice(subtotal)}</div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Link to='/cart' className='btn ghost'>
              ← Back to Cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
