import React from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency.js'
import { priceForProduct } from '../utils/pricing.js'

export default function ProductCard({ product }) {
  const price = priceForProduct(product, null)
  const numericStock = typeof product.stock === 'number' ? product.stock : null
  const soldOut = numericStock != null ? numericStock <= 0 : false
  return (
    <div className="card">
      <Link to={`/product/${product.slug}`}>
        <div style={{position:'relative'}}>
          <img src={product.images[0]} alt={product.name} />
          {soldOut && (
            <div style={{position:'absolute', top:8, left:8, background:'rgba(0,0,0,0.65)', color:'#fff', padding:'4px 8px', borderRadius:6, fontSize:12}}>Sold out</div>
          )}
        </div>
      </Link>
      <div style={{paddingTop: '.75rem'}}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <h3 style={{margin:0}}>{product.name}</h3>
          <div className="price">{formatPrice(price)}</div>
        </div>
        <p className="muted" style={{marginTop:'.4rem'}}>{product.materials}</p>
        <div className="spacer" />
        <Link className="btn block" to={`/product/${product.slug}`}>View</Link>
      </div>
    </div>
  )
}
