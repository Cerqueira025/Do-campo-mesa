import { useState } from 'react'

interface Props {
  image?: string
  fallbackImage?: string
  alt: string
  className?: string
}

export default function ProductImage({ image, fallbackImage, alt, className }: Props) {
  const [failed, setFailed] = useState<string[]>([])
  const source = [image, fallbackImage].find((value) => value && !failed.includes(value))
  return source ? (
    <img className={className} src={source} alt={alt}
      onError={() => setFailed((values) => [...values, source])} />
  ) : <span className={className} role="img" aria-label={`${alt}: imagem indisponível`}>Imagem indisponível</span>
}
