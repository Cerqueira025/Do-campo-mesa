import { useState } from "react";
import type { ImgHTMLAttributes } from "react";

interface Props {
  image?: string;
  srcSet?: string;
  alt: string;
  className?: string;
  sizes?: string;
  loading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
}

export default function ImageWithFallback({
  image,
  srcSet,
  alt,
  className,
  sizes,
  loading = "eager",
}: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  return image && !failed.includes(image) ? (
    <img
      className={className}
      src={image}
      alt={alt}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={960}
      height={960}
      loading={loading}
      decoding="async"
      onError={() => setFailed((values) => [...values, image])}
    />
  ) : (
    <span
      className={className}
      role="img"
      aria-label={`${alt}: imagem indisponível`}
    >
      Imagem indisponível
    </span>
  );
}
