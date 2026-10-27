/**
 * The retro menu rendered inside the LCD area (DOM overlay styled to look
 * like phone firmware UI: title bar, list, soft-key labels at the bottom).
 */
export default function Menu({ items, selected, onSelect, softLeft, softRight }) {
  return (
    <div className="menu-screen">
      <div className="menu-titlebar">{softLeft?.title || 'MENU'}</div>
      <ul className="menu-list" role="menu">
        {items.map((item, i) => (
          <li key={item.id} role="menuitem" aria-selected={i === selected}>
            <button
              type="button"
              className={`menu-item ${i === selected ? 'menu-item-active' : ''}`}
              onClick={() => onSelect(i)}
            >
              <span className="menu-bullet">{i === selected ? '\u25B6' : '\u00B7'}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="menu-softkeys">
        <span>{softLeft?.label || 'SELECT'}</span>
        <span>{softRight?.label || 'BACK'}</span>
      </div>
    </div>
  )
}
