/**
 * Generador autónomo y ligero de códigos QR (ISO/IEC 18004) en SVG y Data URL
 * 100% TypeScript sin dependencias externas ni binarios nativos.
 * Diseñado para enlaces de seguimiento, compatibilidad móvil universal y SSR.
 */

// Tablas de corrección de errores (Nivel M - Estándar recomendado ~15% recuperación)
interface QRVersionConfig {
  version: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocksGroup1: number;
  dataCodewordsPerBlockGroup1: number;
  numBlocksGroup2: number;
  dataCodewordsPerBlockGroup2: number;
  alignmentPatternPositions: number[];
}

const QR_VERSIONS: QRVersionConfig[] = [
  // Version 1 (21x21)
  {
    version: 1,
    totalCodewords: 26,
    ecCodewordsPerBlock: 10,
    numBlocksGroup1: 1,
    dataCodewordsPerBlockGroup1: 16,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignmentPatternPositions: [],
  },
  // Version 2 (25x25)
  {
    version: 2,
    totalCodewords: 44,
    ecCodewordsPerBlock: 16,
    numBlocksGroup1: 1,
    dataCodewordsPerBlockGroup1: 28,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignmentPatternPositions: [6, 18],
  },
  // Version 3 (29x29)
  {
    version: 3,
    totalCodewords: 70,
    ecCodewordsPerBlock: 26,
    numBlocksGroup1: 1,
    dataCodewordsPerBlockGroup1: 44,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignmentPatternPositions: [6, 22],
  },
  // Version 4 (33x33)
  {
    version: 4,
    totalCodewords: 100,
    ecCodewordsPerBlock: 18,
    numBlocksGroup1: 2,
    dataCodewordsPerBlockGroup1: 32,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignmentPatternPositions: [6, 26],
  },
  // Version 5 (37x37)
  {
    version: 5,
    totalCodewords: 134,
    ecCodewordsPerBlock: 24,
    numBlocksGroup1: 2,
    dataCodewordsPerBlockGroup1: 43,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignmentPatternPositions: [6, 30],
  },
  // Version 6 (41x41)
  {
    version: 6,
    totalCodewords: 172,
    ecCodewordsPerBlock: 16,
    numBlocksGroup1: 4,
    dataCodewordsPerBlockGroup1: 27,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignmentPatternPositions: [6, 34],
  },
];

// Galois Field GF(256) con polinomio primitivo 0x11D (x^8 + x^4 + x^3 + x^2 + 1)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function rsComputePoly(ecCount: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < ecCount; i++) {
    const factor = new Uint8Array([1, GF_EXP[i]]);
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      for (let k = 0; k < factor.length; k++) {
        next[j + k] ^= gfMul(poly[j], factor[k]);
      }
    }
    poly = next;
  }
  return poly;
}

function rsComputeCodewords(data: Uint8Array, ecCount: number): Uint8Array {
  const genPoly = rsComputePoly(ecCount);
  const remainder = new Uint8Array(ecCount);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(genPoly[j + 1], factor);
    }
    remainder[ecCount - 1] = gfMul(genPoly[ecCount], factor);
  }

  return remainder;
}

// Genera secuencia de bits para modo Byte (8-bit)
function encodeData(text: string, capacity: number): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  const bitList: number[] = [];

  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bitList.push((val >>> i) & 1);
    }
  }

  // Indicador de modo: Byte mode (0100)
  pushBits(0b0100, 4);

  // Contador de caracteres (8 bits para versiones 1-9 en modo byte)
  pushBits(textBytes.length, 8);

  // Datos
  for (const b of textBytes) {
    pushBits(b, 8);
  }

  // Terminador (hasta 4 ceros)
  const totalDataBits = capacity * 8;
  const remainingBits = totalDataBits - bitList.length;
  const terminatorLen = Math.min(4, Math.max(0, remainingBits));
  pushBits(0, terminatorLen);

  // Rellenar a múltiplo de 8
  while (bitList.length % 8 !== 0) {
    bitList.push(0);
  }

  // Rellenar bytes restantes con bytes alternados 0xEC (236) y 0x11 (17)
  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  while (bitList.length < totalDataBits) {
    pushBits(padPatterns[padIdx % 2], 8);
    padIdx++;
  }

  const result = new Uint8Array(capacity);
  for (let i = 0; i < capacity; i++) {
    let b = 0;
    for (let bit = 0; bit < 8; bit++) {
      b = (b << 1) | bitList[i * 8 + bit];
    }
    result[i] = b;
  }
  return result;
}

export function generateQrMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder();
  const byteLen = encoder.encode(text).length;

  // Seleccionar la versión más pequeña capaz de albergar el texto
  let config: QRVersionConfig | null = null;
  for (const v of QR_VERSIONS) {
    const totalDataCodewords =
      v.numBlocksGroup1 * v.dataCodewordsPerBlockGroup1 +
      v.numBlocksGroup2 * v.dataCodewordsPerBlockGroup2;
    // Overhead en modo Byte: 4 bits modo + 8 bits longitud = 12 bits -> 2 bytes
    if (byteLen + 2 <= totalDataCodewords) {
      config = v;
      break;
    }
  }

  if (!config) {
    config = QR_VERSIONS[QR_VERSIONS.length - 1];
  }

  const totalDataCodewords =
    config.numBlocksGroup1 * config.dataCodewordsPerBlockGroup1 +
    config.numBlocksGroup2 * config.dataCodewordsPerBlockGroup2;

  const dataCodewords = encodeData(text, totalDataCodewords);

  // Bloques y corrección de errores
  const ecPerBlock = config.ecCodewordsPerBlock;
  const blocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  let dataOffset = 0;
  for (let i = 0; i < config.numBlocksGroup1; i++) {
    const len = config.dataCodewordsPerBlockGroup1;
    const block = dataCodewords.slice(dataOffset, dataOffset + len);
    dataOffset += len;
    blocks.push(block);
    ecBlocks.push(rsComputeCodewords(block, ecPerBlock));
  }
  for (let i = 0; i < config.numBlocksGroup2; i++) {
    const len = config.dataCodewordsPerBlockGroup2;
    const block = dataCodewords.slice(dataOffset, dataOffset + len);
    dataOffset += len;
    blocks.push(block);
    ecBlocks.push(rsComputeCodewords(block, ecPerBlock));
  }

  // Intercalar data codewords
  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(
    config.dataCodewordsPerBlockGroup1,
    config.dataCodewordsPerBlockGroup2 || 0
  );
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of blocks) {
      if (i < b.length) {
        finalCodewords.push(b[i]);
      }
    }
  }
  // Intercalar EC codewords
  for (let i = 0; i < ecPerBlock; i++) {
    for (const ec of ecBlocks) {
      finalCodewords.push(ec[i]);
    }
  }

  // Matriz de módulos
  const size = config.version * 4 + 17;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  function markFunction(r: number, c: number, v: boolean) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = v;
      isFunction[r][c] = true;
    }
  }

  // 1. Finder patterns (7x7) en las esquinas
  function drawFinder(top: number, left: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        markFunction(top + r, left + c, isBorder || isCenter);
      }
    }
    // Separadores de 1 módulo alrededor
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          markFunction(top + r, left + c, false);
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Alignment patterns para versión >= 2
  const alignCoords = config.alignmentPatternPositions;
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const r = alignCoords[i];
      const c = alignCoords[j];
      // Saltear si coincide con finders
      if (
        (r <= 8 && c <= 8) ||
        (r <= 8 && c >= size - 9) ||
        (r >= size - 9 && c <= 8)
      ) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isOuter = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          const isInner = dr === 0 && dc === 0;
          markFunction(r + dr, c + dc, isOuter || isInner);
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    markFunction(6, i, i % 2 === 0);
    markFunction(i, 6, i % 2 === 0);
  }

  // 4. Dark module fijo
  markFunction(config.version * 4 + 9, 8, true);

  // 5. Reservar información de formato (15 bits)
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
    isFunction[size - 1 - i][8] = true;
  }

  // 6. Colocar datos en zig-zag de 2 columnas de derecha a izquierda
  const dataBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let bit = 7; bit >= 0; bit--) {
      dataBits.push((cw >>> bit) & 1);
    }
  }

  let bitIdx = 0;
  let goingUp = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Saltear columna de timing vertical

    const rows = goingUp
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!isFunction[r][c]) {
          const bitVal = bitIdx < dataBits.length ? dataBits[bitIdx] === 1 : false;
          matrix[r][c] = bitVal;
          bitIdx++;
        }
      }
    }
    goingUp = !goingUp;
  }

  // 7. Aplicar máscara estándar: Patrón 0 ((r + c) % 2 === 0)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunction[r][c] && (r + c) % 2 === 0) {
        matrix[r][c] = !matrix[r][c];
      }
    }
  }

  // 8. Escribir formato (Nivel M = 00, Máscara 0 = 000 -> 00000 -> Con BCH y XOR: 101010000010010)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Formato superior izquierdo
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  // Formato inferior y superior derecho
  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 7; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

  return matrix;
}

/**
 * Genera una representación SVG vectorial nítida del código QR con margen de resguardo (quiet zone).
 */
export function generateQrSvg(
  text: string,
  options: {
    size?: number;
    fgColor?: string;
    bgColor?: string;
    quietZone?: number;
  } = {}
): string {
  const {
    size = 256,
    fgColor = "#0f172a",
    bgColor = "#ffffff",
    quietZone = 4,
  } = options;

  const matrix = generateQrMatrix(text);
  const matrixSize = matrix.length;
  const viewBoxSize = matrixSize + quietZone * 2;

  let pathData = "";
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = c + quietZone;
        const y = r + quietZone;
        pathData += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <path d="${pathData.trim()}" fill="${fgColor}"/>
</svg>`;
}

/**
 * Genera una Data URL en SVG lista para usar en elementos <img src="..." />
 */
export function generateQrDataUrl(
  text: string,
  options?: Parameters<typeof generateQrSvg>[1]
): string {
  const svg = generateQrSvg(text, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
