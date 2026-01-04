import React, { useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard.jsx'
import { db, configHealth } from '../firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { products as demoProducts } from '../data/products.js'

export default function Shop() {
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_PRODUCTS === '1'
  const [dbProducts, setDbProducts] = useState(demoEnabled ? [...demoProducts] : [])
  const [loading, setLoading] = useState(demoEnabled ? false : true)

  useEffect(() => {
    if (!configHealth.ok) {
      // eslint-disable-next-line no-console
      console.warn('[Shop] Skipping Firestore subscription due to missing config:', configHealth.missing)
      setLoading(false)
      return
    }
    let unsub = null
    try {
      // Match security rules: only read published items
      const q = query(collection(db, 'furniture'), where('published', '==', true))
      unsub = onSnapshot(
        q,
        (querySnapshot) => {
          try {
            const items = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              slug: doc.data().slug || doc.data().name?.toLowerCase().replace(/\s+/g, '-'),
              images: doc.data().images && doc.data().images.length ? doc.data().images : (doc.data().imageUrl ? [doc.data().imageUrl] : []),
              basePricePence: doc.data().price || 0,
              materials: doc.data().materials || '',
              material: doc.data().material ?? doc.data().materials ?? '',
              itemType: doc.data().itemType || '',
            }))
            setDbProducts(items)
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[Shop] Failed to parse snapshot:', err)
          }
          setLoading(false)
        },
        (err) => {
          // eslint-disable-next-line no-console
          console.warn('[Shop] Firestore subscription error:', err)
          setLoading(false)
        }
      )
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Shop] Failed to subscribe to furniture collection:', e)
      setLoading(false)
    }
    return () => { try { unsub && unsub() } catch {} }
  }, [])

  // Prefer Firestore; fallback to demo products when enabled
  const allProducts = dbProducts.length > 0
    ? dbProducts
    : (import.meta.env.VITE_ENABLE_DEMO_PRODUCTS === '1' ? demoProducts : [])

  return (
    <div>
      <h1 className="h1">Nature & Steel Bespoke Collection</h1>
      <p className="muted">Fine core pieces. Built to order. Choose customization if you want it.</p>
      <div className="spacer" />
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-3">
          {allProducts.map(p => <ProductCard key={p.id} product={p} />)}
          {allProducts.length === 0 && (
            <div className="muted">No products available.</div>
          )}
        </div>
      )}
    </div>
  )
}
