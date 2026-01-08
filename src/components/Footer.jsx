import React from 'react'
import { Link } from 'react-router-dom'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'

export default function Footer() {
  const { config } = useSiteConfig()

  return (
    <footer>
      <div className="container">
        <div className="grid grid-4">
          <div>
            <div className="kicker">Nature & Steel Bespoke</div>
            <p className="muted">Handcrafted pieces, made to order.</p>
          </div>
          <div>
            <div className="h3">Explore</div>
            <ul className="footer-links">
              <li><Link to="/shop">Shop</Link></li>
              {(config.artistsEnabled && config.artistPagesEnabled) && <li><Link to="/artists">Artists</Link></li>}
              <li><Link to="/faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <div className="h3">Company</div>
            <ul className="footer-links">
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/projects">Projects</Link></li>
            </ul>
          </div>
          <div className="footer-social">
            <span className="footer-social__label">Follow</span>
            <a
              href="https://www.facebook.com/share/187w6k1C75/?mibextid=wwXIfr"
              aria-label="Facebook"
              className="footer-social__icon"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M14.5 8.25H16V5.5h-1.5c-2.07 0-3.5 1.26-3.5 3.5v1.5H9v2.75h2v6.75h2.75v-6.75H16l.25-2.75h-2.75V9.5c0-.78.31-1.25 1-1.25Z" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/natureandsteelbespoke"
              aria-label="Instagram"
              className="footer-social__icon"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M8.75 4c-2.65 0-4.75 2.1-4.75 4.75v6.5C4 17.9 6.1 20 8.75 20h6.5c2.65 0 4.75-2.1 4.75-4.75v-6.5C20 6.1 17.9 4 15.25 4h-6.5Zm0 1.5h6.5c1.8 0 3.25 1.45 3.25 3.25v6.5c0 1.8-1.45 3.25-3.25 3.25h-6.5A3.24 3.24 0 0 1 5.5 15.25v-6.5A3.24 3.24 0 0 1 8.75 5.5Zm7.5 1.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM12 8.25A3.76 3.76 0 0 0 8.25 12 3.76 3.76 0 0 0 12 15.75 3.76 3.76 0 0 0 15.75 12 3.76 3.76 0 0 0 12 8.25Zm0 1.5A2.26 2.26 0 0 1 14.25 12 2.26 2.26 0 0 1 12 14.25 2.26 2.26 0 0 1 9.75 12 2.26 2.26 0 0 1 12 9.75Z" />
              </svg>
            </a>
          </div>
        </div>
        <div className="divider" />
        <small className="muted">© {new Date().getFullYear()} Nature & Steel Bespoke. All rights reserved.</small>
      </div>
    </footer>
  )
}
