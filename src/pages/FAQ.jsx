import React from 'react'
import { SITE_SETTINGS } from '../data/siteSettings.js'

export default function FAQ() {
  return (
    <div>
      <h1 className="h1">FAQ & Process</h1>
      <h2 className="h2">Process</h2>
      <ol>
  <li>Choose a bespoke furniture item.</li>
  <li>Choose an artist (or No Custom Art).</li>
        <li>Complete purchase.</li>
  <li>We build your bespoke furniture.</li>
        <li>We ship to the chosen artist.</li>
        <li>Artist completes the work.</li>
        <li>Artist ships the finished piece to you.</li>
      </ol>
      <p className="muted">
        Note: Custom pieces add approximately {SITE_SETTINGS.leadTimeCustomExtraDays} days to delivery.
      </p>

      <div className="divider" />
      <h2 className="h2">Common questions</h2>
      <h3>How is pricing calculated?</h3>
      <p>Base price plus the selected artist's fee, plus a transparent markup to cover handling and coordination.</p>

      <h3>Can I return a custom piece?</h3>
      <p>Custom pieces are final sale unless there is a manufacturing defect. Contact us within 7 days of delivery.</p>

      <h3>Care instructions?</h3>
      <p>Use a soft cloth; avoid abrasive cleaners on painted surfaces. Keep away from prolonged direct sunlight.</p>
    </div>
  )
}
