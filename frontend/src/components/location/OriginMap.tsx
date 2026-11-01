import { useId } from "react";
import mapImage from "../../assets/MapaLocalizacao.webp";
import "./OriginMap.scss";

interface OriginMapProps {
  locality?: string;
  mapUrl?: string | null;
}

export default function OriginMap({ locality, mapUrl }: OriginMapProps) {
  const titleId = useId();

  if (!locality && !mapUrl) return null;

  return (
    <section className="origin-map" aria-labelledby={titleId}>
      <h2 className="origin-map__title" id={titleId}>
        A origem, aqui perto
      </h2>
      {locality && <p className="origin-map__locality">{locality}</p>}

      <figure className="origin-map__figure">
        <img
          className="origin-map__image"
          src={mapImage}
          alt="Mapa ilustrativo com ruas, zonas verdes e um marcador de localização."
          width={960}
          height={640}
          loading="lazy"
          decoding="async"
        />
      </figure>

      {mapUrl && (
        <a
          className="origin-map__link"
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver no mapa a localização real (abre num novo separador)"
        >
          Ver no mapa <span aria-hidden="true">↗</span>
        </a>
      )}
    </section>
  );
}
