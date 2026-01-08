import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { artists } from '../data/artists.js'
import { products as demoProducts } from '../data/products.js'
import { priceForProduct } from '../utils/pricing.js'
import { db, configHealth } from '../firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'

const CartContext = createContext(null)
const STORAGE_KEY = 'cart_v1'

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_PRODUCTS === '1'
  // Pre-seed products with demo data to avoid a blank period while Firestore loads
  const [products, setProducts] = useState(demoEnabled ? [...demoProducts] : [])
  const [cleanupTick, setCleanupTick] = useState(0)

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
    if (!configHealth.ok) {
      console.warn('[CartContext] Skipping product subscription; missing Firebase config:', configHealth.missing)
      // In this case, keep demo or empty based on flag
      return
    }
    // Match security rules: only read published items
    const q = query(collection(db, 'furniture'), where('published', '==', true))
    const unsub = onSnapshot(q, (querySnapshot) => {
      try {
        const fromDb = querySnapshot.docs.map(doc => {
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
            availableMaterials: Array.isArray(d.availableMaterials) ? d.availableMaterials : [],
          }
        })
        if (fromDb.length > 0) {
          setProducts(fromDb)
        } else if (!demoEnabled) {
          setProducts([])
        }
      } catch {
        if (!demoEnabled) setProducts([])
      }
    }, () => {
      if (!demoEnabled) setProducts([])
    })
    return () => { try { unsub() } catch {} }
  }, [])

  // Auto-clean cart entries that no longer have a matching product or have zero stock
  useEffect(() => {
    if (!products || products.length === 0) return
    setItems(prev => {
      const productIds = new Set(products.map(p => p.id))
      const cleaned = prev.filter(i => {
        if (!productIds.has(i.productId)) return false
        const p = products.find(pp => pp.id === i.productId)
        if (!p) return false
        if (typeof p.stock === 'number' && p.stock <= 0) return false
        return true
      })
      if (cleaned.length !== prev.length) {
        // Trigger a small UI notice that items were removed
        setCleanupTick(t => t + 1)
      }
      return cleaned.length === prev.length ? prev : cleaned
    })
  }, [products])

  function addToCart(productId, artistId = null, qty = 1, material = null) {
    const product = products.find(p => p.id === productId)
    if (!product) {
      // Can't verify availability yet; block to avoid oversell
      return { ok: false, reason: 'unavailable' }
    }
    const available = typeof product.stock === 'number' ? product.stock : 1
    if (available <= 0) return { ok: false, reason: 'soldout', available: 0 }

    // Sum quantities already in cart for this product (across artists and materials)
    const currentTotal = items.filter(i => i.productId === productId).reduce((s, i) => s + i.qty, 0)
    const canAdd = Math.max(0, available - currentTotal)
    if (canAdd <= 0) return { ok: false, reason: 'limit', available }

    const toAdd = Math.min(canAdd, qty)
    const key = `${productId}__${artistId ?? 'none'}__${material ?? 'default'}`
    setItems(prev => {
      const idx = prev.findIndex(i => i.key === key)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + toAdd }
        return next
      }
      return [...prev, { key, productId, artistId, material, qty: toAdd }]
    })
    return { ok: true, added: toAdd, capped: toAdd < qty, available }
  }

  function removeFromCart(key) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  function updateQty(key, qty) {
    setItems(prev => {
      const next = [...prev]
      const idx = next.findIndex(i => i.key === key)
      if (idx === -1) return prev
      const item = next[idx]
      const product = products.find(p => p.id === item.productId)
      const available = product ? (typeof product.stock === 'number' ? product.stock : 1) : 1
      // Other qty for same product across other cart lines
      const otherQty = next.filter(i => i.productId === item.productId && i.key !== key).reduce((s, i) => s + i.qty, 0)
      const allowedForThisLine = Math.max(1, available - otherQty)
      const clamped = Math.max(1, Math.min(allowedForThisLine, Number.isFinite(qty) ? qty : 1))
      next[idx] = { ...item, qty: clamped }
      return next
    })
  }

  function clearCart() {
    setItems([])
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
    <CartContext.Provider value={{ items: enriched, products, addToCart, removeFromCart, updateQty, clearCart, subtotal, totalQuantity, cleanupTick }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
