import { SITE_SETTINGS } from '../data/siteSettings.js'

export function priceForProduct(product, artistOrNull) {
  const base = product.basePricePence
  if (!artistOrNull) return base
  const artistFee = artistOrNull.feePence
  const markup = Math.round(artistFee * SITE_SETTINGS.markupPercent)
  return base + artistFee + markup
}
