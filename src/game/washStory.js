// washStory — the narrative content for WASH DAY: the orange bird's spoken beats
// per phase, the "line complete" celebration line, and the About Me reveal copy.
// This module is pure CONTENT (no JSX) so the storyline can be refined
// independently of the visuals/mechanics. WashDay/WashHud/BirdGuide import the
// shapes below; keep the KEYS stable.
//
// Phases: seek → carryDirty → washing → carryWet → drying → done.

/** One short, warm, in-character line the bird says at each phase. */
export const WASH_BEATS = {
  seek: "Follow me! Varna left one piece off the line — let's go find it.",
  carryDirty: "Her old denim jacket, mud and all. Follow me to the washing machine.",
  washing: "In you go, you stubborn thing. Hold tight while I work the suds.",
  carryWet: "Clean! Heavy as a wet cat, though. Walk it to that empty peg for me.",
  drying: "Pin it up, let the breeze have it. Fan, fan — there she dries.",
  done: "Six on the line, the last one too. She's ready now — come meet her.",
};

/** Shown during the golden-hour "you completed the line" celebration beat. */
export const LINE_COMPLETE = {
  kicker: "Out to dry",
  line: "Six pieces in the gold light — the line is whole.",
};

/** The About Me reveal.
 *  NOTE: placeholder bio — Varna to swap in her real specifics (work, links, voice). */
export const ABOUT = {
  eyebrow: "About Varna",
  headline: "The last piece, out to dry.",
  paragraphs: [
    "I'm Varna, a product and UX designer. I build small, considered worlds — interfaces you can settle into, where the craft is quiet but you feel it everywhere.",
    "I work close to the cloth: sketching by hand, prototyping early, wringing out the awkward bits until a flow feels honest. I'd rather ship one thing that fits than five that almost do.",
    "Off the clock I'm chasing good light, slow coffee, and the kind of small problems that are secretly the whole point. The jacket's dry now — glad you stayed to say hi.",
  ],
  cta: "Wander back to the world",
};
