/**
 * The physical keypad below the screen: 4-way direction pad, C/Back key,
 * green "Select" key, red "Menu/Home" key and a decorative number row.
 */
export default function Keypad({ onDir, onSelect, onBack, onMenu }) {
  const press = (fn) => (e) => {
    e.preventDefault()
    fn?.()
  }

  return (
    <div className="keypad">
      {/* left soft / back cluster */}
      <div className="key-cluster key-cluster-left">
        <button
          type="button"
          className="phone-key key-c"
          onClick={press(onBack)}
          aria-label="Back"
        >
          C
        </button>
      </div>

      {/* center D-pad */}
      <div className="dpad" role="group" aria-label="Direction pad">
        <button type="button" className="dpad-btn dpad-up" aria-label="Up"
          onClick={press(() => onDir('up'))}>&#9650;</button>
        <button type="button" className="dpad-btn dpad-left" aria-label="Left"
          onClick={press(() => onDir('left'))}>&#9664;</button>
        <button type="button" className="dpad-btn dpad-center" aria-label="Select"
          onClick={press(onSelect)}>&#9679;</button>
        <button type="button" className="dpad-btn dpad-right" aria-label="Right"
          onClick={press(() => onDir('right'))}>&#9654;</button>
        <button type="button" className="dpad-btn dpad-down" aria-label="Down"
          onClick={press(() => onDir('down'))}>&#9660;</button>
      </div>

      {/* right select / menu cluster */}
      <div className="key-cluster key-cluster-right">
        <button
          type="button"
          className="phone-key key-menu"
          onClick={press(onMenu)}
          aria-label="Menu"
        >
          &#9776;
        </button>
      </div>

      {/* call keys */}
      <div className="call-row">
        <button type="button" className="phone-key key-green" onClick={press(onSelect)} aria-label="Select / start">
          &#9989;
        </button>
        <button type="button" className="phone-key key-red" onClick={press(onMenu)} aria-label="Menu / home">
          &#10060;
        </button>
      </div>

      {/* decorative number row */}
      <div className="num-row" aria-hidden="true">
        {['1', '2 ABC', '3 DEF', '4 GHI', '5 JKL', '6 MNO', '7 PQRS', '8 TUV', '9 WXYZ', '*', '0 +', '#'].map(
          (n) => (
            <span key={n} className="num-key">
              {n}
            </span>
          )
        )}
      </div>
    </div>
  )
}
