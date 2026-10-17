import { useEffect, useState } from 'react'
import './NavigationAnnouncer.scss'

export default function NavigationAnnouncer() {
  const [title, setTitle] = useState(document.title)
  useEffect(() => {
    const observer = new MutationObserver(() => setTitle(document.title))
    observer.observe(document.querySelector('title')!, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])
  return <span className="navigation-announcement" role="status" aria-live="polite" aria-atomic="true">{title}</span>
}
