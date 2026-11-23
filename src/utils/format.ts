export const money = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export const decimal = (value: number, digits?: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: digits ?? 3, maximumFractionDigits: digits ?? 12 }).format(value);
export const quantity = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 12 }).format(value);
export const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(value)) : 'Fecha no disponible';
