import React, { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { products } from '../data/products.js'
import { artists } from '../data/artists.js'
import { priceForProduct } from '../utils/pricing.js'
import { formatPrice } from '../utils/currency.js'
import { SITE_SETTINGS } from '../data/siteSettings.js'
import { useCart } from '../context/CartContext.jsx'

export default function Product() {
  const { slug } = useParams()
  const product = products.find(p => p.slug === slug)
  const [artistId, setArtistId] = useState('none')
  const selectedArtist = useMemo(() => {
    return artistId === 'none' ? null : artists.find(a => a.id === artistId)
  }, [artistId])

  if (!product) return <p>Not found</p>

  const price = priceForProduct(product, selectedArtist)
  const { addToCart } = useCart()

  return (
    <div className="grid" style={{gridTemplateColumns:'1.1fr 1fr', gap:'2rem'}}>
      <div className="grid" style={{gap:'1rem'}}>
        {product.images.map((src, i) => (
          <img key={i} src={src} alt={`${product.name} ${i+1}`} />
        ))}
      </div>
      <div>
        <h1 className="h1">{product.name}</h1>
        <div className="price" style={{fontSize:'1.6rem'}}>{formatPrice(price, 'GBP')}</div>
        <p className="muted">{product.materials}</p>
        <div className="divider" />

        <div className="field">
          <label>Customization</label>
          <select value={artistId} onChange={e => setArtistId(e.target.value)}>
            <option value="none">No Custom Art (base price)</option>
            {artists.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} (+{formatPrice(a.feePence + Math.round(a.feePence * SITE_SETTINGS.markupPercent))})
              </option>
            ))}
          </select>
          <small className="muted">
            Custom price = base + artist fee + {Math.round(SITE_SETTINGS.markupPercent * 100)}% markup.
          </small>
        </div>

        <button className="btn" onClick={() => addToCart(product.id, selectedArtist?.id, 1)}>Add to cart</button>

        <div className="divider" />
        <h3>Details</h3>
        <ul>
          <li><strong>Dimensions:</strong> {product.dimensions}</li>
          <li><strong>Materials:</strong> {product.materials}</li>
          <li><strong>Craftsmanship:</strong> {product.craftsmanship}</li>
        </ul>

        <div className="divider" />
        <p className="muted">
          Lead time: ~{SITE_SETTINGS.leadTimeBaselineDays} days base, +{SITE_SETTINGS.leadTimeCustomExtraDays} days if customized.
        </p>
      </div>
    </div>
  )
}
