export function formatPrice(pence, currency='GBP', locale=undefined) {
  return new Intl.NumberFormat(locale || undefined, { style: 'currency', currency }).format(pence / 100)
}
