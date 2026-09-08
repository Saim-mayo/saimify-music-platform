# Frontend Architecture

## Boundaries

- `src/pages/` contains route-level UI composition grouped by access role: `auth/`, `user/`, `artist/`, and `admin/`. URLs remain defined in `src/App.jsx` and `src/pages/admin/index.jsx`.
- `src/features/<domain>/` owns page data orchestration, feature-specific hooks, and feature actions. Current domains include `auth/`, `admin/`, `artist/`, `home/`, `library/`, `profile/`, and `user/`. User data hooks are split by concern (`useAlbumData`, `usePlaylistData`, `usePlaylistsList`, and `useSearchData`).
- `src/components/` contains reusable presentation and interaction components.
- `src/api/` contains transport-facing domain modules. `client.js` is the only Axios transport owner.
- `src/domain/` contains pure domain normalization utilities that do not render UI or perform requests.
- `src/store/` contains cross-route state only: authentication, player, notifications, subscriptions, theme, and navigation coordination.
- `src/config/` contains runtime configuration and environment-derived values.
- `src/hooks/` contains reusable browser and React behavior such as debouncing and local storage.
- `@/` is the Vite alias for `src/`; shared modules should use it instead of parent-relative import chains.
- Shared exports are available from the barrels at `src/api`, `src/components/common`, `src/components/ui`, `src/components/layout`, and `src/store`. Pages remain direct route targets and are intentionally not barrel-exported.

## Data flow

```text
Route page -> feature hook/action -> domain API module -> api/client.js -> backend
       \-> reusable components -> feature hook/action or Zustand store -> browser APIs
```

Feature hooks own loading, error, response normalization, and refresh behavior. Pages own user interaction and rendering. Stores own state that must survive navigation.

## Request ownership rules

- Route pages and reusable components must not import `src/api/*` or `apiClient` directly.
- Read requests belong in `src/features/<domain>/use*Data.js` hooks.
- Feature mutations belong in `src/features/<domain>/use*Actions.js` hooks or in the same feature data hook when they update its local data.
- Cross-route request state belongs in an existing Zustand store, such as authentication, notifications, subscriptions, or playback.
- API modules only translate domain operations into HTTP requests through `src/api/client.js`; they do not own React state, UI notifications, or rendering concerns.
- API responses are normalized at the feature boundary with `src/api/response.js`, and request errors use `src/api/errors.js`.
- Import shared components, stores, and API modules from their barrels where available; keep same-folder implementation imports direct to avoid cycles.
- Behavior hooks such as `useSongActions` belong under their feature folder, not under a presentation-component barrel. Compatibility re-exports may remain temporarily for external consumers during migrations.

## Configuration

Copy `.env.example` to the environment used by the deployment. Do not add API origins, OAuth origins, polling intervals, debounce values, or token timing values directly to page components or stores. Runtime values are read from `src/config/runtime.js`.

## Adding a new feature

1. Add the route-level component to the appropriate role folder under `src/pages/` or the existing admin route tree. Keep role-specific layouts and components inside that role folder.
2. Add API calls to the relevant `src/api/<domain>.api.js` module.
3. Add response normalization to `src/api/response.js` or a pure `src/domain/` adapter.
4. Add loading/error/refetch orchestration to `src/features/<domain>/use<Domain>Data.js` and mutations to a feature action hook.
5. Import the feature hook from the page or component; never import the API module there.
6. Keep cross-page state in a dedicated Zustand store only when local page state is insufficient.
7. Validate with `npm run lint`, `npm test`, and `npm run build`.
