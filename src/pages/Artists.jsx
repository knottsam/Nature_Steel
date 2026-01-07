import React from 'react'
import { artists } from '../data/artists.js'
import ArtistCard from '../components/ArtistCard.jsx'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'
import SEO from '../components/SEO.jsx'

export default function Artists() {
  const { config, loading } = useSiteConfig()
  if (!loading && !config?.artistsEnabled) {
    return (
      <section className="card" style={{ maxWidth: 650, margin: '0 auto' }}>
        <h1 className="h1">Artists</h1>
        <p className="muted">Our artist directory is currently offline. Please check back soon or contact us for bespoke collaborations.</p>
      </section>
    )
  }
  return (
    <>
      <SEO
        title="Custom Art Artists | Nature & Steel Bespoke"
        description="Meet our talented artists who create bespoke custom artwork for your furniture pieces. Each artist brings unique styles and techniques to your commissioned pieces."
      />
      <div>
      <h1 className="h1">The Artists</h1>
      <p className="muted">Each artist brings a distinct hand-style and palette. Choose your collaborator.</p>
      <div className="spacer" />
      <div className="grid grid-3">
        {artists.map(a => <ArtistCard key={a.id} artist={a} />)}
      </div>
    </div>
    </>
  )
}
