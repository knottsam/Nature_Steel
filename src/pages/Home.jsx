import React, { useEffect, useState } from 'react'
import Skeg from '../../Skeg.jpg'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import SEO from '../components/SEO.jsx'
import { db } from '../firebase'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'

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
    copy: 'You get clear lead times, progress photos, and a step-by-step build diary so you know exactly what you are commissioning.'
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
  useEffect(() => {
    async function fetchRecent() {
      try {
        // Get up to 4 most recent pieces from Firestore
        const q = query(collection(db, 'furniture'), orderBy('created', 'desc'), limit(4))
        const snap = await getDocs(q)
        setRecent(snap.docs.map(doc => {
          const d = doc.data()
          return {
            ...d,
            id: doc.id,
            slug: d.slug || (d.name ? d.name.toLowerCase().replace(/\s+/g, '-') : doc.id),
            images: d.images && d.images.length ? d.images : (d.imageUrl ? [d.imageUrl] : []),
            basePricePence: d.price || 0,
            materials: d.materials || '',
            craftsmanship: d.craftsmanship || '',
          }
        }))
      } catch {}
    }
    fetchRecent()
  }, [])
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
      <div className="grid" style={{gap:'2rem', position: 'relative', zIndex: 1}}>
        <section className="hero">
        <div>
          <div className="kicker">New drop</div>
          <h1 className="h1">Nature & Steel Bespoke: Handcrafted furniture & bespoke pieces. </h1>
          <p className="muted">Choose a piece, and we build you something one-of-a-kind. Transparent pricing. Made-to-order.</p>
          <div className="spacer" />
          <Link className="btn" to="/shop">Shop Now</Link>
        </div>
        <div>
          <img src="https://images.unsplash.com/photo-1538688423619-a81d3f23454b?q=80&w=1200&auto=format&fit=crop" alt="Hero furniture" />
        </div>
      </section>

      <section>
        <h2 className="h2">Recent pieces</h2>
        <div className="grid grid-3">
          {recent.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
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

      <section className="card">
        <h2 className="h2">How it works</h2>
        <ol>
          <li>Pick your bespoke piece</li>
          <li>Checkout and we start building</li>
          <li>When we've made it, we ship to you</li>
          <li>You enjoy your unique piece</li>
        </ol>
        <p className="muted">Custom orders may add extra lead time. See <Link to="/faq">FAQ</Link> for details.</p>
      </section>
    </div>
    </div>
  )
}
