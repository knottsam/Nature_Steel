import React from 'react'
import { artists } from '../data/artists.js'
import ArtistCard from '../components/ArtistCard.jsx'

export default function Artists() {
  return (
    <div>
      <h1 className="h1">The Artists</h1>
      <p className="muted">Each artist brings a distinct hand-style and palette. Choose your collaborator.</p>
      <div className="spacer" />
      <div className="grid grid-3">
        {artists.map(a => <ArtistCard key={a.id} artist={a} />)}
      </div>
    </div>
  )
}
