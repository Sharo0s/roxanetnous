export type CommuneResult = {
  city: string
  postcode: string
  context: string
}

export async function searchCommunes(query: string): Promise<CommuneResult[]> {
  if (!query || query.length < 2) return []

  try {
    const encoded = encodeURIComponent(query)
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encoded}&type=municipality&limit=5`
    )

    if (!res.ok) return []

    const data = await res.json()

    if (!data.features || data.features.length === 0) return []

    return data.features.map(
      (f: { properties: { city: string; postcode: string; context: string } }) => ({
        city: f.properties.city,
        postcode: f.properties.postcode,
        context: f.properties.context,
      })
    )
  } catch {
    return []
  }
}
