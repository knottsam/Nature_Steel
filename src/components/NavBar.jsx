import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'
import logoImage from '../assets/images/N&S_logo.png'

export default function NavBar() {
  const { totalQuantity } = useCart()
  const { config } = useSiteConfig()
  const showArtistsLink = config?.artistsEnabled ?? true
  return (
    <nav>
      <div className="inner">
        <Link className="logo" to="/">
          <img className="logo-mark" src={logoImage} alt="Nature & Steel Bespoke logo" />
          <span className="logo-wordmark">NATURE & STEEL BESPOKE</span>
        </Link>
        <div className="nav-links">
          <NavLink to="/shop">Shop</NavLink>
          {showArtistsLink && <NavLink to="/artists">Artists</NavLink>}
          <NavLink to="/about">About Us</NavLink>
          <NavLink to="/faq">FAQ</NavLink>
          <NavLink to="/contact">Contact</NavLink>
          {/* <NavLink to="/admin">Admin</NavLink> */}
        </div>
        <div className="spacer-grow" />
        <NavLink to="/cart" className="nav-cart">Cart ({totalQuantity})</NavLink>
      </div>
    </nav>
  )
}
