import React, { useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { formatPrice } from '../utils/currency.js'

export default function Checkout() {
  const { items, subtotal } = useCart()
  const [placed, setPlaced] = useState(false)

  function onSubmit(e) {
    e.preventDefault()
    setPlaced(true)
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
    <div className="grid" style={{gridTemplateColumns:'1fr .7fr', gap:'2rem'}}>
      <div className="card">
        <h2>Shipping</h2>
        <form onSubmit={onSubmit}>
          <div className="field"><label>Full name</label><input required /></div>
          <div className="field"><label>Address</label><input required /></div>
          <div className="field"><label>City</label><input required /></div>
          <div className="row">
            <div className="field" style={{flex:1}}><label>Postcode</label><input required /></div>
            <div className="field" style={{flex:1}}><label>Country</label><input required defaultValue="United Kingdom" /></div>
          </div>
          <div className="divider" />
          <h2>Payment</h2>
          <div className="field"><label>Card number</label><input required placeholder="4242 4242 4242 4242" /></div>
          <div className="row">
            <div className="field" style={{flex:1}}><label>Expiry</label><input required placeholder="MM/YY" /></div>
            <div className="field" style={{flex:1}}><label>CVC</label><input required placeholder="CVC" /></div>
          </div>
          <button className="btn">Place order</button>
        </form>
      </div>
      <div className="card">
        <h2>Summary</h2>
        {items.map(i => (
          <div key={i.key} className="row" style={{justifyContent:'space-between'}}>
            <div>{i.product.name} {i.artist ? `(with ${i.artist.name})` : '(No Custom Art)'} × {i.qty}</div>
            <div style={{fontWeight:800}}>{formatPrice(i.lineTotal)}</div>
          </div>
        ))}
        <div className="divider" />
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>Total</div>
          <div style={{fontWeight:900}}>{formatPrice(subtotal)}</div>
        </div>
      </div>
    </div>
  )
}
