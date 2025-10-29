import React, { useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { formatPrice } from '../utils/currency.js'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

export default function Checkout() {
  const { items, subtotal } = useCart()
  const [placed, setPlaced] = useState(false)

  if (!stripePublishableKey) {
    return (
      <div className="card">
        <h2>Stripe not configured</h2>
        <p>
          Add your publishable key in <code>.env.local</code> at the project root:
        </p>
        <pre style={{background:'#f6f8fa', padding:12, borderRadius:6}}>
{`VITE_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX`}
        </pre>
        <p>Then restart the dev server.</p>
      </div>
    )
  }

  // Warn if using emulator with a live publishable key (mismatch)
  if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === '1' && stripePublishableKey?.startsWith('pk_live_')) {
    return (
      <div className="card">
        <h2>Key mismatch</h2>
        <p>
          You are using the Functions emulator but a <strong>live</strong> publishable key. Use a <code>pk_test_</code> key for testing,
          or disable the emulator by setting <code>VITE_USE_FUNCTIONS_EMULATOR=0</code> in <code>.env.local</code>.
        </p>
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

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm items={items} subtotal={subtotal} onPlaced={() => setPlaced(true)} />
    </Elements>
  )
}

function CheckoutForm({ items, subtotal, onPlaced }) {
  const stripe = useStripe()
  const elements = useElements()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [country, setCountry] = useState('United Kingdom')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!stripe || !elements) return
    if (!Number.isInteger(subtotal) || subtotal <= 0) {
      setError('Your cart is empty or invalid total.')
      return
    }

    setLoading(true)
    try {
      const createPaymentIntent = httpsCallable(functions, 'createPaymentIntent')
      const mode = stripePublishableKey?.startsWith('pk_live_') ? 'live' : 'test'
      const itemsSummary = items.map(i => `${i.product?.name || 'Item'}×${i.qty}`).join(', ').slice(0, 450)
      const res = await createPaymentIntent({ amount: subtotal, currency: 'gbp', mode, itemsSummary, userEmail: email, userName: name })
      const clientSecret = res?.data?.clientSecret
      if (!clientSecret) throw new Error('No client secret returned from server')

      const card = elements.getElement(CardElement)
      if (!card) throw new Error('Card element not ready')

      const { error: confirmErr, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name,
            email,
            address: {
              line1: address,
              city,
              postal_code: postcode,
              country: countryCodeFromName(country) || undefined,
            },
          },
        },
        shipping: {
          name,
          address: {
            line1: address,
            city,
            postal_code: postcode,
            country: countryCodeFromName(country) || undefined,
          },
        },
      })

      if (confirmErr) throw new Error(confirmErr.message || 'Payment failed')
      if (paymentIntent?.status === 'succeeded') onPlaced()
      else throw new Error(`Payment status: ${paymentIntent?.status}`)
    } catch (err) {
      // Surface rich error info from the callable/Stripe to help diagnose
      // eslint-disable-next-line no-console
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
    <div className="field"><label>Email</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="field">
            <label>Card</label>
            <div style={{padding:'.62rem .72rem', border:'1.5px solid var(--border)', borderRadius:9}}>
              <CardElement options={{ hidePostalCode: true }} />
            </div>
          </div>
          {error && <div style={{ color:'crimson', marginTop: 8 }}>{error}</div>}
          <button className="btn" disabled={loading || !stripe}>{loading ? 'Processing…' : `Pay ${formatPrice(subtotal)}`}</button>
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
