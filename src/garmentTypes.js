/** Clothesline order (L→R): Lehenga, Kurta, Sock, Dupatta, Churidar, Saree */
export const GARMENT_BY_ID = {
  0: "LEHENGA",
  1: "KURTA",
  2: "DUPATTA",
  3: "CHURIDAR",
  4: "SAREE",
  99: "SOCK",
};

export const GARMENT_LABELS = {
  LEHENGA: "Lehenga",
  KURTA: "Kurta",
  SOCK: "Sock",
  DUPATTA: "Dupatta",
  CHURIDAR: "Churidar",
  SAREE: "Saree",
};

export function getGarmentType(piece, creatorType) {
  if (piece?.isSock) return "SOCK";
  if (creatorType && GARMENT_LABELS[creatorType] && piece?.id > 4) return creatorType;
  if (piece && GARMENT_BY_ID[piece.id]) return GARMENT_BY_ID[piece.id];
  if (creatorType && GARMENT_LABELS[creatorType]) return creatorType;
  return "KURTA";
}
