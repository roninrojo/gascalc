import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { searchKey } from '../../domain/stations';
import { Icon } from '../Icon';
import { FluidList } from './FluidList';

export type SelectOption<Value extends string> = {
  value: Value;
  label: string;
};

type SelectProps<Value extends string> = {
  id: string;
  value: Value;
  options: readonly SelectOption<Value>[];
  onValueChange: (value: Value) => void;
  disabled?: boolean;
  variant?: 'bordered' | 'borderless';
  describedBy?: string;
};

const SELECTION_ACK_MS = 300;
const TYPEAHEAD_MS = 700;
const EDGE = 8;
const GAP = 5;

function positionPopup(trigger: HTMLElement, popup: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const { clientWidth, clientHeight } = document.documentElement;
  const width = Math.min(Math.max(rect.width, 160), clientWidth - EDGE * 2);
  const left = Math.max(EDGE, Math.min(rect.left, clientWidth - width - EDGE));
  const below = clientHeight - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const opensAbove = below < Math.min(popup.scrollHeight || 300, 300) && above > below;

  popup.style.width = `${width}px`;
  popup.style.left = `${left}px`;
  popup.style.maxHeight = `${Math.max(0, Math.min(opensAbove ? above : below, 300))}px`;
  popup.style.top = opensAbove ? 'auto' : `${rect.bottom + GAP}px`;
  popup.style.bottom = opensAbove ? `${clientHeight - rect.top + GAP}px` : 'auto';
  popup.dataset.side = opensAbove ? 'above' : 'below';
}

export function Select<Value extends string>({
  id, value, options, onValueChange, disabled, variant = 'bordered', describedBy,
}: SelectProps<Value>) {
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLUListElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const typeahead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<Value>();
  const selectedIndex = options.findIndex(option => option.value === value);
  const activeIndex = options.findIndex(option => option.value === activeValue);
  const listId = `${id}-options`;
  const optionId = (index: number) => `${listId}-${index}`;

  function close() {
    window.clearTimeout(closeTimer.current);
    typeahead.current = { text: '', time: 0 };
    if (popup.current?.matches(':popover-open')) popup.current.hidePopover();
    setOpen(false);
  }

  function show(index = selectedIndex < 0 ? 0 : selectedIndex) {
    if (!trigger.current || !popup.current || !options.length) return;
    setActiveValue(options[index]?.value);
    trigger.current.focus({ preventScroll: true });
    positionPopup(trigger.current, popup.current);
    popup.current.showPopover();
    positionPopup(trigger.current, popup.current);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    window.clearTimeout(closeTimer.current);
    setActiveValue(option.value);
    if (option.value !== value) onValueChange(option.value);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      close();
    } else {
      closeTimer.current = window.setTimeout(close, SELECTION_ACK_MS);
    }
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    function reposition(event: Event) {
      if (!trigger.current || !popup.current) return;
      if (event.target instanceof Node && popup.current.contains(event.target)) return;
      positionPopup(trigger.current, popup.current);
    }

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const panel = popup.current;
    const option = document.getElementById(`${listId}-${activeIndex}`);
    if (!panel || !option) return;
    const start = option.offsetTop;
    const end = start + option.offsetHeight;
    if (start < panel.scrollTop) panel.scrollTop = start;
    if (end > panel.scrollTop + panel.clientHeight) panel.scrollTop = end - panel.clientHeight;
  }, [activeIndex, listId, open]);

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      window.clearTimeout(closeTimer.current);
      const last = options.length - 1;
      const start = open ? activeIndex : selectedIndex;
      let next = start;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = last;
      else if (open || start < 0) {
        next = event.key === 'ArrowDown' ? Math.min(last, start + 1) : Math.max(0, start - 1);
        if (start < 0 && event.key === 'ArrowUp') next = last;
      }
      if (open) setActiveValue(options[next]?.value);
      else show(next);
      return;
    }
    const now = performance.now();
    const continuing = Boolean(typeahead.current.text) && now - typeahead.current.time <= TYPEAHEAD_MS;
    if (event.key === 'Enter' || (event.key === ' ' && !continuing)) {
      event.preventDefault();
      if (open) choose(activeIndex);
      else show();
      return;
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    window.clearTimeout(closeTimer.current);
    const key = event.key.toLocaleLowerCase('es');
    const text = continuing ? typeahead.current.text + key : key;
    typeahead.current = { text, time: now };
    const repeated = [...text].every(character => character === key);
    const prefix = searchKey(repeated ? key : text);
    const current = open ? activeIndex : selectedIndex;
    const start = current + (repeated || current < 0 ? 1 : 0);
    const ordered = [...options.slice(start), ...options.slice(0, start)];
    const match = ordered.find(option => searchKey(option.label).startsWith(prefix));
    if (!match) return;
    if (open) setActiveValue(match.value);
    else if (match.value !== value) onValueChange(match.value);
  }

  return <>
    <button
      ref={trigger}
      id={id}
      type="button"
      role="combobox"
      className="fluid-select-trigger"
      data-variant={variant}
      aria-labelledby={`${id}-label`}
      aria-expanded={open}
      aria-controls={listId}
      aria-describedby={describedBy}
      aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
      disabled={disabled}
      onClick={() => open ? close() : show()}
      onKeyDown={handleKey}
      onBlur={event => { if (event.relatedTarget && !popup.current?.contains(event.relatedTarget)) close(); }}
    >
      <span>{options[selectedIndex]?.label}</span>
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 8 5 5 5-5"/>
      </svg>
    </button>
    <FluidList
      ref={popup}
      id={listId}
      role="listbox"
      aria-labelledby={`${id}-label`}
      popover="auto"
      className="fluid-select-popup"
      onToggle={event => {
        if (event.currentTarget.matches(':popover-open')) return;
        window.clearTimeout(closeTimer.current);
        typeahead.current = { text: '', time: 0 };
        setOpen(false);
      }}
    >
      {options.map((option, index) => <li
        key={option.value}
        id={optionId(index)}
        role="option"
        aria-selected={option.value === value}
        data-fluid-row
        data-active={open && activeIndex === index}
        onMouseDown={event => event.preventDefault()}
        onClick={() => choose(index)}
      >
        <span>{option.label}</span>
        <span className="fluid-select-check" aria-hidden="true"><Icon name="check" size={16}/></span>
      </li>)}
    </FluidList>
  </>;
}
