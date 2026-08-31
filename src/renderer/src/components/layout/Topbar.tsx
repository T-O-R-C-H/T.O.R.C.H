/**
 * The custom title bar.
 *
 * The window is frameless and the native menu is removed, so this is the only
 * thing giving the window a drag handle and its controls. The bar itself is
 * draggable; the buttons opt out, or they could not be clicked.
 *
 * It carries no title: the sidebar already shows the brand and marks the
 * active page, and repeating either here would just be noise.
 */
function IconMinus(): JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <line x1="1" y1="6" x2="11" y2="6" />
    </svg>
  )
}

function IconSquare(): JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="1.5" y="1.5" width="9" height="9" />
    </svg>
  )
}

function IconX(): JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" />
      <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" />
    </svg>
  )
}

export function Topbar(): JSX.Element {
  return (
    <div className="topbar drag-region">
      <div className="no-drag topbar-controls">
        <button
          type="button"
          className="win-btn"
          onClick={() => window.torchAPI?.minimizeWindow()}
          aria-label="Minimize"
        >
          <IconMinus />
        </button>
        <button
          type="button"
          className="win-btn"
          onClick={() => window.torchAPI?.maximizeWindow()}
          aria-label="Maximize"
        >
          <IconSquare />
        </button>
        <button
          type="button"
          className="win-btn win-btn--danger"
          onClick={() => window.torchAPI?.closeWindow()}
          aria-label="Close"
        >
          <IconX />
        </button>
      </div>
    </div>
  )
}
