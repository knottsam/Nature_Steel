import React from 'react'

export default function LoadingSkeleton({ type = 'card', count = 1 }) {
  if (type === 'card') {
    return (
      <div className="card product-card" style={{ border: 'none', boxShadow: 'none' }}>
        <div className="product-card__media" style={{
          background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          borderRadius: '8px',
          height: '200px'
        }} />
        <div className="product-card__body">
          <div style={{
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            height: '20px',
            borderRadius: '4px',
            marginBottom: '0.5rem'
          }} />
          <div style={{
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            height: '16px',
            borderRadius: '4px',
            width: '60%'
          }} />
        </div>
      </div>
    )
  }

  if (type === 'grid') {
    return (
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
        {Array.from({ length: count }, (_, i) => (
          <LoadingSkeleton key={i} type="card" />
        ))}
      </div>
    )
  }

  return null
}