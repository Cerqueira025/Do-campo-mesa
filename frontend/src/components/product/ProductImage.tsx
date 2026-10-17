import { useState } from 'react'
import type { ImgHTMLAttributes } from 'react'

interface Props {
  image?: string
  fallbackImage?: string
  fallbackSrcSet?: string
  alt: string
  className?: string
  sizes?: string
  loading?: ImgHTMLAttributes<HTMLImageElement>['loading']
}

export default function ProductImage({ image, fallbackImage, fallbackSrcSet, alt, className, sizes, loading = 'eager' }: Props) {
  const [failed, setFailed] = useState<string[]>([])
  const source = [image, fallbackImage].find(value => value && !failed.includes(value))
  const local = source === fallbackImage && Boolean(fallbackSrcSet)
  return source ? (
    <img className={className} src={source} alt={alt}
      srcSet={local ? fallbackSrcSet : undefined} sizes={local ? sizes : undefined}
      width={local ? 960 : undefined} height={local ? 960 : undefined} loading={loading} decoding="async"
      onError={() => setFailed(values => [...values, source])} />
  ) : <span className={className} role="img" aria-label={`${alt}: imagem indisponível`}>Imagem indisponível</span>
}
