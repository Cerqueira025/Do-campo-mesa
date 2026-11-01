export interface ApiProduct {
  _id: string;
  nome: string;
  categoria: string;
  preco: number;
  unidade: string;
}

export interface ProductDetail extends ApiProduct {
  descricao: string;
  stock: number;
  epoca: string[];
  biologico: boolean;
  produtorId: {
    _id: string;
    nome: string;
    perfilProdutor?: {
      descricao?: string;
      localidade?: string;
      coordenadas?: { latitude: number; longitude: number };
    };
  };
}

const images: Record<string, { small: string; large: string }> = {
  abóbora: {
    small: new URL("../../assets/Abobora-480.webp", import.meta.url).href,
    large: new URL("../../assets/Abobora-960.webp", import.meta.url).href,
  },
  alho: {
    small: new URL("../../assets/Alho-480.webp", import.meta.url).href,
    large: new URL("../../assets/Alho-960.webp", import.meta.url).href,
  },
  azeite: {
    small: new URL("../../assets/Azeite-480.webp", import.meta.url).href,
    large: new URL("../../assets/Azeite-960.webp", import.meta.url).href,
  },
  batata: {
    small: new URL("../../assets/Batata-480.webp", import.meta.url).href,
    large: new URL("../../assets/Batata-960.webp", import.meta.url).href,
  },
  brócolos: {
    small: new URL("../../assets/Brocolos-480.webp", import.meta.url).href,
    large: new URL("../../assets/Brocolos-960.webp", import.meta.url).href,
  },
  cebola: {
    small: new URL("../../assets/Cebola-480.webp", import.meta.url).href,
    large: new URL("../../assets/Cebola-960.webp", import.meta.url).href,
  },
  cenoura: {
    small: new URL("../../assets/Cenoura-480.webp", import.meta.url).href,
    large: new URL("../../assets/Cenoura-960.webp", import.meta.url).href,
  },
  cereja: {
    small: new URL("../../assets/Cereja-480.webp", import.meta.url).href,
    large: new URL("../../assets/Cereja-960.webp", import.meta.url).href,
  },
  laranja: {
    small: new URL("../../assets/Laranja-480.webp", import.meta.url).href,
    large: new URL("../../assets/Laranja-960.webp", import.meta.url).href,
  },
  leite: {
    small: new URL("../../assets/Leite-480.webp", import.meta.url).href,
    large: new URL("../../assets/Leite-960.webp", import.meta.url).href,
  },
  mel: {
    small: new URL("../../assets/Mel-480.webp", import.meta.url).href,
    large: new URL("../../assets/Mel-960.webp", import.meta.url).href,
  },
  morango: {
    small: new URL("../../assets/Morango-480.webp", import.meta.url).href,
    large: new URL("../../assets/Morango-960.webp", import.meta.url).href,
  },
  nozes: {
    small: new URL("../../assets/Nozes-480.webp", import.meta.url).href,
    large: new URL("../../assets/Nozes-960.webp", import.meta.url).href,
  },
  ovos: {
    small: new URL("../../assets/Ovos-480.webp", import.meta.url).href,
    large: new URL("../../assets/Ovos-960.webp", import.meta.url).href,
  },
  pão: {
    small: new URL("../../assets/Pao-480.webp", import.meta.url).href,
    large: new URL("../../assets/Pao-960.webp", import.meta.url).href,
  },
  pera: {
    small: new URL("../../assets/Pera-480.webp", import.meta.url).href,
    large: new URL("../../assets/Pera-960.webp", import.meta.url).href,
  },
  queijo: {
    small: new URL("../../assets/Queijo-480.webp", import.meta.url).href,
    large: new URL("../../assets/Queijo-960.webp", import.meta.url).href,
  },
  tomate: {
    small: new URL("../../assets/Tomate-480.webp", import.meta.url).href,
    large: new URL("../../assets/Tomate-960.webp", import.meta.url).href,
  },
  vinho: {
    small: new URL("../../assets/Vinho-480.webp", import.meta.url).href,
    large: new URL("../../assets/Vinho-960.webp", import.meta.url).href,
  },
  maçã: {
    small: new URL("../../assets/Macas-480.webp", import.meta.url).href,
    large: new URL("../../assets/Macas-960.webp", import.meta.url).href,
  },
};

export const priceFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

export function productImages(product: Pick<ApiProduct, "nome">) {
  const image = images[product.nome.trim().toLowerCase()];
  return {
    image: image?.large,
    srcSet: image ? `${image.small} 480w, ${image.large} 960w` : undefined,
  };
}

export function mapProduct(product: ApiProduct) {
  return {
    id: product._id,
    title: product.nome,
    category: product.categoria,
    weight: `${priceFormatter.format(product.preco / 100)}/${product.unidade}`,
    ...productImages(product),
  };
}

export function productIdFromPath(path: string) {
  const match = /^\/produtos\/([a-f\d]{24})\/?$/i.exec(path);
  return match?.[1] ?? null;
}

export function catalogReturnUrl(search: string) {
  const value = new URLSearchParams(search).get("regresso");
  return value === "/" || value?.startsWith("/?") || value?.startsWith("/#")
    ? value
    : "/";
}

export function productHref(id: string, catalogUrl = "/") {
  const params = new URLSearchParams({ regresso: catalogUrl });
  return `/produtos/${encodeURIComponent(id)}${catalogUrl === "/" ? "" : `?${params}`}`;
}

export function originMapUrl(coordinates?: {
  latitude: number;
  longitude: number;
}) {
  if (!coordinates) return null;
  const { latitude, longitude } = coordinates;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`;
}
