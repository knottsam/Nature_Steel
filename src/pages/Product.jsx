import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { products } from '../data/products.js'
import { artists } from '../data/artists.js'
import { priceForProduct } from '../utils/pricing.js'
import { formatPrice } from '../utils/currency.js'
import { SITE_SETTINGS } from '../data/siteSettings.js'
import { useCart } from '../context/CartContext.jsx'
import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'

function ImageCarousel({ images }) {
  const [index, setIndex] = useState(0)
  if (!images || images.length === 0) return null
  const prev = () => setIndex(i => (i === 0 ? images.length - 1 : i - 1))
  const next = () => setIndex(i => (i === images.length - 1 ? 0 : i + 1))
  const select = (i) => setIndex(i)
  // Basic swipe support
  const touch = React.useRef({ x: 0, y: 0 })
  const handleTouchStart = e => {
    if (e.touches && e.touches.length === 1) {
      touch.current.x = e.touches[0].clientX
      touch.current.y = e.touches[0].clientY
    }
  }
  const handleTouchEnd = e => {
    if (e.changedTouches && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touch.current.x
      if (Math.abs(dx) > 40) {
        if (dx > 0) prev()
        else next()
      }
    }
  }
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto' }}>
      <div
        style={{ position: 'relative', width: '100%' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img src={images[index]} alt={`Product ${index + 1}`} style={{ width: '100%', borderRadius: 8 }} />
        {images.length > 1 && (
          <>
            <button onClick={prev} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}>&lt;</button>
            <button onClick={next} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}>&gt;</button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Thumb ${i + 1}`}
              onClick={() => select(i)}
              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: i === index ? '2px solid #333' : '1px solid #ccc', cursor: 'pointer', opacity: i === index ? 1 : 0.7 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Product() {
  const { slug } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [artistId, setArtistId] = useState('none')
  const selectedArtist = useMemo(() => {
    return artistId === 'none' ? null : artists.find(a => a.id === artistId)
  }, [artistId])
  const { addToCart } = useCart()

  useEffect(() => {
    async function fetchProduct() {
      // Try static products first
      let found = products.find(p => p.slug === slug)
      if (found) {
        setProduct(found)
        setLoading(false)
        return
      }
      // Try Firestore
      const querySnapshot = await getDocs(collection(db, 'furniture'))
      let dbProduct = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .find(p => (p.slug || (p.name && p.name.toLowerCase().replace(/\s+/g, '-'))) === slug)
      // Fix: map price to basePricePence for Firestore products
      if (dbProduct && dbProduct.price && !dbProduct.basePricePence) {
        dbProduct.basePricePence = dbProduct.price;
      }
      setProduct(dbProduct || null)
      setLoading(false)
    }
    fetchProduct()
  }, [slug])

  if (loading) return <p>Loading...</p>
  if (!product) return <p>Not found</p>

  // Fallbacks for Firestore products
  const images = product.images && product.images.length ? product.images : (product.imageUrl ? [product.imageUrl] : [])
  const price = priceForProduct(product, selectedArtist)

  // Only show customization dropdown if customizable (default true for static products)
  const isCustomizable = product.customizable !== undefined ? product.customizable : true;

  return (
    <div className="grid" style={{gridTemplateColumns:'1.1fr 1fr', gap:'2rem'}}>
      <div className="grid" style={{gap:'1rem'}}>
        <ImageCarousel images={images} />
      </div>
      <div>
        <h1 className="h1">{product.name}</h1>
        <div className="price" style={{fontSize:'1.6rem'}}>{formatPrice(price, 'GBP')}</div>
        <p className="muted">{product.materials || product.description}</p>
        <div className="divider" />

        {isCustomizable ? (
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
        ) : (
          <div className="field">
            <label>Customization</label>
            <div style={{marginBottom:8}}>This item cannot be customized.</div>
          </div>
        )}

        <button className="btn" onClick={() => addToCart(product.id, selectedArtist?.id, 1)}>Add to cart</button>

        <div className="divider" />
        <h3>Details</h3>
        <ul>
          <li><strong>Dimensions:</strong> {product.dimensions || '—'}</li>
          <li><strong>Materials:</strong> {product.materials || '—'}</li>
          <li><strong>Craftsmanship:</strong> {product.craftsmanship || '—'}</li>
        </ul>

        <div className="divider" />
        <p className="muted">
          Lead time: ~{SITE_SETTINGS.leadTimeBaselineDays} days base, +{SITE_SETTINGS.leadTimeCustomExtraDays} days if customized.
        </p>
      </div>
    </div>
  )
}
