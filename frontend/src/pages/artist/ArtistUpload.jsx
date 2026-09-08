import { useMemo, useRef, useState } from 'react'
import { Skeleton, Toast } from '@/components/common'
import { Artwork } from '@/components/ui'
import { useAuthStore } from '@/store'
import useArtistContent from '@/features/artist/useArtistContent'

const getUploadErrorMessage = (err) => {
  const responseMessage = err?.response?.data?.message
  const validationErrors = err?.response?.data?.errors

  if (responseMessage) return responseMessage
  if (Array.isArray(validationErrors) && validationErrors.length) return validationErrors[0]?.msg || 'Unable to upload track.'
  return 'Unable to upload track.'
}

const FileUploadControl = ({
  label,
  accept,
  file,
  onChange,
  required = false,
  buttonLabel = 'Choose file',
  placeholder = 'No file selected',
  note = '',
}) => {
  const inputRef = useRef(null)
  const handleClick = () => inputRef.current?.click()

  return (
    <div className="field file-upload-control">
      <span>{label}</span>
      <div className="file-upload-field">
        <button type="button" className="btn btn-ghost file-upload-button" onClick={handleClick}>
          {file ? 'Change file' : buttonLabel}
        </button>
        <span className={`file-upload-filename ${file ? '' : 'file-upload-filename--empty'}`}>
          {file?.name || placeholder}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        required={required}
        onChange={onChange}
        className="file-upload-input"
      />
      {note ? <p className="subtitle" style={{ margin: 0 }}>{note}</p> : null}
    </div>
  )
}

export default function ArtistUpload() {
  const user = useAuthStore((state) => state.user)
  const genreOptions = ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'R&B', 'Indie', 'Classical', 'Jazz', 'Folk', 'Other']
  const [title, setTitle] = useState('')
  const [songGenre, setSongGenre] = useState('')
  const [albumTitle, setAlbumTitle] = useState('')
  const [albumGenre, setAlbumGenre] = useState('')
  const [selectedSongIds, setSelectedSongIds] = useState([])
  const [file, setFile] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [albumCoverFile, setAlbumCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [albumCoverPreview, setAlbumCoverPreview] = useState('')
  const [songVisibility, setSongVisibility] = useState('public')
  const [songPremiumOnly, setSongPremiumOnly] = useState(false)
  const [songAllowDownload, setSongAllowDownload] = useState(true)
  const [albumVisibility, setAlbumVisibility] = useState('public')
  const [toast, setToast] = useState({ message: '', tone: 'info' })
  const [busy, setBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const ownerId = useMemo(() => String(user?._id || user?.id || ''), [user?._id, user?.id])
  const { songs, albums, loading: loadingContent, error: contentError, reload: loadContent, uploadTrack, createAlbum, editSong, removeSong, editAlbum, removeAlbum } = useArtistContent(ownerId)
  const [albumHint, setAlbumHint] = useState('')
  const albumFormRef = useRef(null)
  const [editingSongId, setEditingSongId] = useState(null)
  const [editSongTitle, setEditSongTitle] = useState('')
  const [editSongVisibility, setEditSongVisibility] = useState('public')
  const [confirmDeleteSongId, setConfirmDeleteSongId] = useState(null)
  const [editingAlbumId, setEditingAlbumId] = useState(null)
  const [editAlbumTitle, setEditAlbumTitle] = useState('')
  const [editAlbumVisibility, setEditAlbumVisibility] = useState('public')
  const [confirmDeleteAlbumId, setConfirmDeleteAlbumId] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file) {
      setToast({ message: 'Select an audio file to upload.', tone: 'error' })
      return
    }

    setToast({ message: '', tone: 'info' })
    setBusy(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('title', title)
    if (songGenre) {
      formData.append('genre', songGenre)
    }
    formData.append('music', file)
    formData.append('visibility', songVisibility)
    formData.append('premiumOnly', String(songPremiumOnly))
    formData.append('allowDownload', String(songAllowDownload))
    if (coverFile) {
      formData.append('cover', coverFile)
    }

    try {
      const data = await uploadTrack(formData, (event) => {
        if (event.total) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100))
        }
      })
      setToast({ message: data?.message || 'Upload submitted.', tone: 'success' })
      setTitle('')
      setSongGenre('')
      setFile(null)
      setCoverFile(null)
      setCoverPreview('')
      setUploadProgress(100)
      setAlbumHint('Your track is ready — add it to an album below.')
      await loadContent()
      albumFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (err) {
      setToast({ message: getUploadErrorMessage(err), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleCreateAlbum = async (event) => {
    event.preventDefault()
    setToast({ message: '', tone: 'info' })
    setBusy(true)

    try {
      if (!selectedSongIds.length) {
        throw new Error('Select at least one track for the album.')
      }
      const formData = new FormData()
      formData.append('title', albumTitle)
      if (albumGenre) {
        formData.append('genre', albumGenre)
      }
      formData.append('musics', JSON.stringify(selectedSongIds))
      formData.append('visibility', albumVisibility)
      if (albumCoverFile) formData.append('cover', albumCoverFile)

      const data = await createAlbum(formData)
      setToast({ message: data?.message || 'Album created.', tone: 'success' })
      setAlbumTitle('')
      setAlbumGenre('')
      setSelectedSongIds([])
      setAlbumCoverFile(null)
      setAlbumCoverPreview('')
      setAlbumHint('')
      await loadContent()
    } catch (err) {
      setToast({ message: err?.response?.data?.message || 'Unable to create album.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleCoverChange = (event) => {
    const nextFile = event.target.files?.[0] || null
    setCoverFile(nextFile)
    if (!nextFile) {
      setCoverPreview('')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setCoverPreview(reader.result)
    reader.readAsDataURL(nextFile)
  }

  const handleAlbumCoverChange = (event) => {
    const nextFile = event.target.files?.[0] || null
    setAlbumCoverFile(nextFile)
    if (!nextFile) {
      setAlbumCoverPreview('')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAlbumCoverPreview(reader.result)
    reader.readAsDataURL(nextFile)
  }

  const toggleSongSelection = (songId) => {
    setSelectedSongIds((current) => current.includes(songId) ? current.filter((entry) => entry !== songId) : [...current, songId])
  }

  const handleConfirmDeleteSong = async (songId) => {
    if (!songId) return
    setConfirmDeleteSongId(null)
    setBusy(true)
    try {
      await removeSong(songId)
      setToast({ message: 'Track deleted.', tone: 'success' })
      await loadContent()
    } catch (err) {
      setToast({ message: err?.response?.data?.message || 'Unable to delete track', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmDeleteAlbum = async (albumId) => {
    if (!albumId) return
    setConfirmDeleteAlbumId(null)
    setBusy(true)
    try {
      await removeAlbum(albumId)
      setToast({ message: 'Album deleted.', tone: 'success' })
      await loadContent()
    } catch (err) {
      setToast({ message: err?.response?.data?.message || 'Unable to delete album', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const renderStatusBadge = (status, disabledReason) => {
    const normalizedStatus = String(status || '').toLowerCase()
    let label = 'Unknown'
    let classes = 'status-pill--neutral'

    if (normalizedStatus === 'active') {
      label = 'Active'
      classes = 'status-pill--approved'
    } else if (normalizedStatus === 'processing') {
      label = 'Processing'
      classes = 'status-pill--pending'
    } else if (normalizedStatus === 'pending') {
      label = 'Pending'
      classes = 'status-pill--pending'
    } else if (normalizedStatus === 'rejected') {
      label = 'Rejected'
      classes = 'status-pill--danger'
    } else if (normalizedStatus === 'disabled') {
      label = 'Disabled'
      classes = 'status-pill--neutral'
    }

    return (
      <span className={`status-pill ${classes}`}>
        {label}{(normalizedStatus === 'disabled' || normalizedStatus === 'rejected') && disabledReason ? ` • ${disabledReason}` : ''}
      </span>
    )
  }

  const artistStatus = String(user?.artistVerification?.status || 'none').toLowerCase()

  return (
    <div className="content-shell">
      {/* Compact header: reduced height, summary + quick actions */}
      <section className="card profile-hero" style={{ padding: '10px 12px' }}>
        <div className="profile-hero-main" style={{ alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div className="profile-avatar-shell" style={{ width: 56, height: 56 }}>
              {user?.avatar ? <img src={user.avatar} alt={user.username || 'Artist'} className="profile-avatar" /> : <div className="profile-avatar" />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: '1.125rem', lineHeight: 1 }}>{user?.artistName || user?.username || 'Artist'}</h1>
                <span className={`status-pill ${artistStatus === 'approved' ? 'status-pill--approved' : artistStatus === 'pending' ? 'status-pill--pending' : 'status-pill--neutral'}`} style={{ padding: '6px 10px', fontSize: '0.72rem' }}>
                  {artistStatus === 'approved' ? 'Approved' : artistStatus === 'pending' ? 'Pending' : 'Pending'}
                </span>
              </div>
              <p className="subtitle" style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>Upload releases, manage albums, and keep your catalog visible.</p>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => { const el = document.querySelector('form[onSubmit]'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>Upload</button>
            <button type="button" className="btn btn-ghost" onClick={() => albumFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Create album</button>
          </div>
        </div>
      </section>

      <Toast message={toast.message} tone={toast.tone} onClose={() => setToast({ message: '', tone: 'info' })} />

      {/* Two-column responsive grid: left = workspace, right = management */}
      <div className="artist-upload-grid">
        <div className="artist-upload-column">
          <form className="card auth-form-stack" onSubmit={handleSubmit}>
            <div className="section-heading">
              <h2>Upload a track</h2>
              <span className="section-link">Audio upload</span>
            </div>
            <div className="field-row">
              <div className="field">
                <span>Track title</span>
                <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Track title" />
              </div>
              <div className="field">
                <span>Genre</span>
                <select className="input" value={songGenre} onChange={(event) => setSongGenre(event.target.value)}>
                  <option value="">Select genre</option>
                  {genreOptions.map((genre) => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>
              <FileUploadControl
                label="Audio file"
                accept="audio/*"
                file={file}
                required
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                buttonLabel="Choose audio"
                placeholder="No audio selected"
              />
            </div>
        <div className="field">
          <span>Visibility</span>
          <select className="input" value={songVisibility} onChange={(event) => setSongVisibility(event.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
          </select>
          <p className="subtitle">Public: anyone can find and play this. Unlisted: only people with a direct link. Private: only visible to you.</p>
        </div>
          <div className="field-row">
            <label className="field-checkbox">
              <input type="checkbox" checked={songPremiumOnly} onChange={(event) => setSongPremiumOnly(event.target.checked)} />
              <span>Premium only</span>
            </label>
            <label className="field-checkbox">
              <input type="checkbox" checked={songAllowDownload} onChange={(event) => setSongAllowDownload(event.target.checked)} />
              <span>Allow download</span>
            </label>
          </div>
        <FileUploadControl
          label="Cover art (optional)"
          accept="image/*"
          file={coverFile}
          onChange={handleCoverChange}
          buttonLabel="Choose cover"
          placeholder="No cover selected"
          note="Optional artwork for this track."
        />
        {coverPreview ? <img src={coverPreview} alt="Cover preview" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px', marginTop: '0.5rem' }} /> : null}
          {uploadProgress ? (
            <div className="progress-bar" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={busy || !file}>Upload</button>
          </div>
          </form>

          <form className="card auth-form-stack" onSubmit={handleCreateAlbum} ref={albumFormRef}>
        <div className="section-heading">
          <h2>Create an album</h2>
          <span className="section-link">Release builder</span>
        </div>
        {albumHint ? <div className="field"><span className="subtitle">{albumHint}</span></div> : null}
        <div className="field">
          <span>Album title</span>
          <input className="input" value={albumTitle} onChange={(event) => setAlbumTitle(event.target.value)} placeholder="Album title" />
        </div>
        <div className="field">
          <span>Genre</span>
          <select className="input" value={albumGenre} onChange={(event) => setAlbumGenre(event.target.value)}>
            <option value="">Select genre</option>
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
          <p className="subtitle">Optional genre metadata for your album.</p>
        </div>
        <div className="field-row">
          <FileUploadControl
            label="Album cover (optional)"
            accept="image/*"
            file={albumCoverFile}
            onChange={handleAlbumCoverChange}
            buttonLabel="Choose cover"
            placeholder="No album cover selected"
            note="Optional artwork for the album."
          />
        </div>
        {albumCoverPreview ? <img src={albumCoverPreview} alt="Album cover preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '10px', marginTop: '0.5rem' }} /> : null}
        <div className="field-row">
          <div className="field">
            <span>Visibility</span>
            <select className="input" value={albumVisibility} onChange={(event) => setAlbumVisibility(event.target.value)}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <p className="subtitle">Public albums are visible to everyone. Private albums are only visible to you.</p>
          </div>
        </div>
        <div className="field">
          <span>Select tracks</span>
          <div className="grid-list" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {songs.length ? songs.map((song) => {
              const checked = selectedSongIds.includes(song._id)
              return (
                <label key={song._id} className={`card ${checked ? 'is-selected' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', minHeight: 56 }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSongSelection(song._id)} style={{ margin: 0, flex: '0 0 auto' }} />
                  <div style={{ minWidth: 0 }}>
                    <strong title={song.title} style={{ display: 'block', fontSize: '0.95rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</strong>
                    <span title={song.artist?.username || 'Artist'} className="subtitle" style={{ display: 'block', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist?.username || 'Artist'}</span>
                  </div>
                </label>
              )
            }) : <p className="subtitle">Upload a track first to build albums.</p>}
          </div>
          <p className="subtitle">Select the tracks to include in this album.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={busy || !selectedSongIds.length || !albumTitle}>Create album</button>
        </div>
          </form>
        </div>

        {/* Right column: management panel (released tracks, albums, activity) */}
        <aside>
          <section>
            <div className="section-heading">
              <h2>Your releases</h2>
              <span className="section-link">Current catalog</span>
            </div>
            {loadingContent ? (
              <div className="grid-list">
                <div className="card"><Skeleton className="profile-skeleton" lines={3} /></div>
                <div className="card"><Skeleton className="profile-skeleton" lines={3} /></div>
              </div>
            ) : contentError ? (
              <div className="error-banner">
                <span>{contentError}</span>
                <button type="button" className="btn btn-ghost btn-compact" onClick={() => window.location.reload()}>Retry</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {/* Released Tracks heading with compact action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Released Tracks</h3>
                  <button type="button" className="btn btn-ghost btn-compact">Manage</button>
                </div>

                {/* Tracks list as a compact management list */}
                <div className="card" style={{ padding: 8 }}>
                  {songs.length ? songs.slice(0, 6).map((song) => (
                    <div key={song._id} className="release-row">
                      <Artwork item={song} size="compact" className="release-thumb" />
                      <div className="release-row-copy">
                        {editingSongId === song._id ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input className="input" value={editSongTitle} onChange={(e) => setEditSongTitle(e.target.value)} style={{ flex: 1 }} />
                            <select className="input" value={editSongVisibility} onChange={(e) => setEditSongVisibility(e.target.value)} style={{ width: 140 }}>
                              <option value="public">Public</option>
                              <option value="private">Private</option>
                              <option value="unlisted">Unlisted</option>
                            </select>
                          </div>
                        ) : (
                          <>
                            <strong title={song.title} style={{ display: 'block', minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', wordBreak: 'break-word' }}>{song.title}</strong>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                              <span className="subtitle" style={{ fontSize: '0.82rem' }}>{song.artist?.username || 'Artist'}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="release-row-actions">
                        {renderStatusBadge(song.status, song.disabledReason)}
                        {editingSongId === song._id ? (
                          <>
                            <button type="button" className="btn btn-primary btn-compact" onClick={async () => {
                              setBusy(true)
                              try {
                                await editSong(song._id, { title: editSongTitle, visibility: editSongVisibility })
                                setEditingSongId(null)
                                await loadContent()
                              } catch (err) {
                                setToast({ message: err?.response?.data?.message || 'Unable to update track', tone: 'error' })
                              } finally {
                                setBusy(false)
                              }
                            }}>Save</button>
                            <button type="button" className="btn btn-ghost btn-compact" onClick={() => setEditingSongId(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn btn-ghost btn-compact" onClick={() => {
                              setEditingSongId(song._id)
                              setEditSongTitle(song.title || '')
                              setEditSongVisibility(song.visibility || 'public')
                            }}>✎</button>
                            {confirmDeleteSongId === song._id ? (
                              <div className="release-row-actions">
                                <button type="button" className="btn btn-ghost btn-compact" onClick={() => setConfirmDeleteSongId(null)}>Cancel</button>
                                <button type="button" className="btn btn-danger btn-compact" onClick={() => void handleConfirmDeleteSong(song._id)} disabled={busy}>Delete</button>
                              </div>
                            ) : (
                              <button type="button" className="btn btn-ghost btn-compact" onClick={() => setConfirmDeleteSongId(song._id)}>🗑</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )) : <p className="subtitle">No tracks yet. Upload your first release above.</p>}
                </div>

                {/* Albums heading */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Albums</h3>
                  <button type="button" className="btn btn-ghost btn-compact">Manage</button>
                </div>

                {/* Albums list */}
                <div className="card" style={{ padding: 8 }}>
                  {albums.length ? albums.slice(0, 6).map((album) => (
                    <div key={album._id} className="release-row">
                      <Artwork item={album} size="compact" className="release-thumb" />
                      <div className="release-row-copy">
                        {editingAlbumId === album._id ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input className="input" value={editAlbumTitle} onChange={(e) => setEditAlbumTitle(e.target.value)} style={{ flex: 1 }} />
                            <select className="input" value={editAlbumVisibility} onChange={(e) => setEditAlbumVisibility(e.target.value)} style={{ width: 140 }}>
                              <option value="public">Public</option>
                              <option value="private">Private</option>
                            </select>
                          </div>
                        ) : (
                          <>
                            <strong title={album.title} style={{ display: 'block', minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', wordBreak: 'break-word' }}>{album.title}</strong>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                              <span className="subtitle" style={{ fontSize: '0.82rem' }}>{album.musics?.length || 0} tracks</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="release-row-actions">
                        {renderStatusBadge(album.status)}
                        {editingAlbumId === album._id ? (
                          <>
                            <button type="button" className="btn btn-primary btn-compact" onClick={async () => {
                              setBusy(true)
                              try {
                                await editAlbum(album._id, { title: editAlbumTitle, visibility: editAlbumVisibility })
                                setEditingAlbumId(null)
                                await loadContent()
                              } catch (err) {
                                setToast({ message: err?.response?.data?.message || 'Unable to update album', tone: 'error' })
                              } finally {
                                setBusy(false)
                              }
                            }}>Save</button>
                            <button type="button" className="btn btn-ghost btn-compact" onClick={() => setEditingAlbumId(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn btn-ghost btn-compact" onClick={() => {
                              setEditingAlbumId(album._id)
                              setEditAlbumTitle(album.title || '')
                              setEditAlbumVisibility(album.visibility || 'public')
                            }}>✎</button>
                            {confirmDeleteAlbumId === album._id ? (
                              <div className="release-row-actions">
                                <button type="button" className="btn btn-ghost btn-compact" onClick={() => setConfirmDeleteAlbumId(null)}>Cancel</button>
                                <button type="button" className="btn btn-danger btn-compact" onClick={() => void handleConfirmDeleteAlbum(album._id)} disabled={busy}>Delete</button>
                              </div>
                            ) : (
                              <button type="button" className="btn btn-ghost btn-compact" onClick={() => setConfirmDeleteAlbumId(album._id)}>🗑</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )) : <p className="subtitle">No albums yet. Create an album after uploading tracks.</p>}
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}