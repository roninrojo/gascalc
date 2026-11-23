import { useRef, useState, type ComponentPropsWithRef, type PointerEvent } from 'react';

type Highlight = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function rowAtPointer(list: HTMLElement, x: number, y: number) {
  const row = document.elementFromPoint(x, y)?.closest('[data-fluid-row]');
  if (!(row instanceof HTMLElement) || row.closest('ul') !== list) return;
  if (row.matches(':disabled, [aria-pressed="true"], [aria-selected="true"]')) return;
  return row;
}

export function FluidList({ children, className = '', ...props }: ComponentPropsWithRef<'ul'>) {
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const activeRow = useRef<HTMLElement | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [visible, setVisible] = useState(false);
  const [session, setSession] = useState(0);

  function reset() {
    if (!activeRow.current) return;
    activeRow.current = null;
    setVisible(false);
  }

  function update(list: HTMLUListElement, x: number, y: number) {
    const row = rowAtPointer(list, x, y);
    if (!row) {
      reset();
      return;
    }
    if (activeRow.current === row) return;
    const item = row.getBoundingClientRect();
    const container = list.getBoundingClientRect();
    if (!activeRow.current) setSession(value => value + 1);
    activeRow.current = row;
    setHighlight({
      x: item.left - container.left + list.scrollLeft - list.clientLeft,
      y: item.top - container.top + list.scrollTop - list.clientTop,
      width: item.width,
      height: item.height,
    });
    setVisible(true);
  }

  function move(event: PointerEvent<HTMLUListElement>) {
    if (event.pointerType !== 'mouse') return;
    const { clientX: x, clientY: y } = event;
    pointer.current = { x, y };
    update(event.currentTarget, x, y);
  }

  return <ul
    {...props}
    className={`fluid-list ${className}`}
    onPointerMove={move}
    onPointerLeave={() => { pointer.current = null; reset(); }}
    onScroll={event => {
      if (pointer.current) update(event.currentTarget, pointer.current.x, pointer.current.y);
    }}
    onClick={reset}
  >
    <li key={session} aria-hidden="true" className="fluid-highlight" data-visible={visible} style={highlight ? {
      width: highlight.width,
      height: highlight.height,
      transform: `translate3d(${highlight.x}px, ${highlight.y}px, 0)`,
    } : undefined}/>
    {children}
  </ul>;
}
