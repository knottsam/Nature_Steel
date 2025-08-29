import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { artists } from '../data/artists.js'
import { priceForProduct } from '../utils/pricing.js'
import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'

const CartContext = createContext(null)
const STORAGE_KEY = 'cart_v1'

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    async function fetchProducts() {
      try {
        const querySnapshot = await getDocs(collection(db, 'furniture'))
        setProducts(querySnapshot.docs.map(doc => {
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
    fetchProducts()
  }, [])

  function addToCart(productId, artistId = null, qty = 1) {
    setItems(prev => {
      const key = `${productId}__${artistId ?? 'none'}`
      const idx = prev.findIndex(i => i.key === key)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + qty }
        return next
      }
      return [...prev, { key, productId, artistId, qty }]
    })
  }

  function removeFromCart(key) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  function updateQty(key, qty) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, qty: Math.max(1, qty) } : i))
  }

  const enriched = useMemo(() => {
    return items.map(i => {
      const product = products.find(p => p.id === i.productId)
      const artist = i.artistId ? artists.find(a => a.id === i.artistId) : null
      const unitPrice = product ? priceForProduct(product, artist) : 0
      return { ...i, product, artist, unitPrice, lineTotal: unitPrice * i.qty }
    })
  }, [items, products])

  const subtotal = enriched.reduce((sum, i) => sum + i.lineTotal, 0)
  const totalQuantity = enriched.reduce((sum, i) => sum + i.qty, 0)

  return (
    <CartContext.Provider value={{ items: enriched, addToCart, removeFromCart, updateQty, subtotal, totalQuantity }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
