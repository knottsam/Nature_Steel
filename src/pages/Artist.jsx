import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { artists } from '../data/artists.js'

export default function Artist() {
  const { slug } = useParams()
  const artist = artists.find(a => a.slug === slug)
  if (!artist) return <p>Not found</p>

  return (
    <div>
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:'2rem'}}>
        <div>
          <img src={artist.thumbnail} alt={artist.name} />
        </div>
        <div>
          <h1 className="h1">{artist.name}</h1>
          <p className="muted">{artist.style}</p>
          <p>{artist.bio}</p>
          <div className="spacer" />
          <Link className="btn" to="/shop">Shop pieces</Link>
        </div>
      </div>
      <div className="spacer" />
      <h2 className="h2">Gallery</h2>
      <div className="grid grid-4">
        {artist.gallery.map((src, i) => <img key={i} src={src} alt={`${artist.name} work ${i+1}`} />)}
      </div>
    </div>
  )
}
