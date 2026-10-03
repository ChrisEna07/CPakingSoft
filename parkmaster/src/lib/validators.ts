import type { VehicleType } from './types';

export const PLATE_MOTO = /^[A-Z]{3}\d{2}[A-Z]$/;
export const PLATE_CARRO = /^[A-Z]{3}\d{3}$/;

export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
export function displayPlate(p: string): string {
  return p.length > 3 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}
/** Devuelve un mensaje de error explícito o null si la placa es válida. */
export function validatePlate(plate: string, type: VehicleType): string | null {
  if (!plate) return 'Digite la placa del vehículo.';
  if (type === 'moto' && !PLATE_MOTO.test(plate)) return `Placa de moto inválida: debe tener 3 letras, 2 números y 1 letra (ej. ABC-12D). Recibido: ${displayPlate(plate)}.`;
  if (type === 'carro' && !PLATE_CARRO.test(plate)) return `Placa de carro inválida: debe tener 3 letras y 3 números (ej. ABC-123). Recibido: ${displayPlate(plate)}.`;
  return null;
}

export const NAME_CHAR = /[^\p{L}\s.'-]/u;       // todo lo que NO es letra
export const onlyLetters = (s: string) => s.replace(/[^\p{L}\s.'-]/gu, '');
export const onlyDigits = (s: string) => s.replace(/\D/g, '');
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
