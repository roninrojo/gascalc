import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
  searchPlaceholder?: string;
};

const SELECTION_ACK_MS = 300;
const TYPEAHEAD_MS = 700;
const EDGE = 8;
const GAP = 5;

function positionPopup(trigger: HTMLButtonElement | HTMLInputElement, popup: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const { clientWidth, clientHeight } = document.documentElement;
  const viewport = trigger instanceof HTMLInputElement ? window.visualViewport : null;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportWidth = viewport?.width ?? clientWidth;
  const viewportHeight = viewport?.height ?? clientHeight;
  const width = Math.min(Math.max(rect.width, 160), viewportWidth - EDGE * 2);
  const left = Math.max(viewportLeft + EDGE, Math.min(rect.left, viewportLeft + viewportWidth - width - EDGE));
  const below = viewportTop + viewportHeight - rect.bottom - GAP - EDGE;
  const above = rect.top - viewportTop - GAP - EDGE;
  const opensAbove = below < Math.min(popup.scrollHeight || 300, 300) && above > below;

  popup.style.width = `${width}px`;
  popup.style.left = `${left}px`;
  popup.style.maxHeight = `${Math.max(0, Math.min(opensAbove ? above : below, 300))}px`;
  popup.style.top = opensAbove ? 'auto' : `${rect.bottom + GAP}px`;
  popup.style.bottom = opensAbove ? `${clientHeight - rect.top + GAP}px` : 'auto';
  popup.dataset.side = opensAbove ? 'above' : 'below';
}

export function Select<Value extends string>({
  id, value, options: allOptions, onValueChange, disabled, variant = 'bordered', describedBy, searchPlaceholder,
}: SelectProps<Value>) {
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLUListElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const typeahead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<Value>();
  const [query, setQuery] = useState<string | null>(null);
  const options = useMemo(() => {
    const key = searchKey(query ?? '');
    return key ? allOptions.filter(option => searchKey(option.label).includes(key)) : allOptions;
  }, [allOptions, query]);
  const selectedIndex = options.findIndex(option => option.value === value);
  const activeIndex = query !== null && activeValue === undefined && options.length
    ? 0
    : options.findIndex(option => option.value === activeValue);
  const listId = `${id}-options`;
  const optionId = (index: number) => `${listId}-${index}`;

  function close() {
    window.clearTimeout(closeTimer.current);
    typeahead.current = { text: '', time: 0 };
    if (popup.current?.matches(':popover-open')) popup.current.hidePopover();
    setOpen(false);
    setQuery(null);
  }

  function show(index = selectedIndex < 0 ? 0 : selectedIndex) {
    const trigger = input.current ?? button.current;
    if (!trigger || !popup.current || popup.current.matches(':popover-open')) return;
    setActiveValue(options[index]?.value);
    button.current?.focus({ preventScroll: true });
    positionPopup(trigger, popup.current);
    popup.current.showPopover();
    positionPopup(trigger, popup.current);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    window.clearTimeout(closeTimer.current);
    setActiveValue(option.value);
    if (option.value !== value) onValueChange(option.value);
    if (searchPlaceholder !== undefined || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      close();
    } else {
      closeTimer.current = window.setTimeout(close, SELECTION_ACK_MS);
    }
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const viewport = input.current ? window.visualViewport : null;
    function reposition(event: Event) {
      const trigger = input.current ?? button.current;
      if (!trigger || !popup.current) return;
      if (event.target instanceof Node && popup.current.contains(event.target)) return;
      positionPopup(trigger, popup.current);
    }

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    viewport?.addEventListener('resize', reposition);
    viewport?.addEventListener('scroll', reposition);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      viewport?.removeEventListener('resize', reposition);
      viewport?.removeEventListener('scroll', reposition);
    };
  }, [open]);

  useEffect(() => {
    if (open && input.current && popup.current) positionPopup(input.current, popup.current);
  }, [open, options.length]);

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

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown'
        ? Math.min(options.length - 1, activeIndex + 1)
        : activeIndex < 0 ? options.length - 1 : Math.max(0, activeIndex - 1);
      if (open) setActiveValue(options[next]?.value);
      else show(event.key === 'ArrowDown' ? 0 : options.length - 1);
    }
  }

  const combobox = {
    id,
    role: 'combobox',
    'aria-labelledby': `${id}-label`,
    'aria-expanded': open,
    'aria-controls': listId,
    'aria-describedby': describedBy,
    'aria-activedescendant': open && activeIndex >= 0 ? optionId(activeIndex) : undefined,
    disabled,
  };

  return <>
    {searchPlaceholder !== undefined ? <div className="fluid-select-search"><input
      {...combobox}
      ref={input}
      className="fluid-select-trigger"
      type="text"
      aria-autocomplete="list"
      autoComplete="off"
      placeholder={searchPlaceholder}
      value={query ?? (value === '' ? '' : allOptions.find(option => option.value === value)?.label ?? '')}
      onFocus={event => { event.currentTarget.select(); show(0); }}
      onClick={() => show(0)}
      onBlur={close}
      onKeyDown={handleSearchKey}
      onChange={event => { show(0); setQuery(event.target.value); setActiveValue(undefined); }}
    /><Icon name="search" size={17}/></div> :
    <button
      {...combobox}
      ref={button}
      type="button"
      className="fluid-select-trigger"
      data-variant={variant}
      onClick={() => open ? close() : show()}
      onKeyDown={handleKey}
      onBlur={event => { if (event.relatedTarget && !popup.current?.contains(event.relatedTarget)) close(); }}
    >
      <span>{options[selectedIndex]?.label}</span>
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 8 5 5 5-5"/>
      </svg>
    </button>}
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
        setQuery(null);
      }}
    >
      {options.length === 0 && <li role="option" aria-selected="false" aria-disabled="true">No hay opciones coincidentes.</li>}
      {options.map((option, index) => <li
        key={option.value}
        id={optionId(index)}
        role="option"
        aria-selected={option.value === value}
        data-fluid-row
        data-active={open && activeIndex === index}
        onPointerDown={event => { if (searchPlaceholder !== undefined) event.preventDefault(); }}
        onMouseDown={event => event.preventDefault()}
        onClick={() => choose(index)}
      >
        <span>{option.label}</span>
        <span className="fluid-select-check" aria-hidden="true"><Icon name="check" size={16}/></span>
      </li>)}
    </FluidList>
  </>;
}
