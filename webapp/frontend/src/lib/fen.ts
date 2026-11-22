export interface CastlingRights {
  K: boolean;
  Q: boolean;
  k: boolean;
  q: boolean;
}

/**
 * Flip a board FEN (ranks only, no metadata) for black's perspective.
 * 1. Split into ranks
 * 2. Expand digits to dots, reverse each rank string, reverse rank order
 * 3. Re-compress dots back to digits
 */
export function flipFen(boardFen: string): string {
  const expand = (rank: string) => rank.replace(/\d/g, d => '.'.repeat(Number(d)));
  const compress = (rank: string) => rank.replace(/\.+/g, m => String(m.length));

  return boardFen
    .split('/')
    .map(r => compress([...expand(r)].reverse().join('')))
    .reverse()
    .join('/');
}

/**
 * Castling rights the board itself still allows. A side can only castle if
 * its king and the relevant rook are on their starting squares, so a right is
 * kept only when both pieces are there. (A king or rook that moved and came
 * back can't be detected from a single position, so those stay on.)
 */
export function inferCastling(boardFen: string): CastlingRights {
  // ranks[0] is rank 8, ranks[7] is rank 1; each rank is 8 chars, a-file first
  const ranks = boardFen
    .split('/')
    .map(r => r.replace(/\d/g, d => '.'.repeat(Number(d))));
  const at = (file: string, rank: number) =>
    ranks[8 - rank]?.[file.charCodeAt(0) - 'a'.charCodeAt(0)];

  const whiteKing = at('e', 1) === 'K';
  const blackKing = at('e', 8) === 'k';
  return {
    K: whiteKing && at('h', 1) === 'R',
    Q: whiteKing && at('a', 1) === 'R',
    k: blackKing && at('h', 8) === 'r',
    q: blackKing && at('a', 8) === 'r',
  };
}
