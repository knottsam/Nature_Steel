import React from 'react'
import { Outlet } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import Footer from './components/Footer.jsx'
import { CartProvider } from './context/CartContext.jsx'
import './index.css'

export default function App() {
  return (
    <CartProvider>
      <div className="app">
        <NavBar />
        <main className="container">
          <Outlet />
        </main>
        <Footer />
      </div>
    </CartProvider>
  )
}
