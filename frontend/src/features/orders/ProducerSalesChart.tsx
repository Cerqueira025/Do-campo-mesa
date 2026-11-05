import { priceFormatter } from "../products/product";

const axisPrice = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default function ProducerSalesChart({
  series,
}: {
  series: { label: string; total: number }[];
}) {
  const peak = Math.max(...series.map(({ total }) => total));
  const step = Math.max(100, Math.ceil(peak / 300) * 100);
  const maximum = step * 3;
  const points = series.map(({ total }, index) => ({
    x: series.length === 1 ? 300 : (index / (series.length - 1)) * 600,
    y: 120 - (total / maximum) * 120,
  }));
  const line = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const labelInterval = Math.ceil(series.length / 6);
  const lastIndex = series.length - 1;

  return (
    <div className="producer-summary__chart">
      <div className="producer-summary__plot" aria-hidden="true">
        <div className="producer-summary__axis">
          {[3, 2, 1, 0].map((tick) => (
            <span key={tick}>{axisPrice.format((tick * step) / 100)}</span>
          ))}
        </div>
        <div className="producer-summary__plot-body">
          <svg viewBox="0 0 600 120" preserveAspectRatio="none">
            {[0, 40, 80, 120].map((y) => (
              <line key={y} className="producer-summary__gridline" x1="0" y1={y} x2="600" y2={y} />
            ))}
            <polygon className="producer-summary__area" points={`0,120 ${line} 600,120`} />
            <polyline className="producer-summary__trend" points={line} />
            {points.length === 1 && (
              <line className="producer-summary__trend" x1="295" x2="305" y1={points[0].y} y2={points[0].y} />
            )}
          </svg>
          <div className="producer-summary__labels">
            {series.map(({ label }, index) =>
              index === lastIndex ||
              (index % labelInterval === 0 && lastIndex - index >= labelInterval) ? (
                <span key={label} style={{ left: `${points[index].x / 6}%` }}>{label}</span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <details>
        <summary>Ver valores do gráfico</summary>
        <ul>
          {series.map(({ label, total }) => (
            <li key={label}>{label} · {priceFormatter.format(total / 100)}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
