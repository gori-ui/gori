import type { ComparisonLink } from '../types/gori'

export function buildExternalComparisonLinks(
  latitude: number | null,
  longitude: number | null,
): ComparisonLink[] {
  if (latitude == null || longitude == null) {
    return []
  }

  return [
    {
      id: 'firms',
      label: 'NASA FIRMS',
      url: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${longitude.toFixed(4)},${latitude.toFixed(4)},10.5z`,
    },
    {
      id: 'effis',
      label: 'EFFIS',
      url: 'https://effis.jrc.ec.europa.eu/apps/effis_current_situation/',
    },
  ]
}
