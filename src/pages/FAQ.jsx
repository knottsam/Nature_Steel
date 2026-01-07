import React from 'react'
import { SITE_SETTINGS } from '../data/siteSettings.js'
import SEO from '../components/SEO.jsx'

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ & Ordering Process | Nature & Steel Bespoke"
        description="Frequently asked questions about our handcrafted furniture process, lead times, customization options, pricing, and how to order bespoke pieces."
      />
      <div>
      <h1 className="h1">FAQ & Process</h1>
      <h2 className="h2">Process</h2>
      <ol>
  <li>Choose a bespoke piece.</li>
        <li>Complete purchase.</li>
  <li>We build your bespoke piece.</li>
        <li>We ship to you.</li>
        <li>You enjoy your unique piece.</li>
      </ol>
      <p className="muted">
        Note: Custom pieces add approximately {SITE_SETTINGS.leadTimeCustomExtraDays} days to delivery.
      </p>

      <div className="divider" />
      <h2 className="h2">Common questions</h2>
      <h3>How is pricing calculated?</h3>
      <p>Base price, plus a transparent markup to cover handling and coordination.</p>

      <h3>Can I return a custom piece?</h3>
      <p>Custom pieces are final sale unless there is a manufacturing defect. Contact us within 7 days of delivery.</p>

      <h3>How do I care for my piece?</h3>
      <p>Use a soft cloth; avoid abrasive cleaners on all surfaces. Keep away from prolonged direct sunlight. Most pieces are finished in a natural oil or wax, which should be reapplied periodically to maintain the finish.</p>

      <h3>How do I reapply the finish?</h3>
      <p>Reapply natural oil or wax finishes as needed, typically every 6-12 months, depending on use and exposure.</p>
    </div>
    </>
  )
}
