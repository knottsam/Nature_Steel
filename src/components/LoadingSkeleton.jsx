import React from 'react'

export default function LoadingSkeleton({ type = 'card', count = 1 }) {
  const shimmerStyle = {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  }

  if (type === 'card') {
    return (
      <div className="card product-card" style={{ border: 'none', boxShadow: 'none' }}>
        <div className="product-card__media" style={{
          ...shimmerStyle,
          borderRadius: '8px',
          height: '200px'
        }} />
        <div className="product-card__body">
          <div style={{
            ...shimmerStyle,
            height: '20px',
            borderRadius: '4px',
            marginBottom: '0.5rem'
          }} />
          <div style={{
            ...shimmerStyle,
            height: '16px',
            borderRadius: '4px',
            width: '60%'
          }} />
        </div>
      </div>
    )
  }

  if (type === 'hero') {
    return (
      <section className="hero">
        <div className="hero-content">
          <div style={{
            ...shimmerStyle,
            height: '3rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            width: '80%'
          }} />
          <div style={{
            ...shimmerStyle,
            height: '1.5rem',
            borderRadius: '6px',
            marginBottom: '0.5rem',
            width: '60%'
          }} />
          <div style={{
            ...shimmerStyle,
            height: '1.5rem',
            borderRadius: '6px',
            width: '70%'
          }} />
        </div>
        <div className="gallery">
          <div className="gallery-viewport">
            <div className="gallery-track" style={{ display: 'flex', gap: '1rem' }}>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="gallery-card" style={{
                  ...shimmerStyle,
                  width: '300px',
                  height: '200px',
                  borderRadius: '12px',
                  flexShrink: 0
                }} />
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (type === 'product-detail') {
    return (
      <div className="grid" style={{gridTemplateColumns:'1.1fr 1fr', gap:'2rem'}}>
        <div className="grid" style={{gap:'1rem'}}>
          <div style={{
            ...shimmerStyle,
            height: '400px',
            borderRadius: '12px'
          }} />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} style={{
                ...shimmerStyle,
                width: '64px',
                height: '64px',
                borderRadius: '6px'
              }} />
            ))}
          </div>
        </div>
        <div>
          <div style={{
            ...shimmerStyle,
            height: '2.5rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            width: '90%'
          }} />
          <div style={{
            ...shimmerStyle,
            height: '2rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            width: '40%'
          }} />
          <div style={{
            ...shimmerStyle,
            height: '1.2rem',
            borderRadius: '4px',
            marginBottom: '0.5rem',
            width: '80%'
          }} />
          <div style={{
            ...shimmerStyle,
            height: '1.2rem',
            borderRadius: '4px',
            marginBottom: '2rem',
            width: '60%'
          }} />
          <div className="divider" style={{ margin: '2rem 0' }} />
          <div style={{
            ...shimmerStyle,
            height: '2.5rem',
            borderRadius: '8px',
            width: '100%'
          }} />
        </div>
      </div>
    )
  }

  if (type === 'artist-card') {
    return (
      <div className="card artist-card" style={{ border: 'none', boxShadow: 'none' }}>
        <div style={{
          ...shimmerStyle,
          height: '200px',
          borderRadius: '8px',
          marginBottom: '1rem'
        }} />
        <div style={{
          ...shimmerStyle,
          height: '1.5rem',
          borderRadius: '6px',
          marginBottom: '0.5rem',
          width: '70%'
        }} />
        <div style={{
          ...shimmerStyle,
          height: '1rem',
          borderRadius: '4px',
          width: '50%'
        }} />
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

  if (type === 'page') {
    return (
      <div style={{ padding: '2rem 0' }}>
        <div style={{
          ...shimmerStyle,
          height: '2.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          width: '60%',
          marginLeft: 'auto',
          marginRight: 'auto'
        }} />
        <div style={{
          ...shimmerStyle,
          height: '1.2rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          width: '80%',
          marginLeft: 'auto',
          marginRight: 'auto'
        }} />
        <div style={{
          ...shimmerStyle,
          height: '1.2rem',
          borderRadius: '4px',
          marginBottom: '3rem',
          width: '50%',
          marginLeft: 'auto',
          marginRight: 'auto'
        }} />
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="card" style={{ padding: '1.5rem' }}>
              <div style={{
                ...shimmerStyle,
                height: '200px',
                borderRadius: '8px',
                marginBottom: '1rem'
              }} />
              <div style={{
                ...shimmerStyle,
                height: '1.5rem',
                borderRadius: '6px',
                marginBottom: '0.5rem',
                width: '70%'
              }} />
              <div style={{
                ...shimmerStyle,
                height: '1rem',
                borderRadius: '4px',
                width: '50%'
              }} />
            </div>
          ))}
        </div>
      </div>
    )
  }
}