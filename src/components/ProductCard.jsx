import React from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency.js'
import { priceForProduct } from '../utils/pricing.js'

export default function ProductCard({ product }) {
  const price = priceForProduct(product, null)
  return (
    <div className="card">
      <Link to={`/product/${product.slug}`}>
        <img src={product.images[0]} alt={product.name} />
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
