import React from 'react'
import { Link } from 'react-router-dom'

export default function ArtistCard({ artist }) {
  return (
    <div className="card">
      <Link to={`/artists/${artist.slug}`}>
        <img src={artist.thumbnail} alt={artist.name} />
      </Link>
      <div style={{paddingTop:'.75rem'}}>
        <h3 style={{marginTop:0}}>{artist.name}</h3>
        <p className="muted">{artist.style}</p>
        <div className="spacer" />
        <Link className="btn block" to={`/artists/${artist.slug}`}>Meet {artist.name.split(' ')[0]}</Link>
      </div>
    </div>
  )
}
