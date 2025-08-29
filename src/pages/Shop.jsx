import React, { useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard.jsx'
import { products as staticProducts } from '../data/products.js'
import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'

export default function Shop() {
  const [dbProducts, setDbProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      try {
        const querySnapshot = await getDocs(collection(db, 'furniture'))
        const items = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        setDbProducts(items)
      } catch (err) {
        // Optionally handle error
      }
      setLoading(false)
    }
    fetchProducts()
  }, [])

  // Combine static and Firestore products for now
  const allProducts = [
    ...staticProducts,
    ...dbProducts.map(p => ({
      ...p,
      // Map Firestore fields to match ProductCard expectations
      slug: p.slug || p.name?.toLowerCase().replace(/\s+/g, '-'),
      images: p.imageUrl ? [p.imageUrl] : [],
      basePricePence: p.price ? Math.round(Number(p.price) * 100) : 0,
      materials: p.materials || '',
      craftsmanship: p.craftsmanship || '',
    }))
  ]

  // To show only Firestore products later, just use: const allProducts = dbProducts

  return (
    <div>
      <h1 className="h1">Nature & Steel Bespoke Collection</h1>
      <p className="muted">Ten core pieces. Built to order. Add bespoke art customization if you want it.</p>
      <div className="spacer" />
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-3">
          {allProducts.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  )
}
