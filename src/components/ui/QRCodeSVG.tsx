'use client';

import React from 'react';

interface QRCodeSVGProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
  className?: string;
}

export default function QRCodeSVG({
  value,
  size = 128,
  bgColor = '#FFFFFF',
  fgColor = '#0F172A',
  className = '',
}: QRCodeSVGProps) {
  const modules = generateQRMatrix(value);
  const matrixSize = modules.length;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${matrixSize} ${matrixSize}`}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ shapeRendering: 'crispEdges' }}
    >
      <rect width={matrixSize} height={matrixSize} fill={bgColor} />
      {modules.map((row, rIdx) =>
        row.map((cell, cIdx) =>
          cell ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx}
              y={rIdx}
              width={1}
              height={1}
              fill={fgColor}
            />
          ) : null
        )
      )}
    </svg>
  );
}

function generateQRMatrix(text: string): boolean[][] {
  const size = 25;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  drawFinderPattern(matrix, 0, 0);
  drawFinderPattern(matrix, size - 7, 0);
  drawFinderPattern(matrix, 0, size - 7);

  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (matrix[6][i] === null) matrix[6][i] = val;
    if (matrix[i][6] === null) matrix[i][6] = val;
  }

  drawAlignmentPattern(matrix, 16, 16);

  const bytes = new TextEncoder().encode(text);
  let bitIndex = 0;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let row = 0; row < size; row++) {
      const actualRow = ((col + 1) / 2) % 2 === 0 ? size - 1 - row : row;
      for (let c = 0; c < 2; c++) {
        const r = actualRow;
        const currentCol = col - c;
        if (matrix[r][currentCol] === null) {
          const byteVal = bytes[bitIndex % bytes.length] || 0;
          const bitVal = ((byteVal >> (bitIndex % 8)) & 1) === 1;
          matrix[r][currentCol] = bitVal;
          bitIndex++;
        }
      }
    }
  }

  return matrix.map((row) => row.map((cell) => cell ?? false));
}

function drawFinderPattern(matrix: (boolean | null)[][], x: number, y: number) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (
        r === 0 ||
        r === 6 ||
        c === 0 ||
        c === 6 ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      ) {
        matrix[y + r][x + c] = true;
      } else {
        matrix[y + r][x + c] = false;
      }
    }
  }
}

function drawAlignmentPattern(matrix: (boolean | null)[][], x: number, y: number) {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2)) {
        matrix[y + r][x + c] = true;
      } else {
        matrix[y + r][x + c] = false;
      }
    }
  }
}