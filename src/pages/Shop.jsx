import React, { useEffect, useMemo, useState } from 'react'
import ProductCard from '../components/ProductCard.jsx'
import { db, configHealth } from '../firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { products as demoProducts } from '../data/products.js'

const PAGE_SIZE = 12

export default function Shop() {
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_PRODUCTS === '1'
  const [dbProducts, setDbProducts] = useState(demoEnabled ? [...demoProducts] : [])
  const [loading, setLoading] = useState(demoEnabled ? false : true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMaterials, setSelectedMaterials] = useState([])
  const [selectedItemTypes, setSelectedItemTypes] = useState([])
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (!configHealth.ok) {
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
            const items = querySnapshot.docs.map(doc => {
              const data = doc.data()
              const gallery = Array.isArray(data.images)
                ? data.images.map((img) => (typeof img === 'string' ? img.trim() : '')).filter(Boolean)
                : (data.imageUrl ? [data.imageUrl] : [])
              const cover = typeof data.coverImage === 'string' && data.coverImage.trim()
                ? data.coverImage.trim()
                : (gallery[0] || (typeof data.imageUrl === 'string' ? data.imageUrl : ''))
              const orderedGallery = cover
                ? [cover, ...gallery.filter((img) => img !== cover)]
                : gallery
              return {
                id: doc.id,
                ...data,
                slug: data.slug || data.name?.toLowerCase().replace(/\s+/g, '-'),
                images: orderedGallery,
                basePricePence: data.price || 0,
                materials: data.materials || '',
                material: data.material ?? data.materials ?? '',
                itemType: data.itemType || '',
                coverImage: cover,
              }
            })
            setDbProducts(items)
          } catch (err) {
            console.warn('[Shop] Failed to parse snapshot:', err)
          }
          setLoading(false)
        },
        (err) => {
          console.warn('[Shop] Firestore subscription error:', err)
          setLoading(false)
        }
      )
    } catch (e) {
      console.error('[Shop] Failed to subscribe to furniture collection:', e)
      setLoading(false)
    }
    return () => { try { unsub && unsub() } catch {} }
  }, [])

  // Prefer Firestore; fallback to demo products when enabled
  const allProducts = useMemo(() => {
    if (dbProducts.length > 0) {
      return dbProducts
    }
    return import.meta.env.VITE_ENABLE_DEMO_PRODUCTS === '1' ? demoProducts : []
  }, [dbProducts])

  const materialOptions = useMemo(() => {
    const values = new Set()
    allProducts.forEach(product => {
      const primary = typeof product.material === 'string' ? product.material : null
      if (primary) {
        primary.split(',').map(v => v.trim()).filter(Boolean).forEach(v => values.add(v))
      }
      if (Array.isArray(product.materials)) {
        product.materials.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean).forEach(v => values.add(v))
      } else if (typeof product.materials === 'string') {
        product.materials.split(',').map(v => v.trim()).filter(Boolean).forEach(v => values.add(v))
      }
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [allProducts])

  const itemTypeOptions = useMemo(() => {
    const values = new Set()
    allProducts.forEach(product => {
      if (typeof product.itemType === 'string' && product.itemType.trim()) {
        values.add(product.itemType.trim())
      }
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [allProducts])

  useEffect(() => {
    setSelectedMaterials(prev => prev.filter(value => materialOptions.includes(value)))
  }, [materialOptions])

  useEffect(() => {
    setSelectedItemTypes(prev => prev.filter(value => itemTypeOptions.includes(value)))
  }, [itemTypeOptions])

  const filteredProducts = useMemo(() => {
    if (!allProducts.length) {
      return []
    }
    const search = searchTerm.trim().toLowerCase()
    return allProducts.filter(product => {
      const productMaterials = new Set()
      if (typeof product.material === 'string') {
        product.material.split(',').map(v => v.trim().toLowerCase()).filter(Boolean).forEach(v => productMaterials.add(v))
      }
      if (Array.isArray(product.materials)) {
        product.materials.map(v => (typeof v === 'string' ? v.trim().toLowerCase() : '')).filter(Boolean).forEach(v => productMaterials.add(v))
      } else if (typeof product.materials === 'string') {
        product.materials.split(',').map(v => v.trim().toLowerCase()).filter(Boolean).forEach(v => productMaterials.add(v))
      }

      const productItemType = typeof product.itemType === 'string' ? product.itemType.trim().toLowerCase() : ''

      const matchesMaterials = selectedMaterials.length === 0
        ? true
        : selectedMaterials.some(value => productMaterials.has(value.toLowerCase()))

      const matchesItemTypes = selectedItemTypes.length === 0
        ? true
        : selectedItemTypes.some(value => productItemType === value.toLowerCase())

      const matchesSearch = !search
        ? true
        : [product.name, product.description, product.itemType, product.material, product.materials]
          .map(value => (typeof value === 'string' ? value.toLowerCase() : ''))
          .some(value => value.includes(search))

      return matchesMaterials && matchesItemTypes && matchesSearch
    })
  }, [allProducts, searchTerm, selectedMaterials, selectedItemTypes])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedMaterials, selectedItemTypes])

  useEffect(() => {
    const total = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
    if (currentPage > total) {
      setCurrentPage(total)
    }
  }, [filteredProducts.length, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const pageProducts = filteredProducts.slice(startIndex, startIndex + PAGE_SIZE)
  const showPagination = filteredProducts.length > PAGE_SIZE
  const showingStart = filteredProducts.length === 0 ? 0 : startIndex + 1
  const showingEnd = filteredProducts.length === 0 ? 0 : startIndex + pageProducts.length

  const hasActiveFilters = Boolean(searchTerm.trim() || selectedMaterials.length || selectedItemTypes.length)

  const toggleValue = (value, setState) => {
    setState(prev => (
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    ))
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedMaterials([])
    setSelectedItemTypes([])
  }

  return (
    <div>
      <h1 className="h1">Nature & Steel Bespoke Collection</h1>
      <p className="muted">Fine core pieces. Built to order. Choose customization if you want it.</p>
      <div className="spacer" />
      <div className="shop-layout">
        <aside className="shop-filters" aria-label="Filters">
          <div className="shop-filters__header">
            <h2 className="h2">Filter & Search</h2>
            {hasActiveFilters && (
              <button type="button" className="btn ghost" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
          <div className="field">
            <label htmlFor="shop-search">Search the collection</label>
            <input
              id="shop-search"
              type="search"
              placeholder="Search by name, material, or use"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          {materialOptions.length > 0 && (
            <div className="filter-group">
              <span className="filter-group__label">Materials</span>
              <div className="filter-group__options">
                {materialOptions.map(option => (
                  <label key={option} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedMaterials.includes(option)}
                      onChange={() => toggleValue(option, setSelectedMaterials)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {itemTypeOptions.length > 0 && (
            <div className="filter-group">
              <span className="filter-group__label">Piece type</span>
              <div className="filter-group__options">
                {itemTypeOptions.map(option => (
                  <label key={option} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedItemTypes.includes(option)}
                      onChange={() => toggleValue(option, setSelectedItemTypes)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {!materialOptions.length && !itemTypeOptions.length && (
            <small className="muted">Filters appear once products are available.</small>
          )}
        </aside>
        <section className="shop-results">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <>
              {filteredProducts.length > 0 ? (
                <div className="grid grid-3">
                  {pageProducts.map(product => <ProductCard key={product.id} product={product} />)}
                </div>
              ) : allProducts.length === 0 ? (
                <div className="muted">No products available.</div>
              ) : (
                <div className="muted">No products match your filters yet.</div>
              )}
              {filteredProducts.length > 0 && (
                <div className="shop-results__meta">
                  <span className="muted">Showing {showingStart}-{showingEnd} of {filteredProducts.length} pieces</span>
                  {showPagination && (
                    <div className="shop-pagination">
                      <button
                        type="button"
                        className="btn ghost pagination-btn"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                      <span className="shop-pagination__page">Page {currentPage} of {totalPages}</span>
                      <button
                        type="button"
                        className="btn ghost pagination-btn"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
