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

const images: Record<string, { small: string; large: string }> = {
  azeite: { small: new URL('../../assets/Azeite-480.webp', import.meta.url).href, large: new URL('../../assets/Azeite-960.webp', import.meta.url).href },
  batata: { small: new URL('../../assets/Batata-480.webp', import.meta.url).href, large: new URL('../../assets/Batata-960.webp', import.meta.url).href },
  leite: { small: new URL('../../assets/Leite-480.webp', import.meta.url).href, large: new URL('../../assets/Leite-960.webp', import.meta.url).href },
  mel: { small: new URL('../../assets/Mel-480.webp', import.meta.url).href, large: new URL('../../assets/Mel-960.webp', import.meta.url).href },
  vinho: { small: new URL('../../assets/Vinho-480.webp', import.meta.url).href, large: new URL('../../assets/Vinho-960.webp', import.meta.url).href },
  maçã: { small: new URL('../../assets/Macas-480.webp', import.meta.url).href, large: new URL('../../assets/Macas-960.webp', import.meta.url).href },
}

export const priceFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

export function productImages(product: Pick<ApiProduct, 'nome' | 'imagens'>) {
  const image = product.imagens?.find((value) => {
    try {
      const url = new URL(value, 'https://local.invalid')
      return value.trim() !== '' && ['http:', 'https:'].includes(url.protocol)
    } catch { return false }
  })
  const fallback = images[product.nome.trim().toLowerCase()]
  const fallbackImage = fallback?.large
  const fallbackSrcSet = fallback ? `${fallback.small} 480w, ${fallback.large} 960w` : undefined
  const source = image?.trim()
  const local = source && !/^(https?:)?\/\//i.test(source) ? new URL(source, 'https://local.invalid') : null
  const resolved = local ? `${local.pathname}${local.search}${local.hash}` : source
  return { image: resolved || fallbackImage, fallbackImage, fallbackSrcSet }
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
  return value === '/' || value?.startsWith('/?') || value?.startsWith('/#') ? value : '/'
}

export function productHref(id: string, catalogUrl = '/') {
  const params = new URLSearchParams({ regresso: catalogUrl })
  return `/produtos/${encodeURIComponent(id)}${catalogUrl === '/' ? '' : `?${params}`}`
}

export function originMapUrl(coordinates?: { latitude: number; longitude: number }) {
  if (!coordinates) return null
  const { latitude, longitude } = coordinates
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return `https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`
}
