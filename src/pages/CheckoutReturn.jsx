import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import SEO from '../components/SEO.jsx'
import { functions } from '../firebase'

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [statusMessage, setStatusMessage] = useState('Checking your Square checkout status...')

  useEffect(() => {
    let active = true
    const orderId = (searchParams.get('orderId') || searchParams.get('order') || '').trim()
    const token = (searchParams.get('token') || searchParams.get('reference') || searchParams.get('idempotencyKey') || '').trim()

    if (!orderId && !token) {
      navigate('/checkout/cancelled?status=cancelled', { replace: true })
      return () => {
        active = false
      }
    }

    let attempts = 0
    const maxAttempts = 15 // 15 attempts * 2s = 30s max wait
    const pollInterval = 2000 // 2 seconds

    const checkStatus = async () => {
      if (!active) return
      attempts++
      try {
        setStatusMessage(`Checking payment status... (attempt ${attempts}/${maxAttempts})`)
        const callable = httpsCallable(functions, 'getOrderStatus')
        const response = await callable({ orderId: orderId || undefined, token: token || undefined })
        if (!active) return
        const data = response?.data || response
        if (!data || data.status === 'NOT_FOUND') {
          navigate('/checkout/cancelled?status=cancelled', { replace: true })
          return
        }

        const params = new URLSearchParams()
        if (data.orderId) params.set('orderId', data.orderId)
        if (data.paymentLinkId) params.set('paymentLinkId', data.paymentLinkId)
        if (data.paymentId) params.set('paymentId', data.paymentId)
        if (data.squareOrderId) params.set('squareOrderId', data.squareOrderId)
        if (data.receiptUrl) params.set('receiptUrl', data.receiptUrl)
        if (data.token) params.set('token', data.token)
        if (data.status) params.set('status', data.status)

        const normalizedStatus = typeof data.status === 'string' ? data.status.toUpperCase() : ''
        const successStatuses = ['COMPLETED', 'CAPTURED', 'APPROVED', 'PAID']
        const failedStatuses = ['CANCELLED', 'FAILED', 'DECLINED', 'REJECTED']

        if (successStatuses.includes(normalizedStatus)) {
          navigate(`/checkout/complete?${params.toString()}`, { replace: true })
          return
        } else if (failedStatuses.includes(normalizedStatus)) {
          navigate(`/checkout/cancelled?${params.toString()}`, { replace: true })
          return
        } else if (normalizedStatus === 'PENDING' && attempts < maxAttempts) {
          // Still pending, poll again
          setTimeout(checkStatus, pollInterval)
          return
        } else {
          // Timed out or unknown status
          navigate('/checkout/cancelled?status=timeout', { replace: true })
          return
        }
      } catch (err) {
        if (!active) return
        console.error('[checkout] Failed to verify order status', err)
        setStatusMessage('We could not verify the payment status automatically. Redirecting you back to the cancel page...')
        navigate('/checkout/cancelled?status=unknown', { replace: true })
      }
    }

    checkStatus()

    return () => {
      active = false
    }
  }, [searchParams, navigate])

  return (
    <div className='card'>
      <SEO title='Checking checkout' description='Verifying your Square checkout status.' />
      <h2 className='h2'>Returning from Square...</h2>
      <p className='muted'>{statusMessage}</p>
      <p className='muted' style={{ marginTop: '1rem' }}>
        If you are not redirected automatically, you can close this page and return to your cart.
      </p>
    </div>
  )
}
