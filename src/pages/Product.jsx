import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { products } from '../data/products.js'
import { artists } from '../data/artists.js'
import { priceForProduct } from '../utils/pricing.js'
import { formatPrice } from '../utils/currency.js'
import { SITE_SETTINGS } from '../data/siteSettings.js'
import { useCart } from '../context/CartContext.jsx'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'
import SEO from '../components/SEO.jsx'

const BRAND = 'Nature & Steel Bespoke'
const DEFAULT_DESCRIPTION = 'Handcrafted furniture, bowls, vases, pens, and art-ready pieces. Built to order with bespoke options from Nature & Steel Bespoke.'
const DEFAULT_KEYWORDS = [
  'Nature & Steel',
  'bespoke furniture',
  'handcrafted furniture',
  'bowls',
  'vases',
  'pens',
  'handmade pens',
  'handmade furniture',
  'handmade bowls',
  'handmade vases',
  'custom art furniture',
  'handmade home decor',
]

function ImageCarousel({ images }) {
  const [index, setIndex] = useState(0)
  const [modal, setModal] = useState(false)
  if (!images || images.length === 0) return null
  const prev = (e) => { e && e.stopPropagation(); setIndex(i => (i === 0 ? images.length - 1 : i - 1)) }
  const next = (e) => { e && e.stopPropagation(); setIndex(i => (i === images.length - 1 ? 0 : i + 1)) }
  const select = (i, e) => { e && e.stopPropagation(); setIndex(i) }
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
        if (dx > 0) prev(e)
        else next(e)
      }
    }
  }
  // Modal/lightbox overlay
  return (
    <>
      <div style={{ position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto', cursor: 'zoom-in' }} onClick={() => setModal(true)}>
        <div
          style={{ position: 'relative', width: '100%' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img src={images[index]} alt={`Product ${index + 1}`} style={{ width: '100%', borderRadius: 8, transition: 'box-shadow .2s' }} />
          {images.length > 1 && (
            <>
              <button onClick={e => { prev(e); }} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}>&lt;</button>
              <button onClick={e => { next(e); }} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}>&gt;</button>
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
                onClick={e => select(i, e)}
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: i === index ? '2px solid #333' : '1px solid #ccc', cursor: 'pointer', opacity: i === index ? 1 : 0.7 }}
              />
            ))}
          </div>
        )}
      </div>
      {modal && (
        <div
          onClick={() => setModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            cursor: 'zoom-out',
            animation: 'fadeIn .2s',
          }}
        >
          <div style={{ position: 'relative', width: 'min(90vw, 900px)', maxWidth: '98vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
            <img src={images[index]} alt={`Product ${index + 1}`} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }} />
            {images.length > 1 && (
              <>
                <button onClick={prev} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, fontSize: 28, cursor: 'pointer', zIndex: 10 }}>&lt;</button>
                <button onClick={next} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, fontSize: 28, cursor: 'pointer', zIndex: 10 }}>&gt;</button>
              </>
            )}
            <button onClick={() => setModal(false)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 22, cursor: 'pointer', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
              {images.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Thumb ${i + 1}`}
                  onClick={e => { select(i, e); }}
                  style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 6, border: i === index ? '2.5px solid #ffe6a0' : '1.5px solid #888', cursor: 'pointer', opacity: i === index ? 1 : 0.7, background: '#222' }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default function Product() {
  const { slug } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [artistId, setArtistId] = useState('none')
  const [selectedMaterial, setSelectedMaterial] = useState('default')
  const { addToCart, products: liveProducts } = useCart()
  const { config: siteConfig, loading: configLoading } = useSiteConfig()
  const [showAdded, setShowAdded] = useState(false)
  const [toast, setToast] = useState('')

  const selectedArtist = useMemo(() => {
    return siteConfig.artistPagesEnabled && artistId !== 'none' ? artists.find(a => a.id === artistId) : null
  }, [artistId, siteConfig.artistPagesEnabled])

  if (!configLoading && !siteConfig?.shopEnabled) {
    return (
      <section className="card" style={{ maxWidth: 650, margin: '0 auto' }}>
        <h1 className="h1">Product</h1>
        <p className="muted">Our shop is currently offline. Please check back soon or contact us for bespoke furniture.</p>
      </section>
    )
  }

  useEffect(() => {
    if (!siteConfig.artistPagesEnabled && artistId !== 'none') {
      setArtistId('none')
    }
  }, [siteConfig.artistPagesEnabled, artistId])

  useEffect(() => {
    // Prefer live products (real-time) from context; fallback to static
    const foundLive = (liveProducts || []).find(p => (p.slug || (p.name && p.name.toLowerCase().replace(/\s+/g, '-'))) === slug)
    if (foundLive) {
      const p = { ...foundLive }
      if (p.price && !p.basePricePence) p.basePricePence = p.price
      setProduct(p)
      setLoading(false)
      return
    }
    const foundStatic = products.find(p => p.slug === slug)
    if (foundStatic) {
      setProduct(foundStatic)
      setLoading(false)
      return
    }
    // If neither found yet, stay loading until liveProducts updates
    setLoading((prev) => prev && true)
  }, [slug, liveProducts])

  if (loading) return <p>Loading...</p>
  if (!product) return <p>Not found</p>

  // Fallbacks for Firestore products
  const images = (() => {
    const gallery = Array.isArray(product.images)
      ? product.images.map((img) => (typeof img === 'string' ? img.trim() : '')).filter(Boolean)
      : []
    const fallback = typeof product.imageUrl === 'string' && product.imageUrl ? product.imageUrl : ''
    if (!gallery.length && fallback) {
      gallery.push(fallback)
    }
    const cover = typeof product.coverImage === 'string' && product.coverImage.trim()
      ? product.coverImage.trim()
      : ''
    if (cover) {
      const reordered = [cover, ...gallery.filter((img) => img !== cover)]
      return reordered.length ? reordered : (fallback ? [fallback] : [])
    }
    return gallery.length ? gallery : (fallback ? [fallback] : [])
  })()
  const price = priceForProduct(product, selectedArtist)
  const numericStock = typeof product.stock === 'number' ? product.stock : null
  const available = numericStock != null ? numericStock : 1
  const soldOut = numericStock != null ? numericStock <= 0 : false
  const summaryLine = (() => {
    const item = product.itemType && product.itemType.trim()
    const mat = (product.material || product.materials || '').trim()
    if (item && mat) return `${item} • ${mat}`
    return item || mat || product.description || ''
  })()

  // Only show customization dropdown if customizable (default true for static products)
  const isCustomizable = product.customizable !== undefined ? product.customizable : true;

  return (
    <>
      <SEO
        title={`${product.name} - Handcrafted ${product.itemType || 'Furniture'} | Nature & Steel Bespoke`}
        description={summaryLine || product.description || `Custom ${product.itemType || 'furniture'} made by hand. ${product.material ? `Crafted from ${product.material}.` : ''} Order bespoke pieces from Nature & Steel Bespoke.`}
        image={images[0]}
        keywords={[...DEFAULT_KEYWORDS, product.material, product.itemType].filter(Boolean)}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Product",
          "name": product.name,
          "description": product.description || summaryLine,
          "image": images,
          "brand": {
            "@type": "Brand",
            "name": "Nature & Steel Bespoke"
          },
          "offers": {
            "@type": "Offer",
            "price": price / 100,
            "priceCurrency": "GBP",
            "availability": "https://schema.org/InStock",
            "seller": {
              "@type": "Organization",
              "name": "Nature & Steel Bespoke"
            }
          },
          "material": product.material,
          "category": product.itemType
        }}
        breadcrumb={[
          { name: "Home", url: "/" },
          ...(siteConfig?.shopEnabled ? [{ name: "Shop", url: "/shop" }] : []),
          { name: product.name, url: window.location.pathname }
        ]}
      />
      <div className="grid" style={{gridTemplateColumns:'1.1fr 1fr', gap:'2rem'}}>
      <div className="grid" style={{gap:'1rem'}}>
        <ImageCarousel images={images} />
      </div>
      <div>
        <h1 className="h1">{product.name}</h1>
        <div className="price" style={{fontSize:'1.6rem'}}>{formatPrice(price, 'GBP')}</div>
        {summaryLine && <p className="muted">{summaryLine}</p>}
        {product.description && (
          <p style={{ marginTop: '0.75rem' }}>{product.description}</p>
        )}
        <div className="divider" />

        {isCustomizable ? (
          <>
            {Array.isArray(product.availableMaterials) && product.availableMaterials.length > 0 && (
              <div className="field">
                <label>Customise item material</label>
                <select value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)}>
                  {product.availableMaterials.map(mat => (
                    <option key={mat} value={mat}>{mat}</option>
                  ))}
                </select>
              </div>
            )}
            {siteConfig.artistPagesEnabled && (
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
            )}
          </>
        ) : (
          <div className="field">
            <label>Customization</label>
            <div style={{marginBottom:8}}>This item cannot be customized.</div>
          </div>
        )}

        <button
          className="btn"
          disabled={soldOut}
          onClick={() => {
            const res = addToCart(product.id, selectedArtist?.id, 1, selectedMaterial)
            if (res && res.ok) {
              setToast('Added to cart')
              setShowAdded(true)
              setTimeout(() => { setShowAdded(false); setToast('') }, 1800)
            } else {
              const msg = res?.reason === 'soldout' ? 'Sold out' : res?.reason === 'limit' ? `Only ${available} available` : 'Unavailable'
              setToast(msg)
              setShowAdded(true)
              setTimeout(() => { setShowAdded(false); setToast('') }, 1800)
            }
          }}
        >
          {soldOut ? 'Sold out' : 'Add to cart'}
        </button>

        {showAdded && (
          <div style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '2px solid var(--primary)',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            padding: '1.1rem 2.2rem',
            fontWeight: 600,
            fontSize: '1.1rem',
            zIndex: 1000,
            transition: 'opacity .3s',
          }}>
            {toast || 'Added to cart!'}
          </div>
        )}

        <div className="divider" />
        <h3>Details</h3>
        <ul>
          <li><strong>Item type:</strong> {product.itemType || '—'}</li>
          <li><strong>Material:</strong> {product.material || product.materials || '—'}</li>
          {product.materials && product.materials !== product.material && (
            <li><strong>Materials (details):</strong> {product.materials}</li>
          )}
        </ul>

        <div className="divider" />
        <p className="muted">
          Lead time: please allow {SITE_SETTINGS.leadTimeBaselineDays} days, +{SITE_SETTINGS.leadTimeCustomExtraDays} days if customized.
        </p>
        {numericStock != null && (
          <p className="muted">{soldOut ? 'Currently sold out.' : `${numericStock} in stock`}</p>
        )}
      </div>
    </div>
    </>
  )
}
