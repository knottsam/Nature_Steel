import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="grid grid-4">
          <div>
            <div className="kicker">Nature & Steel Bespoke</div>
            <p className="muted">Handcrafted pieces. Customizable pieces, made to order.</p>
          </div>
          <div>
            <div className="h3">Explore</div>
            <ul>
              <li><Link to="/shop">Shop</Link></li>
              <li><Link to="/artists">Artists</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <div className="h3">Company</div>
            <ul>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <div className="h3">Newsletter</div>
            <p className="muted">Get product drops and artist collabs.</p>
            <form onSubmit={(e)=>e.preventDefault()}>
              <input placeholder="you@email.com" />
            </form>
          </div>
        </div>
        <div className="divider" />
        <small className="muted">© {new Date().getFullYear()} Nature & Steel Bespoke. All rights reserved.</small>
      </div>
    </footer>
  )
}
