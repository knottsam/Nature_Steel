export function formatPrice(pence, currency='GBP', locale=undefined) {
  const value = pence / 100
  return new Intl.NumberFormat(locale || undefined, { style: 'currency', currency }).format(value)
}
