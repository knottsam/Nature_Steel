import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { artists } from '../data/artists.js'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'
import SEO from '../components/SEO.jsx'

export default function Artist() {
  const { slug } = useParams()
  const { config, loading } = useSiteConfig()
  if (!loading && !config?.artistPagesEnabled) {
    return (
      <section className="card" style={{ maxWidth: 650, margin: '0 auto' }}>
        <h1 className="h1">Artist profile</h1>
        <p className="muted">Artist profiles are temporarily unavailable. Please visit the shop for current pieces.</p>
      </section>
    )
  }
  const artist = artists.find(skeg => skeg.slug === slug)
  const [currentSlide, setCurrentSlide] = useState(0)
  
  if (!artist) return <p>Not found</p>

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % artist.gallery.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + artist.gallery.length) % artist.gallery.length)
  }

  return (
    <>
      <SEO
        title={`${artist.name} - Custom Artist | Nature & Steel Bespoke`}
        description={`Meet ${artist.name}, one of our talented artists specializing in bespoke custom artwork for furniture. ${artist.bio || 'Explore their unique style and portfolio.'}`}
        image={artist.thumbnail}
        breadcrumb={[
          { name: "Home", url: "/" },
          { name: "Artists", url: "/artists" },
          { name: artist.name, url: `/artist/${artist.id}` }
        ]}
      />
      <div>
      <div className="grid" style={{gridTemplateColumns:'1.125fr 3fr 2fr', gap:'2rem', alignItems: 'stretch'}}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <img 
            src={artist.thumbnail} 
            alt={artist.name} 
            style={{
              borderRadius: '12px',
              objectFit: 'cover',
              width: '100%',
              height: '400px'
            }}
            loading="lazy"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 className="h1">{artist.name}</h1>
          <p className="muted">{artist.style}</p>
          <p>{artist.bio}</p>
          <div className="spacer" />
          <div>
            <Link className="btn" to="/shop">Shop pieces</Link>
          </div>
        </div>
        
        {/* Carousel with label */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>Artist's Gallery</h3>
          <div style={{ position: 'relative', flex: 1 }}>
            <img 
              src={artist.gallery[currentSlide]} 
              alt={`${artist.name} work ${currentSlide + 1}`}
              style={{
                borderRadius: '12px',
                objectFit: 'cover',
                width: '100%',
                height: '400px',
                display: 'block'
              }}
              loading="lazy"
            />
          
          {/* Previous Button */}
          <button
            onClick={prevSlide}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ‹
          </button>
          
          {/* Next Button */}
          <button
            onClick={nextSlide}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ›
          </button>
          
          {/* Dots Indicator */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '16px'
          }}>
            {artist.gallery.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: currentSlide === idx ? '#333' : '#ccc',
                  cursor: 'pointer',
                  padding: 0
                }}
              />
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
    </>
  )
}
