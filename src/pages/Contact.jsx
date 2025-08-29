import React, { useState } from 'react'

export default function Contact() {
  const [sent, setSent] = useState(false)
  function onSubmit(e) {
    e.preventDefault()
    setSent(true)
  }
  return (
    <div>
      <h1 className="h1">Contact</h1>
      <p className="muted">Questions about a piece, an artist, or a commission? Drop us a note.</p>
      {sent ? (
        <div className="card">Thanks — we'll get back to you shortly.</div>
      ) : (
        <form onSubmit={onSubmit} className="card">
          <div className="field">
            <label>Name</label>
            <input required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" required />
          </div>
          <div className="field">
            <label>Message</label>
            <textarea rows={5} required />
          </div>
          <button className="btn">Send</button>
        </form>
      )}
    </div>
  )
}
