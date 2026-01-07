import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CANONICAL_DOMAIN = 'https://www.natureandsteelbespoke.co.uk'
const ROUTES = [
  '',
  'shop',
  'about',
  'artists',
  'contact',
  'faq',
  'cart',
  'checkout',
  // Note: Dynamic routes like /product/slug and /artist/slug would be added here
  // when we have a way to fetch them at build time
]

const prioritize = (route) => (route === '' ? 1 : 0.8)
const changefreq = 'weekly'
const lastmod = new Date().toISOString()

const buildUrl = (route) => new URL(route, CANONICAL_DOMAIN).toString()

const buildUrlEntry = (route) => {
  const loc = buildUrl(route)
  const priority = prioritize(route).toFixed(1)
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
