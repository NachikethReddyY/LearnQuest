/** Keyboard-only focus ring shared by every player control (nothing on mouse focus). */
export const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-blue";

export const MENU_PANEL = "z-[4000] min-w-56 rounded-xl border-[3px] border-ink bg-white p-1 shadow-[4px_4px_0_var(--color-ink)]";
export const MENU_ITEM =
  "flex min-h-7 cursor-default items-center gap-2 rounded-lg px-2 text-sm font-bold outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-sun focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-blue";
