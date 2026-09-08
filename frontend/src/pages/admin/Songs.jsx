import { useMemo, useState } from 'react'
import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'
import { ConfirmAction } from '@/components/common'
import { useAdminCatalog } from '@/features/admin/useAdminData'

export default function Songs() {
  const [search, setSearch] = useState('')
  const [deleteSongId, setDeleteSongId] = useState('')
  const [selectedSongId, setSelectedSongId] = useState('')
  const { items: songs, page, setPage, loading, error, pagination, reload, remove } = useAdminCatalog('songs', search)

  const selectedSong = useMemo(() => songs.find((song) => song._id === selectedSongId) || null, [selectedSongId, songs])

  const handleDeleteSong = async () => {
    if (!deleteSongId) return
    try {
      await remove(deleteSongId)
      setDeleteSongId('')
    } catch {
      // The hook keeps list state; the existing page error surface remains unchanged.
    }
  }

  return (
    <AdminLayout>
      <div className="admin-section">
        <AdminPageHeader eyebrow="Catalog moderation" title="Songs" description="Inspect uploads, listen for quality, and keep the catalog moving." meta={`${pagination.totalItems || 0} songs`} />

        <div className="admin-filters">
          <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or artist" />
          <button type="button" className="btn btn-ghost" onClick={() => { setPage(1); void reload() }}>Search</button>
        </div>

        {loading ? <p>Loading…</p> : null}
        {error ? <p className="error-banner">{error}</p> : null}

        {selectedSong ? (
          <section className="card" style={{ padding: 12, marginBottom: 12 }}>
            <strong>{selectedSong.title}</strong>
            <div className="subtitle">Artist: {selectedSong.artist?.username || 'Unknown'} • Status: {selectedSong.status || 'active'} • Play count: {selectedSong.playCount || 0}</div>
          </section>
        ) : null}

        <div className="table-scroll">
          <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Artist</th>
              <th>Upload date</th>
              <th>Play count</th>
              <th>Genre</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song) => (
              <tr key={song._id}>
                <td>{song.title || 'Untitled'}</td>
                <td>{song.artist?.username || song.artist?.name || 'Unknown artist'}</td>
                <td>{song.createdAt ? new Date(song.createdAt).toLocaleDateString() : '—'}</td>
                <td>{song.playCount || 0}</td>
                <td>{song.genre || '—'}</td>
                <td>{song.status || 'active'}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-compact" onClick={() => setSelectedSongId(song._id)}>View</button>
                    <button type="button" className="btn btn-danger btn-compact" onClick={() => setDeleteSongId(song._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>

        {songs.length === 0 && !loading ? <p>No songs found.</p> : null}

        <div className="admin-pagination">
          <button type="button" className="btn btn-ghost btn-compact" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <span className="subtitle">Page {pagination.currentPage || page} / {pagination.totalPages || 1}</span>
          <button type="button" className="btn btn-ghost btn-compact" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>

        <ConfirmAction
          open={Boolean(deleteSongId)}
          title="this song"
          onConfirm={handleDeleteSong}
          onCancel={() => setDeleteSongId('')}
          className="card"
        />
      </div>
    </AdminLayout>
  )
}
