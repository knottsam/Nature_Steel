import React, { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'
import logoImage from '../assets/images/N&S_logo.png'

export default function NavBar() {
  const { totalQuantity } = useCart()
  const { config } = useSiteConfig()
  const showArtistsLink = config?.artistsEnabled ?? true
  const [menuOpen, setMenuOpen] = useState(false)
  const toggleMenu = () => setMenuOpen(prev => !prev)
  const closeMenu = () => setMenuOpen(false)

  const handleLinkClick = () => {
    if (menuOpen) closeMenu()
  }

  return (
    <nav>
      <div className="inner">
        <Link className="logo" to="/" onClick={handleLinkClick}>
          <img className="logo-mark" src={logoImage} alt="Nature & Steel Bespoke logo" />
          <span className="logo-wordmark">NATURE & STEEL BESPOKE</span>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-controls="navigation"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <span />
          <span />
          <span />
        </button>
        <div className={`nav-links${menuOpen ? ' is-open' : ''}`} id="navigation">
          <NavLink to="/shop" onClick={handleLinkClick}>Shop</NavLink>
          {showArtistsLink && <NavLink to="/artists" onClick={handleLinkClick}>Artists</NavLink>}
          <NavLink to="/about" onClick={handleLinkClick}>About Us</NavLink>
          <NavLink to="/faq" onClick={handleLinkClick}>FAQ</NavLink>
          <NavLink to="/contact" onClick={handleLinkClick}>Contact</NavLink>
          <NavLink to="/cart" className="nav-cart" onClick={handleLinkClick}>Cart ({totalQuantity})</NavLink>
          {/* <NavLink to="/admin">Admin</NavLink> */}
        </div>
  <div className="spacer-grow" />
      </div>
    </nav>
  )
}
