import { useMemo, useState } from 'react'
import AdminLayout from './components/AdminLayout'
import AdminPageHeader from './components/AdminPageHeader'
import { ConfirmAction } from '@/components/common'
import { useAdminCatalog } from '@/features/admin/useAdminData'

export default function Albums() {
  const [search, setSearch] = useState('')
  const [deleteAlbumId, setDeleteAlbumId] = useState('')
  const [selectedAlbumId, setSelectedAlbumId] = useState('')

  const { items: albums, page, setPage, loading, error, pagination, reload, remove } = useAdminCatalog('albums', search)

  const selectedAlbum = useMemo(() => albums.find((album) => album._id === selectedAlbumId) || null, [selectedAlbumId, albums])

  const handleDeleteAlbum = async () => {
    if (!deleteAlbumId) return
    try {
      await remove(deleteAlbumId)
      setDeleteAlbumId('')
    } catch {
      // Keep the list state managed by the feature hook.
    }
  }

  return (
    <AdminLayout>
      <div className="admin-section">
        <AdminPageHeader eyebrow="Catalog moderation" title="Albums" description="Shape the release library and keep album metadata consistent." meta={`${pagination.totalItems || 0} albums`} />

        <div className="admin-filters">
          <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or artist" />
          <button type="button" className="btn btn-ghost" onClick={() => { setPage(1); void reload() }}>Search</button>
        </div>

        {loading ? <p>Loading…</p> : null}
        {error ? <p className="error-banner">{error}</p> : null}

        {selectedAlbum ? (
          <section className="card" style={{ padding: 12, marginBottom: 12 }}>
            <strong>{selectedAlbum.title}</strong>
            <div className="subtitle">Artist: {selectedAlbum.artist?.username || 'Unknown'} • Status: {selectedAlbum.status || 'active'} • Tracks: {selectedAlbum.musics?.length || 0}</div>
          </section>
        ) : null}

        <div className="table-scroll">
          <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Artist</th>
              <th>Upload date</th>
              <th>Tracks</th>
              <th>Genre</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {albums.map((album) => (
              <tr key={album._id}>
                <td>{album.title || 'Untitled'}</td>
                <td>{album.artist?.username || album.artist?.name || 'Unknown artist'}</td>
                <td>{album.createdAt ? new Date(album.createdAt).toLocaleDateString() : '—'}</td>
                <td>{album.musics?.length || 0}</td>
                <td>{album.genre || '—'}</td>
                <td>{album.status || 'active'}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-compact" onClick={() => setSelectedAlbumId(album._id)}>View</button>
                    <button type="button" className="btn btn-danger btn-compact" onClick={() => setDeleteAlbumId(album._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>

        {albums.length === 0 && !loading ? <p>No albums found.</p> : null}

        <div className="admin-pagination">
          <button type="button" className="btn btn-ghost btn-compact" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <span className="subtitle">Page {pagination.currentPage || page} / {pagination.totalPages || 1}</span>
          <button type="button" className="btn btn-ghost btn-compact" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>

        <ConfirmAction
          open={Boolean(deleteAlbumId)}
          title="this album"
          onConfirm={handleDeleteAlbum}
          onCancel={() => setDeleteAlbumId('')}
          className="card"
        />
      </div>
    </AdminLayout>
  )
}
