import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

import Home from './pages/Home.jsx'
import Shop from './pages/Shop.jsx'
import Product from './pages/Product.jsx'
import Artists from './pages/Artists.jsx'
import Artist from './pages/Artist.jsx'
import FAQ from './pages/FAQ.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import Admin from './pages/Admin.jsx'
import { SiteConfigProvider } from './context/SiteConfigContext.jsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'shop', element: <Shop /> },
      { path: 'product/:slug', element: <Product /> },
      { path: 'artists', element: <Artists /> },
      { path: 'artists/:slug', element: <Artist /> },
      { path: 'faq', element: <FAQ /> },
      { path: 'about', element: <About /> },
      { path: 'contact', element: <Contact /> },
      { path: 'cart', element: <Cart /> },
      { path: 'checkout', element: <Checkout /> },
      { path: 'admin', element: <Admin /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <SiteConfigProvider>
        <RouterProvider router={router} />
      </SiteConfigProvider>
    </React.StrictMode>,
)
