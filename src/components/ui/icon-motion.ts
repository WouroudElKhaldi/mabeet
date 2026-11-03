/** Add to a round icon button: its hover and keyboard focus play the motion of the icon inside. */
export const iconMotionParent = "group/icon";

/**
 * Small motions for the icon inside an `iconMotionParent` button, chosen to suit it: `spin` turns a quarter (a sun's
 * rays, a gear), `rock` swings and settles (a moon, a bell), `turn` spins on its axis (a globe). The motion lives in
 * globals.css; reduced motion turns it off with everything else.
 *
 *   <button className={iconMotionParent}><Globe className={iconMotion.turn} /></button>
 */
export const iconMotion = {
  spin: "icon-spin",
  rock: "icon-rock",
  turn: "icon-turn",
} as const;
