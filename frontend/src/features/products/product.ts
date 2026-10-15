export interface ApiProduct {
  _id: string
  nome: string
  categoria: string
  preco: number
  unidade: string
  imagens: string[]
}

export interface ProductDetail extends ApiProduct {
  descricao: string
  stock: number
  epoca: string[]
  biologico: boolean
  produtorId: {
    _id: string
    nome: string
    perfilProdutor?: {
      descricao?: string
      localidade?: string
      coordenadas?: { latitude: number; longitude: number }
    }
  }
}

const images: Record<string, string> = {
  azeite: new URL('../../assets/Azeite.png', import.meta.url).href,
  batata: new URL('../../assets/Batata.png', import.meta.url).href,
  leite: new URL('../../assets/Leite.png', import.meta.url).href,
  mel: new URL('../../assets/Mel.png', import.meta.url).href,
  vinho: new URL('../../assets/Vinho.png', import.meta.url).href,
  maçã: new URL('../../assets/Macas.png', import.meta.url).href,
}

export const priceFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

export function productImages(product: ApiProduct) {
  const image = product.imagens?.find((value) => {
    try {
      const url = new URL(value, 'https://local.invalid')
      return value.trim() !== '' && ['http:', 'https:'].includes(url.protocol)
    } catch { return false }
  })
  const fallbackImage = images[product.nome.trim().toLowerCase()]
  const source = image?.trim()
  const local = source && !/^(https?:)?\/\//i.test(source) ? new URL(source, 'https://local.invalid') : null
  const resolved = local ? `${local.pathname}${local.search}${local.hash}` : source
  return { image: resolved || fallbackImage, fallbackImage }
}

export function mapProduct(product: ApiProduct) {
  return {
    id: product._id,
    title: product.nome,
    category: product.categoria,
    weight: `${priceFormatter.format(product.preco / 100)}/${product.unidade}`,
    ...productImages(product),
  }
}

export function productIdFromPath(path: string) {
  const match = /^\/produtos\/([a-f\d]{24})\/?$/i.exec(path)
  return match?.[1] ?? null
}

export function catalogReturnUrl(search: string) {
  const value = new URLSearchParams(search).get('regresso')
  return value === '/' || value?.startsWith('/?') ? value : '/'
}

export function productHref(id: string, catalogUrl = '/') {
  const params = new URLSearchParams({ regresso: catalogUrl })
  return `/produtos/${encodeURIComponent(id)}${catalogUrl === '/' ? '' : `?${params}`}`
}

export function originMapUrl(coordinates?: { latitude: number; longitude: number }) {
  if (!coordinates) return null
  const { latitude, longitude } = coordinates
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=13/${latitude}/${longitude}`
}
