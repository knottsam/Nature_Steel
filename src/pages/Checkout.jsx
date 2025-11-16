import React, { useState, useEffect, useRef } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { formatPrice } from '../utils/currency.js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

const squareApplicationId = import.meta.env.VITE_SQUARE_APPLICATION_ID
const squareLocationId = import.meta.env.VITE_SQUARE_LOCATION_ID
const squareEnvironment = import.meta.env.VITE_SQUARE_ENVIRONMENT || 'sandbox'

export default function Checkout() {
  const { items, subtotal } = useCart()
  const [placed, setPlaced] = useState(false)

  if (!squareApplicationId || !squareLocationId) {
    return (
      <div className="card">
        <h2>Square not configured</h2>
        <p>
          Add your Square credentials in <code>.env.local</code> at the project root:
        </p>
        <pre style={{background:'#f6f8fa', padding:12, borderRadius:6}}>
{`VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-XXXXXXXXXXXXXXXXXXXXXXXX
VITE_SQUARE_LOCATION_ID=XXXXXXXXXXXXX
VITE_SQUARE_ENVIRONMENT=sandbox`}
        </pre>
        <p>Then restart the dev server.</p>
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

  return <CheckoutForm items={items} subtotal={subtotal} onPlaced={() => setPlaced(true)} />
}

function CheckoutForm({ items, subtotal, onPlaced }) {
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

  // Initialize Square Web Payments SDK - only once
  useEffect(() => {
    console.log('[checkout] useEffect running, cardInstanceRef:', cardInstanceRef.current)
    // Prevent double initialization (React StrictMode/dev or fast refresh)
    if (cardInstanceRef.current || (typeof window !== 'undefined' && window.__NS_SQUARE_CARD_MOUNTED)) {
      console.log('[checkout] Card already initialized, skipping')
      return
    }

    let mounted = true
    let localCardInstance = null

    async function initSquare() {
      console.log('[checkout] initSquare called')
      if (!window.Square) {
        console.error('[checkout] Square.js failed to load')
        if (mounted) setError('Payment system failed to load. Please refresh the page.')
        return
      }

      console.log('[checkout] Square SDK loaded, initializing...')
      try {
        const paymentsInstance = window.Square.payments(squareApplicationId, squareLocationId)
        console.log('[checkout] Payments instance created:', paymentsInstance)
        
        const cardInstance = await paymentsInstance.card()
        console.log('[checkout] Card instance created:', cardInstance)
        
        // If the container already has children, clear it before attaching
        const container = document.getElementById('card-container')
        if (container && container.childElementCount > 0) {
          container.innerHTML = ''
        }

        await cardInstance.attach('#card-container')
        console.log('[checkout] Card attached to container')
        
        // Store in ref to prevent re-initialization
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
        // Prefer local instance; fallback to ref
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
  }, []) // Empty dependency array - run only once

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    
    console.log('[checkout] Submit started', { card, payments })
    
    if (!card || !payments) {
      setError('Payment form not ready. Please wait or refresh the page.')
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
        locationId: squareLocationId,
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
          locationId: squareLocationId,
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
