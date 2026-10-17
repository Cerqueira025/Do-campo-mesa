import './LoadingPlaceholder.scss'

export default function LoadingPlaceholder({ label }: { label: string }) {
  return <div className="loading-placeholder" role="status">
    <span>{label}</span>
    <div className="loading-placeholder__preview" aria-hidden="true" />
    <div className="loading-placeholder__line" aria-hidden="true" />
    <div className="loading-placeholder__line loading-placeholder__line--short" aria-hidden="true" />
  </div>
}
