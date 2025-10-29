import React, { useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard.jsx'
import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'
import { products as demoProducts } from '../data/products.js'

export default function Shop() {
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_PRODUCTS === '1'
  const [dbProducts, setDbProducts] = useState(demoEnabled ? [...demoProducts] : [])
  const [loading, setLoading] = useState(demoEnabled ? false : true)

  useEffect(() => {
    async function fetchProducts() {
      try {
        const querySnapshot = await getDocs(collection(db, 'furniture'))
        const items = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          slug: doc.data().slug || doc.data().name?.toLowerCase().replace(/\s+/g, '-'),
          images: doc.data().images && doc.data().images.length ? doc.data().images : (doc.data().imageUrl ? [doc.data().imageUrl] : []),
          basePricePence: doc.data().price || 0,
          materials: doc.data().materials || '',
          craftsmanship: doc.data().craftsmanship || '',
        }))
        if (items.length > 0) setDbProducts(items)
      } catch (err) {
        // Optionally handle error
      }
      setLoading(false)
    }
    fetchProducts()
  }, [])

  // Prefer Firestore; fallback to demo products when enabled
  const allProducts = dbProducts.length > 0
    ? dbProducts
    : (import.meta.env.VITE_ENABLE_DEMO_PRODUCTS === '1' ? demoProducts : [])

  return (
    <div>
      <h1 className="h1">Nature & Steel Bespoke Collection</h1>
      <p className="muted">Fine core pieces. Built to order. Add bespoke art customization if you want it.</p>
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
