import { useEffect } from 'react'
import { useNotificationStore } from '@/store'
import { Skeleton } from '@/components/common'

export default function NotificationsPage() {
  const {
    items,
    loading,
    error,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
    unreadCount,
    page,
    totalPages,
  } = useNotificationStore()

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  return (
    <div className="content-shell">
      <section className="notification-page-header">
        <div>
          <h1>Notifications</h1>
          <p className="subtitle">Announcements and account updates.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-compact"
          onClick={() => markAllAsRead().catch(() => {})}
          disabled={!unreadCount}
        >
          Mark all as read
        </button>
      </section>

      {loading ? (
        <section className="grid-list"><div className="card"><Skeleton lines={4} /></div><div className="card"><Skeleton lines={4} /></div></section>
      ) : null}

      {error ? (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost btn-compact" onClick={() => refresh().catch(() => {})}>Retry</button>
        </div>
      ) : null}

      {!loading ? (
        <div className="notification-list">
          {items.length ? items.map((item) => (
            <article
              className={`notification-row ${item.read ? '' : 'notification-row--unread'}`}
              key={item._id || `${item.title}-${item.createdAt}`}
            >
              <div className="notification-row-copy">
                <div className="notification-row-heading">
                  <h3>{item.title}</h3>
                  <small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</small>
                </div>
                <p>{item.message}</p>
              </div>
              <div className="notification-row-actions">
                {!item.read ? (
                  <button type="button" className="text-link-button" onClick={() => markAsRead(item._id).catch(() => {})}>
                    Mark read
                  </button>
                ) : null}
              </div>
            </article>
          )) : (
            <div className="home-empty-state"><p>You are all caught up. New account updates will appear here.</p></div>
          )}
        </div>
      ) : null}

      {!loading && items.length && page < totalPages ? (
        <div className="notification-load-more-row">
          <button type="button" className="btn btn-ghost" onClick={() => loadMore().catch(() => {})}>
            Load more
          </button>
        </div>
      ) : null}
    </div>
  )
}
