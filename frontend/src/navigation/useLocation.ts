import { useSyncExternalStore } from 'react'
import { locationSnapshot, subscribeLocation } from './navigation'

export function useLocation() {
  return useSyncExternalStore(subscribeLocation, locationSnapshot)
}
