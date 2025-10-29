import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { formatPrice } from '../utils/currency.js'

export default function Cart() {
  const { items, subtotal, removeFromCart, updateQty, cleanupTick } = useCart()
  const [showCleanup, setShowCleanup] = useState(false)

  useEffect(() => {
    if (cleanupTick > 0) {
      setShowCleanup(true)
      const t = setTimeout(() => setShowCleanup(false), 2200)
      return () => clearTimeout(t)
    }
  }, [cleanupTick])
  if (items.length === 0) {
    return (
      <div>
        <h1 className="h1">Your cart</h1>
        <p>It's empty. <Link to="/shop">Browse the shop</Link>.</p>
      </div>
    )
  }
  return (
    <div>
      <h1 className="h1">Your cart</h1>
      {showCleanup && (
        <div style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderLeft: '4px solid #2ea043',
          padding: '0.75rem 1rem',
          borderRadius: 8,
          marginBottom: 12,
          color: 'var(--text)'
        }}>
          Removed unavailable items from your cart.
        </div>
      )}
      <div className="grid" style={{gridTemplateColumns:'1fr .6fr', gap:'2rem'}}>
        <div className="card">
          {items.map(item => {
            const p = item.product
            const img = p?.images?.[0] || p?.imageUrl || ''
            const name = p?.name || 'Item unavailable'
            return (
              <div key={item.key} className="row" style={{justifyContent:'space-between', alignItems:'flex-start', opacity: p ? 1 : 0.75}}>
                <div className="row" style={{alignItems:'center'}}>
                  {img ? (
                    <img src={img} alt={name} style={{width:96, height:96, objectFit:'cover'}} />
                  ) : (
                    <div style={{width:96, height:96, background:'#eee', borderRadius:4}} />
                  )}
                  <div>
                    <div style={{fontWeight:700}}>{name}</div>
                    <div className="muted" style={{fontSize:'.9rem'}}>
                      {item.artist ? `Artist: ${item.artist.name}` : 'No Custom Art'}
                    </div>
                    <div className="muted" style={{fontSize:'.9rem'}}>Unit: {formatPrice(item.unitPrice)}</div>
                  </div>
                </div>
                <div className="row">
                  <input type="number" min="1" value={item.qty} onChange={e => updateQty(item.key, parseInt(e.target.value || '1'))} style={{width:64}} />
                  <div style={{width:110, textAlign:'right', fontWeight:800}}>{formatPrice(item.lineTotal)}</div>
                  <button className="btn ghost" onClick={() => removeFromCart(item.key)}>Remove</button>
                </div>
              </div>
            )
          })}
        </div>
        <div>
          <div className="card">
            <div className="row" style={{justifyContent:'space-between'}}>
              <div>Subtotal</div>
              <div style={{fontWeight:800}}>{formatPrice(subtotal)}</div>
            </div>
            <p className="muted">Shipping and taxes calculated at checkout.</p>
            <Link className="btn block" to="/checkout">Checkout</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
