export const SEARCH_FOCUS_EVENT = 'saimify:search-focus'
export const SEARCH_FOCUS_STORAGE_KEY = 'saimify-search-focus-pending'

export const requestSearchFocus = () => {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(SEARCH_FOCUS_STORAGE_KEY, '1')
  window.dispatchEvent(new CustomEvent(SEARCH_FOCUS_EVENT, {
    detail: {
      source: 'navbar-search-button',
    },
  }))
}
