import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CANONICAL_DOMAIN = 'https://www.natureandsteelbespoke.co.uk'

// Static routes
const STATIC_ROUTES = [
  '',
  'shop',
  'about',
  'artists',
  'faq',
  'projects',
  'cart',
  'checkout'
]

// Known product slugs (add more as needed)
const PRODUCT_SLUGS = [
  'steel-coffee-table',
  'industrial-shelf'
]

// Known artist IDs
const ARTIST_IDS = [
  'artist-1',
  'artist-2'
]

// Generate dynamic routes
const PRODUCT_ROUTES = PRODUCT_SLUGS.map(slug => `product/${slug}`)
const ARTIST_ROUTES = ARTIST_IDS.map(id => `artist/${id}`)

const ROUTES = [...STATIC_ROUTES, ...PRODUCT_ROUTES, ...ARTIST_ROUTES]

const prioritize = (route) => {
  if (route === '') return 1.0 // Homepage
  if (route === 'shop') return 0.9 // Shop page
  if (route.startsWith('product/')) return 0.8 // Product pages
  if (route === 'artists') return 0.8 // Artists listing
  if (route.startsWith('artist/')) return 0.7 // Individual artist pages
  if (['about', 'faq', 'projects'].includes(route)) return 0.6 // Content pages
  return 0.5 // Other pages like cart, checkout
}
const getChangefreq = (route) => {
  if (route === '') return 'daily' // Homepage
  if (route === 'shop') return 'daily' // Shop page
  if (route.startsWith('product/')) return 'weekly' // Product pages
  if (route === 'artists') return 'weekly' // Artists listing
  if (route.startsWith('artist/')) return 'monthly' // Individual artist pages
  if (['about', 'faq', 'projects'].includes(route)) return 'monthly' // Content pages
  return 'yearly' // Other pages like cart, checkout
}
const lastmod = new Date().toISOString()

const buildUrl = (route) => new URL(route, CANONICAL_DOMAIN).toString()

const buildUrlEntry = (route) => {
  const loc = buildUrl(route)
  const priority = prioritize(route).toFixed(1)
  const changefreq = getChangefreq(route)
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ROUTES.map(buildUrlEntry).join('\n')}\n</urlset>`

const outDir = path.resolve('public')
const outputPath = path.join(outDir, 'sitemap.xml')

await mkdir(outDir, { recursive: true })
await writeFile(outputPath, xml, 'utf8')
console.log(`✅ sitemap.xml generated at ${outputPath}`)

// Also generate robots.txt
const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${CANONICAL_DOMAIN}/sitemap.xml`

const robotsPath = path.join(outDir, 'robots.txt')
await writeFile(robotsPath, robotsTxt, 'utf8')
console.log(`✅ robots.txt generated at ${robotsPath}`)
