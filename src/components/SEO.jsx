import { useEffect } from 'react'
import defaultHeroImage from '../assets/images/Skeg.jpg?url'

const BRAND = 'Nature & Steel Bespoke'
const DEFAULT_TITLE = `${BRAND} | Handcrafted furniture & bespoke art pieces`
const DEFAULT_DESCRIPTION = 'Handcrafted furniture, bowls, vases, pens, and art-ready pieces. Built to order with bespoke options from Nature & Steel Bespoke.'
const DEFAULT_IMAGE = defaultHeroImage
const DEFAULT_KEYWORDS = [
  'Nature & Steel',
  'bespoke furniture',
  'handcrafted furniture',
  'bowls',
  'vases',
  'pens',
  'handmade pens',
  'handmade furniture',
  'handmade bowls',
  'handmade vases',
  'custom art furniture',
  'handmade home decor',
]
const CANONICAL_DOMAIN = 'https://www.natureandsteelbespoke.co.uk'
const DEFAULT_IMAGE_URL = `${CANONICAL_DOMAIN}${DEFAULT_IMAGE.startsWith('/') ? DEFAULT_IMAGE : `/${DEFAULT_IMAGE}`}`
const ORGANIZATION_ID = `${CANONICAL_DOMAIN}#organization`
const WEBSITE_ID = `${CANONICAL_DOMAIN}#website`

function buildCanonicalUrl(url) {
  const fallbackPath = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : ''
  if (url && url.startsWith('http')) {
    const parsed = new URL(url)
    return `${CANONICAL_DOMAIN}${parsed.pathname}${parsed.search}`
  }

  const pathOrUrl = url || fallbackPath
  if (!pathOrUrl) {
    return CANONICAL_DOMAIN
  }

  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${CANONICAL_DOMAIN}${normalizedPath}`
}

function updateCanonicalLink(href) {
  if (!href) return
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

function buildAbsoluteImageUrl(imagePath) {
  if (!imagePath) return undefined
  if (imagePath.startsWith('http')) return imagePath
  const normalized = imagePath.startsWith('/') ? imagePath : `/${imagePath}`
  return `${CANONICAL_DOMAIN}${normalized}`
}

function buildStructuredData(canonicalHref, title, description, imageUrl) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: BRAND,
        url: CANONICAL_DOMAIN,
        description: DEFAULT_DESCRIPTION,
        logo: DEFAULT_IMAGE_URL,
        foundingDate: '2020',
        knowsAbout: [
          'Handcrafted furniture',
          'Bespoke furniture',
          'Woodworking',
          'Metalworking',
          'Custom art pieces',
          'Handmade bowls',
          'Handmade vases',
          'Handmade pens'
        ],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Nature & Steel Bespoke Collection',
          itemListElement: [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Product',
                name: 'Handcrafted Furniture'
              }
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Product',
                name: 'Bespoke Art Pieces'
              }
            }
          ]
        },
        sameAs: [
          // Add social media URLs here when available
          // 'https://www.instagram.com/natureandsteel',
          // 'https://www.facebook.com/natureandsteel'
        ]
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: BRAND,
        url: CANONICAL_DOMAIN,
        description: DEFAULT_DESCRIPTION,
        publisher: { '@id': ORGANIZATION_ID },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${CANONICAL_DOMAIN}/shop?search={search_term_string}`
          },
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'WebPage',
        url: canonicalHref,
        name: title,
        description,
        isPartOf: { '@id': WEBSITE_ID },
        about: { '@id': ORGANIZATION_ID },
        image: imageUrl,
        primaryImageOfPage: imageUrl,
        datePublished: '2020-01-01',
        dateModified: new Date().toISOString().split('T')[0]
      },
    ],
  }
}

function upsertStructuredData(data) {
  if (!data || typeof document === 'undefined') return
  let script = document.head.querySelector('script[data-structured-data="seo"]')
  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-structured-data', 'seo')
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(data)
}

function upsertMeta(attr, name, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export default function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  keywords = [],
  noIndex = false,
  structuredData,
  breadcrumb,
}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${BRAND}` : DEFAULT_TITLE
    const desc = description || DEFAULT_DESCRIPTION
    const img = image || DEFAULT_IMAGE
    const absoluteImageUrl = buildAbsoluteImageUrl(img)
    document.title = fullTitle

    upsertMeta('name', 'description', desc)
    upsertMeta('name', 'keywords', [...DEFAULT_KEYWORDS, ...keywords].join(', '))
    if (noIndex) {
      upsertMeta('name', 'robots', 'noindex, nofollow')
      upsertMeta('name', 'googlebot', 'noindex, nofollow')
    }

    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', desc)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:image', absoluteImageUrl)
    const canonicalHref = buildCanonicalUrl(url)
    upsertMeta('property', 'og:url', canonicalHref)
    updateCanonicalLink(canonicalHref)

    const structuredData = buildStructuredData(canonicalHref, fullTitle, desc, absoluteImageUrl)
    upsertStructuredData(structuredData)

    if (breadcrumb && breadcrumb.length > 0) {
      const breadcrumbData = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumb.map((crumb, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": crumb.name,
          "item": buildCanonicalUrl(crumb.url)
        }))
      }
      upsertStructuredData(breadcrumbData, 'breadcrumb')
    }

    if (structuredData) {
      upsertStructuredData(structuredData, 'custom')
    }

    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', desc)
    upsertMeta('name', 'twitter:image', absoluteImageUrl)
  }, [title, description, image, url, type, keywords, noIndex, structuredData, breadcrumb])

  return null
}
