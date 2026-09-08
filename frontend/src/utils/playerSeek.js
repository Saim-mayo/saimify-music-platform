export const beginPlayerSeek = ({ store, setIsSeeking }) => {
  store.setUserSeeking(true)
  setIsSeeking(true)
}

export const endPlayerSeek = ({ store, setIsSeeking }) => {
  store.setUserSeeking(false)
  setIsSeeking(false)
}
