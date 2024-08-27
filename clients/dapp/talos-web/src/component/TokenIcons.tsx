import React, { useEffect, useMemo, useState } from 'react';


interface IconPosition {
  x: number;
  y: number;
  size: number;
}

function getRandomSize(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createStyle(keyframes: string) {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerHTML = keyframes;
  styleSheet.className = 'icon-anim';
  document.head.appendChild(styleSheet);
}

function removeIconAnimStyles() {
  const elements = document.getElementsByClassName('icon-anim');
  while (elements.length > 0) {
    elements[0].remove();
  }
}

function distributeIcons(
  numIcons: number,
  containerWidth: number,
  containerHeight: number,
  minIconSize: number,
  maxIconSize: number,
): IconPosition[] {
  const cellSize = Math.sqrt((containerWidth * containerHeight) / numIcons);
  const cols = Math.floor(containerWidth / cellSize);
  const rows = Math.floor(containerHeight / cellSize);
  const grid: boolean[] = new Array(rows * cols).fill(false);
  const icons: IconPosition[] = [];

  function isAvailable(col: number, row: number): boolean {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
    return !grid[row * cols + col];
  }

  function occupyCell(col: number, row: number): void {
    grid[row * cols + col] = true;
  }

  function getRandomCell(): { col: number; row: number } | null {
    let attempts = 0;
    while (attempts < 500) {
      const col = Math.floor(Math.random() * cols);
      const row = Math.floor(Math.random() * rows);
      if (isAvailable(col, row)) {
        return { col, row };
      }
      attempts++;
    }
    return null;
  }

  for (let i = 0; i < numIcons; i++) {
    const cell = getRandomCell();
    if (!cell) break;

    const iconSize = getRandomSize(minIconSize, maxIconSize);

    const x = cell.col * cellSize + Math.random() * (cellSize - iconSize);
    const y = cell.row * cellSize + Math.random() * (cellSize - iconSize);

    icons.push({ x, y, size: iconSize });
    occupyCell(cell.col, cell.row);
  }

  return icons;
}

export default function TokenIcons() {
  const [size, setSize] = useState<[number, number]>();
  useEffect(() => {
    setSize([window.innerWidth, window.innerHeight]);
    let id: any;
    const resize = () => {
      if (id) {
        clearTimeout(id);
      }
      id = setTimeout(() => {
        setSize([window.innerWidth, window.innerHeight]);
      }, 100);
    };
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);
  const icons = useMemo(() => {
    const iconModules = import.meta.glob('@/assets/tokens/**/*.{png,svg}', {
      eager: true,
      query: '?url',
      import: 'default',
    });
    return Object.entries(iconModules).map(([key, value]) => {
      return {
        src: value,
        name: key.split('/').pop()!.split('.').shift(),
      };
    }).sort(() => Math.random() - 0.5);
  }, []);
  const iconElss = useMemo(() => {
    if (!size?.length) {
      return;
    }
    removeIconAnimStyles();
    const positions = distributeIcons(icons.length, size[0], size[1], 56, 78);
    return positions.map((position, index) => {
      const e = icons[index];
      const anim = `icon-ani${index}`;
      const symbol = Math.random() > 0.5 ? '' : '-';
      const prev = `transform: translateY(-${Math.ceil(Math.random() * 10 + 4)}px) rotate(${symbol}${Math.floor(Math.random() * 25)}deg);`;
      const next = `transform: translateY(${Math.ceil(Math.random() * 10 + 4)}px) rotate(${symbol}${Math.floor(Math.random() * 25)}deg);`;
      createStyle(`@keyframes ${anim} {0%{${prev}}50%{${next}}100%{${prev}}}`);
      const funcs = ['ease-in-out', 'ease-in', 'ease-out', 'linear'].sort(() => Math.random() - 0.5);
      return <div className={'absolute talos-ticker'} key={e.src} style={{
        width: position.size,
        height: position.size,
        top: Math.ceil(position.y),
        left: Math.ceil(position.x),
        animationDuration: `${Math.ceil(3.6 * 1000 + 8 * 1000 * Math.random())}ms`,
        animationName: anim,
        animationTimingFunction: funcs[0],
        backgroundImage: `url(${e.src})`,
      }}>
        <div>{e.name}</div>
      </div>;
    });
  }, [icons, size]);
  return <div className={'inset-0 absolute'}>
    {iconElss}
  </div>;
}