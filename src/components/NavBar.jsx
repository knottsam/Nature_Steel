import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'

export default function NavBar() {
  const { totalQuantity } = useCart()
  return (
    <nav>
      <div className="inner">
  <Link className="logo" to="/">NATURE & STEEL BESPOKE</Link>
        <div className="nav-links">
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/artists">Artists</NavLink>
          <NavLink to="/faq">FAQ</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/contact">Contact</NavLink>
        </div>
        <div className="spacer-grow" />
        <NavLink to="/cart" className="nav-cart">Cart ({totalQuantity})</NavLink>
      </div>
    </nav>
  )
}
