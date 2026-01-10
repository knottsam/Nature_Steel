import React, { useEffect, useMemo, useState } from 'react'
import ProductCard from '../components/ProductCard.jsx'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'
import { db, configHealth } from '../firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { products as demoProducts } from '../data/products.js'
import SEO from '../components/SEO.jsx'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'
import { trackSearch, trackFilterUsed } from '../utils/analytics.js'

const PAGE_SIZE = 9 // Number of products per page

export default function Shop() {
  const { config, loading: configLoading } = useSiteConfig()
  if (!configLoading && !config?.shopEnabled) {
    return (
      <section className="card" style={{ maxWidth: 650, margin: '0 auto' }}>
        <h1 className="h1">Shop</h1>
        <p className="muted">Our shop is currently offline. Please check back soon or contact us for bespoke furniture.</p>
      </section>
    )
  }
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_PRODUCTS === '1'
  const [dbProducts, setDbProducts] = useState(demoEnabled ? [...demoProducts] : [])
  const [loading, setLoading] = useState(demoEnabled ? false : true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMaterials, setSelectedMaterials] = useState([])
  const [selectedItemTypes, setSelectedItemTypes] = useState([])
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortOption, setSortOption] = useState('name')
  const [currentPage, setCurrentPage] = useState(1)
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [materialsExpanded, setMaterialsExpanded] = useState(false)
  const [itemTypesExpanded, setItemTypesExpanded] = useState(false)

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
          setError('Failed to load products. Please check your connection and try again.')
          setLoading(false)
        }
      )
    } catch (e) {
      console.error('[Shop] Failed to subscribe to furniture collection:', e)
      setError('Failed to connect to the database. Please try again later.')
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
    let filtered = allProducts.filter(product => {
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

      const matchesPrice = (!minPrice || product.basePricePence >= parseInt(minPrice) * 100) &&
                           (!maxPrice || product.basePricePence <= parseInt(maxPrice) * 100)

      return matchesMaterials && matchesItemTypes && matchesSearch && matchesPrice
    })

    // Sort the filtered products
    if (sortOption === 'price-low') {
      filtered.sort((a, b) => a.basePricePence - b.basePricePence)
    } else if (sortOption === 'price-high') {
      filtered.sort((a, b) => b.basePricePence - a.basePricePence)
    } else {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    }

    return filtered
  }, [allProducts, searchTerm, selectedMaterials, selectedItemTypes, minPrice, maxPrice, sortOption])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedMaterials, selectedItemTypes, minPrice, maxPrice, sortOption])

  // Track search events
  useEffect(() => {
    if (searchTerm.trim()) {
      trackSearch(searchTerm.trim(), filteredProducts.length)
    }
  }, [searchTerm, filteredProducts.length])

  // Track filter usage
  useEffect(() => {
    if (selectedMaterials.length > 0) {
      selectedMaterials.forEach(material => {
        trackFilterUsed('material', material)
      })
    }
  }, [selectedMaterials])

  useEffect(() => {
    if (selectedItemTypes.length > 0) {
      selectedItemTypes.forEach(type => {
        trackFilterUsed('item_type', type)
      })
    }
  }, [selectedItemTypes])

  useEffect(() => {
    const total = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
    if (currentPage > total) {
      setCurrentPage(total)
    }
  }, [filteredProducts.length, currentPage])

  useEffect(() => {
    if (!filtersCollapsed) {
      setMaterialsExpanded(false)
      setItemTypesExpanded(false)
    }
  }, [filtersCollapsed])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const pageProducts = filteredProducts.slice(startIndex, startIndex + PAGE_SIZE)
  const showPagination = filteredProducts.length > PAGE_SIZE
  const showingStart = filteredProducts.length === 0 ? 0 : startIndex + 1
  const showingEnd = filteredProducts.length === 0 ? 0 : startIndex + pageProducts.length

  const hasActiveFilters = Boolean(searchTerm.trim() || selectedMaterials.length || selectedItemTypes.length || minPrice || maxPrice || sortOption !== 'name')

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
    setMinPrice('')
    setMaxPrice('')
    setSortOption('name')
  }

  return (
    <>
      <SEO
        title="Shop Custom Handcrafted Furniture | Nature & Steel Bespoke"
        description="Browse our collection of bespoke handcrafted furniture, bowls, vases, pens, and art pieces. Each item is made to order with customization options available."
        breadcrumb={[
          { name: "Home", url: "/" },
          { name: "Shop", url: "/shop" }
        ]}
      />
      <div>
      <header>
        <h1 className="h1">Nature & Steel Bespoke Collection</h1>
        <p className="muted">Fine core pieces. Built to order. Choose customization if you want it.</p>
      </header>
      <div className="spacer" />
      <div className="shop-layout">
        <aside className="shop-filters" aria-label="Filters">
          <div className="shop-filters__header">
            <h2 className="h2">Search & Filter</h2>
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
          <button
            type="button"
            className="shop-filters__toggle"
            onClick={() => setFiltersCollapsed(!filtersCollapsed)}
            aria-label={filtersCollapsed ? 'Show filters' : 'Hide filters'}
            aria-expanded={!filtersCollapsed}
          >
            Filter
          </button>
          {hasActiveFilters && (
            <button type="button" className="btn ghost" onClick={clearFilters} aria-label="Clear all active filters">
              Clear filters
            </button>
          )}
          <div className={`shop-filters__groups ${filtersCollapsed ? 'is-collapsed' : ''}`}>
          <div className="field">
            <label htmlFor="sort-option">Sort by</label>
            <select
              id="sort-option"
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value)}
            >
              <option value="name">Name</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
          <div className="field">
            <label>Price range (£)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="number"
                placeholder="Min price"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                min="0"
                step="1"
              />
              <input
                type="number"
                placeholder="Max price"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                min="0"
                step="1"
              />
            </div>
          </div>
          {materialOptions.length > 0 && (
            <div className="filter-group">
              <button
                type="button"
                className="filter-group__toggle"
                onClick={() => setMaterialsExpanded(!materialsExpanded)}
                aria-expanded={materialsExpanded}
                aria-controls="materials-filter-options"
              >
                Materials
              </button>
              {materialsExpanded && (
                <div className="filter-group__options" id="materials-filter-options">
                  {materialOptions.map(option => (
                    <label key={option} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.includes(option)}
                        onChange={() => toggleValue(option, setSelectedMaterials)}
                        aria-describedby={`materials-${option.replace(/\s+/g, '-').toLowerCase()}-count`}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {itemTypeOptions.length > 0 && (
            <div className="filter-group">
              <button
                type="button"
                className="filter-group__toggle"
                onClick={() => setItemTypesExpanded(!itemTypesExpanded)}
                aria-expanded={itemTypesExpanded}
                aria-controls="item-types-filter-options"
              >
                Piece type
              </button>
              {itemTypesExpanded && (
                <div className="filter-group__options" id="item-types-filter-options">
                  {itemTypeOptions.map(option => (
                    <label key={option} className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedItemTypes.includes(option)}
                        onChange={() => toggleValue(option, setSelectedItemTypes)}
                        aria-describedby={`item-types-${option.replace(/\s+/g, '-').toLowerCase()}-count`}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {!materialOptions.length && !itemTypeOptions.length && (
            <small className="muted">Filters appear once products are available.</small>
          )}
          </div>
        </aside>
        <section className="shop-results">
          {/* Screen reader announcements for dynamic content */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {loading ? 'Loading products from database...' : 
             error ? `Error: ${error}` :
             `Showing ${filteredProducts.length} of ${allProducts.length} products`}
          </div>

          {error ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <h3 className="h3" style={{ color: 'var(--error, #d32f2f)' }}>Unable to Load Products</h3>
              <p className="muted">{error}</p>
              <p className="muted" style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
                If this persists, please check your internet connection or contact us.
              </p>
              <button
                className="btn"
                onClick={() => {
                  setError(null)
                  setLoading(true)
                  window.location.reload()
                }}
                style={{ marginTop: '1rem' }}
              >
                Try Again
              </button>
            </div>
          ) : loading ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <p className="muted">Loading products...</p>
              </div>
              <LoadingSkeleton type="grid" count={9} />
            </>
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
    </>
  )
}
