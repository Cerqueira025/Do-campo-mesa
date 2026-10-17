import { navigate } from '../../navigation/navigation.ts'

export const seasons = [
  { value: 'primavera', label: 'Primavera' },
  { value: 'verao', label: 'Verão' },
  { value: 'outono', label: 'Outono' },
  { value: 'inverno', label: 'Inverno' },
  { value: 'todo-o-ano', label: 'Todo o ano' },
]

export const ratingOptions = [
  { value: '', label: 'Todas as avaliações', rating: 0 },
  { value: '4.5', label: '4,5 e superior', rating: 4.5 },
  { value: '4', label: '4,0 e superior', rating: 4 },
  { value: '3.5', label: '3,5 e superior', rating: 3.5 },
  { value: '3', label: '3,0 e superior', rating: 3 },
]

export interface CatalogFilters {
  categoria: string
  epoca: string
  bio: '' | 'true' | 'false'
  produtorId: string
  localidade: string
  avaliacaoMin: string
}

export interface FilterOptions {
  categorias: string[]
  produtores: { id: string; nome: string }[]
  localidades: string[]
}

export const emptyFilters: CatalogFilters = {
  categoria: '', epoca: '', bio: '', produtorId: '', localidade: '', avaliacaoMin: '',
}

export function readCatalogUrl() {
  const params = new URLSearchParams(window.location.search)
  const epoca = params.get('epoca') ?? ''
  const bio = params.get('bio')
  const produtorId = params.get('produtorId') ?? ''
  const avaliacaoMin = params.get('avaliacaoMin') ?? ''
  return {
    search: (params.get('q') ?? '').slice(0, 100),
    filters: {
      categoria: params.get('categoria') ?? '',
      epoca: seasons.some((season) => season.value === epoca) ? epoca : '',
      bio: bio === 'true' || bio === 'false' ? bio : '',
      produtorId: /^[a-f\d]{24}$/i.test(produtorId) ? produtorId : '',
      localidade: (params.get('localidade') ?? '').slice(0, 100),
      avaliacaoMin: ratingOptions.some((option) => option.value === avaliacaoMin) ? avaliacaoMin : '',
    } as CatalogFilters,
  }
}

export function writeCatalogUrl(search: string, filters: CatalogFilters, replace: boolean) {
  const url = new URL(window.location.href)
  const values = { q: search.trim(), ...filters }
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  if (url.href !== window.location.href) {
    navigate(url.href, { replace, preserveScroll: true })
  }
}
