import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { formatPrice } from '../utils/currency.js'
import SEO from '../components/SEO.jsx'
import { trackViewCart } from '../utils/analytics.js'

export default function Cart() {
  const { items, subtotal, removeFromCart, updateQty, cleanupTick } = useCart()
  const [showCleanup, setShowCleanup] = useState(false)

  // Calculate totals
  const totalItemCost = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
  const totalDeliveryCost = items.reduce((sum, item) => sum + (item.deliveryCost || 0) * item.qty, 0)

  useEffect(() => {
    if (cleanupTick > 0) {
      setShowCleanup(true)
      const t = setTimeout(() => setShowCleanup(false), 2200)
      return () => clearTimeout(t)
    }
  }, [cleanupTick])

  // Track cart view
  useEffect(() => {
    if (items.length > 0) {
      trackViewCart(items, subtotal)
    }
  }, [items, subtotal])

  if (items.length === 0) {
    return (
      <div>
        <h1 className="h1">Your cart</h1>
        <p>It's empty. <Link to="/shop">Browse the shop</Link>.</p>
      </div>
    )
  }
  return (
    <>
      <SEO
        title="Shopping Cart | Nature & Steel Bespoke"
        description="Review your cart and proceed to secure checkout for your custom handcrafted furniture and bespoke art pieces from Nature & Steel Bespoke."
      />
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
      <div className="grid cart-grid">
        <div className="card cart-items-card">
          {items.map(item => {
            const p = item.product
            const img = p?.images?.[0] || p?.imageUrl || ''
            const name = p?.name || 'Item unavailable'
            return (
              <div key={item.key} className="cart-item" style={{marginBottom:'1rem', opacity: p ? 1 : 0.75}}>
                <div className="cart-item-inner row" style={{alignItems:'center'}}>
                  {img ? (
                    <img src={img} alt={name} style={{width:96, height:96, objectFit:'cover'}} loading="lazy" />
                  ) : (
                    <div style={{width:96, height:96, background:'#eee', borderRadius:4}} />
                  )}
                  <div>
                    <div style={{fontWeight:700}}>{name}</div>
                    {item.artist && (
                      <div className="muted" style={{fontSize:'.9rem'}}>
                        Artist: {item.artist.name}
                      </div>
                    )}
                    {item.material && item.material !== 'default' && (
                      <div className="muted" style={{fontSize:'.9rem'}}>
                        Material: {item.material}
                      </div>
                    )}
                    {typeof item.product?.stock === 'number' && item.product.stock <= 5 && item.product.stock > 0 && (
                      <div className="muted" style={{fontSize:'.9rem', color: item.product.stock <= 2 ? '#d73a49' : '#d29922'}}>
                        {item.product.stock <= 2 ? 'Only ' + item.product.stock + ' left' : 'Low stock'}
                      </div>
                    )}
                    <div className="muted" style={{fontSize:'.9rem'}}>Item: {formatPrice(item.unitPrice)}</div>
                    {item.deliveryCost > 0 && (
                      <div className="muted" style={{fontSize:'.9rem'}}>Delivery: {formatPrice(item.deliveryCost)}</div>
                    )}
                    <div className="muted" style={{fontSize:'.9rem'}}>Unit total: {formatPrice(item.unitPrice + (item.deliveryCost || 0))}</div>
                  </div>
                </div>
                <div className="cart-item-controls row" style={{gap:'0.75rem', marginTop: '1rem'}}>
                  <input
                    type="number"
                    min="1"
                    max={typeof item.product?.stock === 'number' ? Math.max(1, item.product.stock) : 1}
                    value={item.qty}
                    onChange={e => updateQty(item.key, parseInt(e.target.value || '1'))}
                    style={{width:64}}
                  />
                  <div style={{width:110, textAlign:'right', fontWeight:800}}>{formatPrice(item.lineTotal)}</div>
                  <button className="btn ghost" onClick={() => removeFromCart(item.key)}>Remove</button>
                </div>
              </div>
            )
          })}
        </div>
        <div>
          <div className="card cart-summary-card">
            <div className="row" style={{justifyContent:'space-between'}}>
              <div>Items</div>
              <div>{formatPrice(totalItemCost)}</div>
            </div>
            {totalDeliveryCost > 0 && (
              <div className="row" style={{justifyContent:'space-between'}}>
                <div>Delivery</div>
                <div>{formatPrice(totalDeliveryCost)}</div>
              </div>
            )}
            <div className="divider" />
            <div className="row" style={{justifyContent:'space-between'}}>
              <div>Total</div>
              <div style={{fontWeight:800}}>{formatPrice(subtotal)}</div>
            </div>
            <p className="muted">
              {items.some(item => item.artist) 
                ? 'Custom artwork items may take 4-6 weeks. Standard items ship within 2-4 weeks.'
                : 'Handcrafted items typically ship within 2-4 weeks.'
              }
            </p>
            <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
              <Link className="btn ghost" to="/shop" style={{flex: 1}}>Continue Shopping</Link>
              <Link className="btn block" to="/checkout" style={{flex: 2}}>Checkout</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
