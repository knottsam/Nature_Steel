import React, { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO.jsx'
import { useCart } from '../context/CartContext.jsx'
import { trackPurchase } from '../utils/analytics.js'

function formatStatus(status) {
  if (!status) return null
  const normalised = status.toString().trim()
  if (!normalised) return null
  return normalised
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')
}

export default function CheckoutComplete() {
  const [searchParams] = useSearchParams()
  const { clearCart } = useCart()
  const clearedRef = useRef(false)

  useEffect(() => {
    if (clearedRef.current) return
    clearCart()
    clearedRef.current = true
  }, [clearCart])

  const identifiers = useMemo(() => {
    const entries = [
      ['Order ID', searchParams.get('order') || searchParams.get('orderId')],
      ['Transaction ID', searchParams.get('transactionId') || searchParams.get('transaction_id')],
      ['Payment ID', searchParams.get('paymentId') || searchParams.get('payment_id')],
      ['Payment Link ID', searchParams.get('paymentLinkId') || searchParams.get('payment_link_id')],
      ['Reference', searchParams.get('referenceId') || searchParams.get('reference_id')],
    ]
    return entries.filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
  }, [searchParams])

  const receiptUrl = searchParams.get('receiptUrl') || searchParams.get('receipt_url')
  const rawStatus = searchParams.get('status') || searchParams.get('statusCode')
  const displayStatus = formatStatus(rawStatus) || 'Completed'

  // Track successful purchase
  useEffect(() => {
    if (identifiers.length > 0) {
      // We don't have the cart items here since they were cleared, so we'll track with minimal data
      const orderDetails = {
        orderId: searchParams.get('order') || searchParams.get('orderId'),
        transactionId: searchParams.get('transactionId') || searchParams.get('transaction_id')
      }
      // Track purchase with empty cart items since they're cleared, but we know there was a purchase
      trackPurchase(orderDetails, [], 0)
    }
  }, [identifiers, searchParams])

  return (
    <div className='card'>
      <SEO title='Checkout complete' description='Payment confirmed with Square.' />
      <h2 className='h2'>Thank you for your order</h2>
      <p>
        Your payment has been processed securely through Square. A confirmation email and receipt will follow
        shortly. If it does not arrive within a few minutes, please check your spam folder.
      </p>

      <div className='divider' />

      <h3 className='h3'>Payment status</h3>
      <p className='muted'>Square reports this checkout as: <strong>{displayStatus}</strong></p>

      {identifiers.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 className='h3'>Reference details</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {identifiers.map(([label, value]) => (
              <li key={label} style={{ marginBottom: '0.5rem' }}>
                <span className='muted'>{label}:</span> <code>{value}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {receiptUrl && (
        <div style={{ marginTop: '1.5rem' }}>
          <a className='btn' href={receiptUrl} target='_blank' rel='noopener noreferrer'>
            View Square receipt
          </a>
        </div>
      )}

      <div className='divider' />

      <p className='muted'>Need to make a change or have a question? We are happy to help.</p>
      <div className='row' style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <Link to='/shop' className='btn secondary'>Continue shopping</Link>
      </div>
    </div>
  )
}