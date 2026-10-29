import { useState } from "react";
import { isSoundOn, setSoundOn } from "../lib/sound";

export default function SoundToggle() {
  const [on, setOn] = useState(isSoundOn);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        setSoundOn(!on);
        setOn(!on);
      }}
      className="pill fixed bottom-4 left-4 z-50 bg-white px-3 py-1 text-sm"
    >
      Sound {on ? "on" : "off"}
    </button>
  );
}
