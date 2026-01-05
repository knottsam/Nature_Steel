import React from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency.js'
import { priceForProduct } from '../utils/pricing.js'

export default function ProductCard({ product }) {
  const price = priceForProduct(product, null)
  const numericStock = typeof product.stock === 'number' ? product.stock : null
  const soldOut = numericStock != null ? numericStock <= 0 : false
  const heroImage = product.coverImage
    || (Array.isArray(product.images) && product.images.length ? product.images[0] : null)
    || product.imageUrl
  const subtitle = (() => {
    const item = product.itemType && product.itemType.trim()
    const mat = (product.material || product.materials || '').trim()
    if (item && mat) return `${item} • ${mat}`
    return item || mat || ''
  })()
  return (
    <article className="card product-card">
      <Link to={`/product/${product.slug}`} className="product-card__media">
        {heroImage && <img src={heroImage} alt={product.name} />}
        {soldOut && <span className="product-card__badge">Sold out</span>}
      </Link>
      <div className="product-card__body">
        <div className="row product-card__header">
          <h3 className="product-card__title">{product.name}</h3>
          <div className="price">{formatPrice(price)}</div>
        </div>
        {subtitle && <p className="muted product-card__subtitle">{subtitle}</p>}
        <Link className="btn block product-card__cta" to={`/product/${product.slug}`}>View</Link>
      </div>
    </article>
  )
}
