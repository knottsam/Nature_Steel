import React from 'react'
import ProductCard from '../components/ProductCard.jsx'
import { products } from '../data/products.js'

export default function Shop() {
  return (
    <div>
  <h1 className="h1">Nature & Steel Bespoke Collection</h1>
  <p className="muted">Ten core pieces. Built to order. Add bespoke art customization if you want it.</p>
      <div className="spacer" />
      <div className="grid grid-3">
        {products.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  )
}
