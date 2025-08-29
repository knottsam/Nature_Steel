import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { db } from '../firebase'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'

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
    <div className="grid" style={{gap:'2rem'}}>
      <section className="hero">
        <div>
          <div className="kicker">New drop</div>
          <h1 className="h1">Nature & Steel Bespoke: Handcrafted Furniture × Original Art</h1>
          <p className="muted">Choose a piece, pick an artist, and we build something one-of-a-kind. Transparent pricing. Made-to-order.</p>
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

      <section className="card">
        <h2 className="h2">How it works</h2>
        <ol>
          <li>Pick your bespoke furniture</li>
          <li>Select an artist (or choose No Custom Art)</li>
          <li>Checkout and we start building</li>
          <li>We ship to the artist, then the artist ships to you</li>
        </ol>
        <p className="muted">Custom orders add extra lead time. See <Link to="/faq">FAQ</Link> for details.</p>
      </section>
    </div>
  )
}
