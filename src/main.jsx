import React, { lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { SiteConfigProvider } from './context/SiteConfigContext.jsx'

const Home = lazy(() => import('./pages/Home.jsx'))
const Shop = lazy(() => import('./pages/Shop.jsx'))
const Product = lazy(() => import('./pages/Product.jsx'))
const Artists = lazy(() => import('./pages/Artists.jsx'))
const Artist = lazy(() => import('./pages/Artist.jsx'))
const FAQ = lazy(() => import('./pages/FAQ.jsx'))
const About = lazy(() => import('./pages/About.jsx'))
const Contact = lazy(() => import('./pages/Contact.jsx'))
const Cart = lazy(() => import('./pages/Cart.jsx'))
const Checkout = lazy(() => import('./pages/Checkout.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const CheckoutComplete = lazy(() => import('./pages/CheckoutComplete.jsx'))
const CheckoutCancelled = lazy(() => import('./pages/CheckoutCancelled.jsx'))
const CheckoutReturn = lazy(() => import('./pages/CheckoutReturn.jsx'))

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
    { path: 'checkout/complete', element: <CheckoutComplete /> },
    { path: 'checkout/cancelled', element: <CheckoutCancelled /> },
    { path: 'checkout/return', element: <CheckoutReturn /> },
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
