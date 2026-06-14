import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Skeg from '../assets/images/Skeg.jpg'
import SkegEg1 from '../assets/images/Skeg_Eg1.jpg'
import SkegEg2 from '../assets/images/Skeg_Eg2.jpg'
import SkegEg3 from '../assets/images/Skeg_Eg3.jpg'
import SkegFace from '../assets/images/skeg_face.jpg'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO.jsx'
import { db } from '../firebase'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { GALLERY_LIMIT } from '../utils/gallery.js'

const TRUST_POINTS = [
  'UK handmade to order',
  'Sustainably sourced timber & steel',
  'Design to install, all in-house',
  'Transparent, upfront pricing',
]

// Category tiles. `to` uses ?q= which the Shop search matches across
// name, description, piece type and materials, so empty categories fall
// back to a friendly empty-state rather than breaking.
const CATEGORIES = [
  { label: 'Furniture & Tables', blurb: 'Statement tables, shelving & built-in pieces', to: '/shop?q=table', fallback: SkegEg1 },
  { label: 'Bowls & Vessels', blurb: 'Turned vessels with one-of-a-kind grain', to: '/shop?q=bowl', fallback: SkegEg2 },
  { label: 'Pens & Small Turns', blurb: 'Exotic-wood pens, rings & keepsakes', to: '/shop?q=pen', fallback: SkegEg3 },
  { label: 'Bespoke Commissions', blurb: 'Have an idea? We design & build it with you', to: '/about', fallback: SkegFace },
]

const PROCESS_STEPS = [
  {
    title: 'Share your idea',
    copy: 'Tell us your vision, your space and your budget. We talk it through, take measurements and shape the concept together.',
  },
  {
    title: 'We design & craft',
    copy: 'Mark forges the steel and Sam turns the timber in-house — tight joins, clean lines, with progress photos on request.',
  },
  {
    title: 'Delivered & installed',
    copy: 'We finish, deliver and fit the piece ourselves. Consistent from the first conversation to the final install.',
  },
]

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

  // Hero leads with a live piece when one is featured, falling back to Skeg.
  const heroImage = useMemo(() => recent[0]?.coverImage || Skeg, [recent])
  // Tile imagery uses live covers when available, else local fallbacks.
  const categoryImages = useMemo(() => CATEGORIES.map((cat, i) => recent[i]?.coverImage || cat.fallback), [recent])

  return (
    <div className="home-page">
      <SEO
        title="Handcrafted furniture, bowls, vases, pens"
        description="Nature & Steel Bespoke creates handcrafted furniture, bowls, vases, pens, and bespoke art-ready pieces. Built to order with customization options."
        image={Skeg}
        keywords={["bespoke furniture", "handcrafted furniture", "bowls", "vases", "pens", "custom art furniture"]}
      />

      <div className="grid home-stacked-sections">
        {/* Hero — full-bleed imagery with overlaid headline and dual CTAs */}
        <section className="home-hero">
          <img className="home-hero__media" src={heroImage} alt="" aria-hidden="true" loading="eager" />
          <div className="home-hero__overlay" />
          <div className="home-hero__content">
            <span className="home-hero__eyebrow">Hand-forged steel · Hand-turned timber</span>
            <h1 className="home-hero__title">Furniture &amp; pieces, made one-of-a-kind for you.</h1>
            <p className="home-hero__lede">
              Tell us what you imagine — we design, forge and craft it in-house, then deliver it to your space.
              Transparent pricing. Built to last.
            </p>
            <div className="home-hero__actions">
              <Link className="btn" to="/shop">Shop the collection</Link>
              <Link className="btn ghost" to="/about">Commission a piece</Link>
            </div>
            <ul className="trust-strip">
              {TRUST_POINTS.map((point) => (
                <li key={point}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="trust-strip__icon">
                    <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Category tiles — visual entry points into the shop + commissions */}
        <section className="category-tiles" aria-label="Browse by category">
          {CATEGORIES.map((cat, i) => (
            <Link key={cat.label} to={cat.to} className="category-tile">
              <img src={categoryImages[i]} alt="" aria-hidden="true" loading="lazy" />
              <span className="category-tile__overlay" />
              <span className="category-tile__body">
                <span className="category-tile__label">{cat.label}</span>
                <span className="category-tile__blurb">{cat.blurb}</span>
                <span className="category-tile__cta">Explore →</span>
              </span>
            </Link>
          ))}
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
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" onClick={goToNext} className="gallery-button" aria-label="Show next piece">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </section>

      {/* How it works — the bespoke journey, three steps */}
      <section className="card process-section">
        <h2 className="h2">How a commission works</h2>
        <p className="muted process-section__lede">From a rough idea to a piece you’ll use every day — handled end to end, by the makers themselves.</p>
        <ol className="process-steps">
          {PROCESS_STEPS.map((step, index) => (
            <li key={step.title} className="process-step">
              <span className="process-step__num">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="h3 process-step__title">{step.title}</h3>
              <p className="muted process-step__copy">{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="home-feature-grid">
        <section className="card home-why">
          <h2 className="h2">Why choose Nature & Steel Bespoke?</h2>
          {FEATURE_HIGHLIGHTS.map((feature, index) => (
            <article key={feature.title} className="card feature-card">
              <span className="feature-card__num" aria-hidden="true">{index + 1}</span>
              <div>
                <h3 className="h3 feature-card__title">{feature.title}</h3>
                <p className="muted" style={{ margin: 0 }}>{feature.copy}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="card">
          <h2 className="h2">What do our customers say about us?</h2>
          {TESTIMONIALS.map(({ quote, author }) => (
            <blockquote key={quote} className="card testimonial-card">
              <span className="testimonial-card__mark" aria-hidden="true">&ldquo;</span>
              <span className="testimonial-card__stars" aria-label="Rated 5 out of 5">★★★★★</span>
              <p className="testimonial-card__quote">{quote}</p>
              <cite className="testimonial-card__author">— {author}</cite>
            </blockquote>
          ))}
        </section>
      </div>

      {/* Closing call-to-action */}
      <section className="closing-cta">
        <h2 className="closing-cta__title">Ready to commission something one-of-a-kind?</h2>
        <p className="closing-cta__copy">
          Got a piece in mind, or just the seed of an idea? We’ll help shape it into something that works
          for your space — and build it right.
        </p>
        <div className="closing-cta__actions">
          <Link className="btn" to="/about">Start your commission</Link>
          <Link className="btn ghost" to="/shop">Browse the shop</Link>
        </div>
      </section>
    </div>
    </div>
  )
}
