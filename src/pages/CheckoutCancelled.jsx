import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO.jsx'

function resolveMessage(params) {
  const status = params.get('status') || params.get('state')
  if (!status) return 'You left the Square checkout before completing payment.'
  const normalised = status.toString().toLowerCase()
  if (normalised.includes('timeout')) {
    return 'Your checkout session expired before the payment was completed.'
  }
  if (normalised.includes('cancel')) {
    return 'You cancelled the Square checkout before payment was captured.'
  }
  return 'The checkout session ended before payment was completed.'
}

export default function CheckoutCancelled() {
  const [searchParams] = useSearchParams()
  const message = resolveMessage(searchParams)

  return (
    <div className='card'>
      <SEO title='Checkout cancelled' description='Square checkout was not completed.' />
      <h2 className='h2'>Checkout cancelled</h2>
      <p>{message}</p>
      <p className='muted'>Your cart items are still saved so you can try again when you are ready.</p>

      <div className='row' style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <Link to='/cart' className='btn'>Return to cart</Link>
      </div>
    </div>
  )
}