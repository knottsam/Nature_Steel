import React, { useCallback, useEffect, useRef, useState } from 'react'
import Skeg from '../assets/images/Skeg.jpg'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO.jsx'
import { db } from '../firebase'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { GALLERY_LIMIT } from '../utils/gallery.js'

const FEATURE_HIGHLIGHTS = [
  {
    title: 'Bespoke from start to finish',
    copy: 'We co-create the concept, capture measurements, and craft everything in-house so every piece is made-to-order and built for your space.'
  },
  {
    title: 'Nature-inspired materials',
    copy: 'Sustainably sourced timber, hand-forged steel, and unique patinas ensure each surface is one-of-a-kind yet built to last.'
  },
  {
    title: 'Transparent craftsmanship',
    copy: 'You get clear lead times, progress photos (upon request), and a step-by-step build diary so you know exactly what you are commissioning.'
  },
]

const TESTIMONIALS = [
  {
    quote: 'The bespoke sideboard is stunning, perfectly balanced between sculptural detail and everyday practicality.',
    author: 'Maya, London'
  },
  {
    quote: 'Mark and the team captured our vision for a dining table that still feels mindful and modern; it’s the heart of our home.',
    author: 'Omar & Zoe, Surrey'
  },
  {
    quote: 'Transparent communication and consistent updates made commissioning a custom piece refreshingly simple.',
    author: 'Lena, Manchester'
  }
]

export default function Home() {
  const [recent, setRecent] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [galleryError, setGalleryError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const totalRef = useRef(0)
  const sliderRef = useRef(null)
  useEffect(() => {
    async function fetchRecent() {
      setGalleryLoading(true)
      setGalleryError('')
      try {
    const fetchLimit = Math.max(GALLERY_LIMIT * 3, GALLERY_LIMIT)
    // Fetch recent published pieces, then keep the items marked for the homepage gallery
        const q = query(
          collection(db, 'furniture'),
          where('published', '==', true),
          orderBy('created', 'desc'),
          limit(fetchLimit)
        )
        const snap = await getDocs(q)
        const featured = snap.docs.map(doc => {
          const d = doc.data()
          const gallery = Array.isArray(d.images)
            ? d.images.map((img) => (typeof img === 'string' ? img.trim() : '')).filter(Boolean)
            : (d.imageUrl ? [d.imageUrl] : [])
          const cover = typeof d.coverImage === 'string' && d.coverImage.trim()
            ? d.coverImage.trim()
            : (gallery[0] || (typeof d.imageUrl === 'string' ? d.imageUrl : ''))
          const orderedGallery = cover
            ? [cover, ...gallery.filter((img) => img !== cover)]
            : gallery
          return {
            ...d,
            id: doc.id,
            slug: d.slug || (d.name ? d.name.toLowerCase().replace(/\s+/g, '-') : doc.id),
            images: orderedGallery,
            basePricePence: d.price || 0,
            materials: d.materials || '',
            material: d.material ?? d.materials ?? '',
            itemType: d.itemType || '',
            coverImage: cover,
          }
        }).filter(item => item.galleryFeatured === true).slice(0, GALLERY_LIMIT)
        setRecent(featured)
      } catch (err) {
        console.error('[Home] fetchRecent failed', err)
        setGalleryError(err?.message || 'Unable to load the latest pieces.')
      } finally {
        setGalleryLoading(false)
      }
    }
    fetchRecent()
  }, [])

  useEffect(() => {
    totalRef.current = recent.length
  }, [recent.length])

  const setActive = useCallback((valueOrUpdater) => {
    setActiveIndex(prev => {
      const total = totalRef.current
      if (!total) {
        activeIndexRef.current = 0
        return 0
      }
      const nextRaw = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater
      let next = Number.isFinite(nextRaw) ? Math.round(nextRaw) : 0
      next = ((next % total) + total) % total
      activeIndexRef.current = next
      return next
    })
  }, [])

  const goToNext = useCallback(() => {
    if (totalRef.current <= 1) return
    setActive(prev => prev + 1)
  }, [setActive])

  const goToPrev = useCallback(() => {
    if (totalRef.current <= 1) return
    setActive(prev => prev - 1)
  }, [setActive])

  useEffect(() => {
    if (!recent.length) {
      setActive(0)
      return
    }
    setActive(0)
  }, [recent.length, setActive])

  useEffect(() => {
    if (totalRef.current <= 1) return
    const id = window.setInterval(() => {
      setActive(prev => prev + 1)
    }, 5200)
    return () => window.clearInterval(id)
  }, [setActive])
  const totalRecent = recent.length

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <SEO
        title="Handcrafted furniture, bowls, vases, pens"
        description="Nature & Steel Bespoke creates handcrafted furniture, bowls, vases, pens, and bespoke art-ready pieces. Built to order with customization options."
        image={Skeg}
        keywords={["bespoke furniture", "handcrafted furniture", "bowls", "vases", "pens", "custom art furniture"]}
      />
      {/* Skeg.jpg background on right side */}
      <img
        src={Skeg}
        alt="Skeg background"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'auto',
          maxWidth: 'min(40vw, 500px)',
          zIndex: 0,
          opacity: 0.125, // adjust as needed
          pointerEvents: 'none',
          objectFit: 'cover',
        }}
      />
  <div className="grid home-stacked-sections" style={{ position: 'relative', zIndex: 1 }}>
        <section className="hero">
        <div>
          <div className="kicker"></div>
          <h1 className="h1">Nature & Steel Bespoke: Handcrafted, bespoke pieces. </h1>
          <div className="hero-subline-row">
            <p className="muted hero-subline-text">
              Choose a piece, and we build you something one-of-a-kind. Transparent pricing.
              <span className="hero-inline-note">Made-to-order.</span>
            </p>
            <Link className="btn hero-subline-btn" to="/shop">Shop Now</Link>
          </div>
        </div>
      </section>

      <section className="card gallery-section">
        <h2 className="h2">Recent pieces</h2>
  <div className="gallery-slider" ref={sliderRef}>
          {recent.map((p, index) => {
            if (!totalRecent) return null
            let offset = index - activeIndex
            const half = Math.floor(totalRecent / 2)
            if (offset > half) offset -= totalRecent
            if (offset < -half) offset += totalRecent
            const maxVisibleOffset = 2
            const isHidden = Math.abs(offset) > maxVisibleOffset
            const displayOffset = isHidden
              ? Math.sign(offset) * (maxVisibleOffset + 1)
              : offset
            const absOffset = Math.abs(displayOffset)
            const scale = Math.max(0.68, 1 - absOffset * 0.14)
            const opacity = isHidden ? 0 : Math.max(0.25, 1 - absOffset * 0.22)
            const blur = Math.min(absOffset * 1.2, 6)
            const elevation = isHidden ? 10 : 100 - absOffset * 10
            const classes = ['gallery-card']
            if (offset === 0) classes.push('is-active')
            else if (Math.abs(offset) === 1) classes.push('is-near')
            else classes.push('is-far')
            const cardStyles = {
              '--card-offset': displayOffset,
              '--card-scale': scale,
              '--card-opacity': opacity,
              '--card-blur': `${blur}px`,
              '--card-z': elevation,
            }
            return (
              <Link
                key={p.id}
                to={`/product/${p.slug}`}
                className={classes.join(' ')}
                data-gallery-card="true"
                data-active={offset === 0 ? 'true' : 'false'}
                style={{
                  ...cardStyles,
                  visibility: isHidden ? 'hidden' : 'visible',
                }}
                aria-hidden={isHidden ? 'true' : 'false'}
                onFocus={() => setActive(index)}
                onTouchStart={() => setActive(index)}
              >
                <img src={p.images[0]} alt={p.name} loading="lazy" />
              </Link>
            )
          })}
        </div>
        <div className="gallery-status">
          {galleryLoading && (
            <span>Fetching the latest pieces…</span>
          )}
          {!galleryLoading && galleryError && (
            <span className="muted">{galleryError}</span>
          )}
          {!galleryLoading && !galleryError && !recent.length && (
            <span className="muted">No published pieces yet.</span>
          )}
        </div>
        <div className="gallery-controls">
          <button type="button" onClick={goToPrev} className="gallery-button" aria-label="Show previous piece">
            ←
          </button>
          <button type="button" onClick={goToNext} className="gallery-button" aria-label="Show next piece">
            →
          </button>
        </div>
      </section>

      <div className="home-feature-grid">
        <section className="card">
          <h2 className="h2">Why choose Nature & Steel Bespoke?</h2>
          <div className="grid" style={{ gap: '1.5rem' }}>
            {FEATURE_HIGHLIGHTS.map((feature, index) => (
              <article key={feature.title} className="card" style={{ padding: '1.5rem' }}>
                <h3 className="h3" style={{ marginBottom: '0.5rem' }}>{`${index + 1}. ${feature.title}`}</h3>
                <p className="muted" style={{ margin: 0 }}>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="h2">Stories from collectors</h2>
          <div className="grid" style={{ gap: '1.25rem' }}>
            {TESTIMONIALS.map(({ quote, author }) => (
              <blockquote key={quote} className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--card-bg, #fff)' }}>
                <p className="muted" style={{ fontStyle: 'italic', marginBottom: '0.75rem' }}>&ldquo;{quote}&rdquo;</p>
                <cite className="muted" style={{ display: 'block', fontSize: '0.9rem' }}>— {author}</cite>
              </blockquote>
            ))}
          </div>
        </section>
      </div>
    </div>
    </div>
  )
}
