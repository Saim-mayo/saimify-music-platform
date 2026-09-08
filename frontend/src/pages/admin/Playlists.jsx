import { useMemo, useState } from 'react'
import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'
import { ConfirmAction } from '@/components/common'
import { useAdminCatalog } from '@/features/admin/useAdminData'

export default function Playlists() {
  const [search, setSearch] = useState('')
  const [deletePlaylistId, setDeletePlaylistId] = useState('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  const { items: playlists, page, setPage, loading, error, pagination, reload, remove } = useAdminCatalog('playlists', search)

  const selectedPlaylist = useMemo(() => playlists.find((playlist) => playlist._id === selectedPlaylistId) || null, [selectedPlaylistId, playlists])

  const handleDeletePlaylist = async () => {
    if (!deletePlaylistId) return
    try {
      await remove(deletePlaylistId)
      setDeletePlaylistId('')
    } catch {
      // The hook keeps list state; the existing page error surface remains unchanged.
    }
  }

  return (
    <AdminLayout>
      <div className="admin-section">
        <AdminPageHeader eyebrow="Community content" title="Playlists" description="Keep shared listening spaces useful, current, and easy to discover." meta={`${pagination.totalItems || 0} playlists`} />

        <div className="admin-filters">
          <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or owner" />
          <button type="button" className="btn btn-ghost" onClick={() => { setPage(1); void reload() }}>Search</button>
        </div>

        {loading ? <p>Loading…</p> : null}
        {error ? <p className="error-banner">{error}</p> : null}

        {selectedPlaylist ? (
          <section className="card" style={{ padding: 12, marginBottom: 12 }}>
            <strong>{selectedPlaylist.title}</strong>
            <div className="subtitle">Owner: {selectedPlaylist.user?.username || 'Unknown'} • Visibility: {selectedPlaylist.isPublic ? 'Public' : 'Private'} • Songs: {selectedPlaylist.songs?.length || 0}</div>
          </section>
        ) : null}

        <div className="table-scroll">
          <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Owner</th>
              <th>Song count</th>
              <th>Visibility</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {playlists.map((playlist) => (
              <tr key={playlist._id}>
                <td>{playlist.title || 'Untitled'}</td>
                <td>{playlist.user?.username || 'Unknown owner'}</td>
                <td>{playlist.songs?.length || 0}</td>
                <td>{playlist.isPublic ? 'Public' : 'Private'}</td>
                <td>{playlist.createdAt ? new Date(playlist.createdAt).toLocaleDateString() : '—'}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-compact" onClick={() => setSelectedPlaylistId(playlist._id)}>View</button>
                    <button type="button" className="btn btn-danger btn-compact" onClick={() => setDeletePlaylistId(playlist._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>

        {playlists.length === 0 && !loading ? <p>No playlists found.</p> : null}

        <div className="admin-pagination">
          <button type="button" className="btn btn-ghost btn-compact" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <span className="subtitle">Page {pagination.currentPage || page} / {pagination.totalPages || 1}</span>
          <button type="button" className="btn btn-ghost btn-compact" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>

        <ConfirmAction
          open={Boolean(deletePlaylistId)}
          title="this playlist"
          onConfirm={handleDeletePlaylist}
          onCancel={() => setDeletePlaylistId('')}
          className="card"
        />
      </div>
    </AdminLayout>
  )
}
