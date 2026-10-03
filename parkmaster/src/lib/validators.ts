import type { VehicleType } from './types';

export const PLATE_MOTO_MODERN = /^[A-Z]{3}\d{2}[A-Z]$/;
export const PLATE_MOTO_CLASSIC = /^[A-Z]{2,3}\d{2,3}$/;
export const PLATE_CARRO_STANDARD = /^[A-Z]{3}\d{3}$/;
export const PLATE_CARRO_CLASSIC = /^[A-Z]{2}\d{4}$/;
export const PLATE_CARRO_DIPLOMATIC = /^CD\d{3,4}$/;
export const PLATE_CARRO_TRAILER = /^R\d{4,5}$/;

export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function displayPlate(p: string): string {
  if (p.length === 6) return `${p.slice(0, 3)}-${p.slice(3)}`;
  if (p.length === 5) return `${p.slice(0, 3)}-${p.slice(3)}`;
  if (p.length > 6) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  return p;
}

/** Devuelve true si la placa encaja con los formatos oficiales colombianos habituales. */
export function isStandardPlate(plate: string, type: VehicleType): boolean {
  if (type === 'moto') {
    return PLATE_MOTO_MODERN.test(plate) || PLATE_MOTO_CLASSIC.test(plate) || /^\d{3}[A-Z]{3}$/.test(plate);
  }
  return (
    PLATE_CARRO_STANDARD.test(plate) ||
    PLATE_CARRO_CLASSIC.test(plate) ||
    PLATE_CARRO_DIPLOMATIC.test(plate) ||
    PLATE_CARRO_TRAILER.test(plate) ||
    /^[A-Z]{3}\d{2}$/.test(plate)
  );
}

/** 
 * Validador permisivo universal:
 * Permite matrículas clásicas (OLA92), modernas (ENB09H), diplomáticas (CD0123), etc.
 * Admite entre 4 y 8 caracteres alfanuméricos sin bloquear el flujo.
 */
export function validatePlate(plate: string, _type?: VehicleType): string | null {
  if (!plate) return 'Digite la placa del vehículo.';
  if (plate.length < 4 || plate.length > 8) {
    return 'La placa debe tener entre 4 y 8 caracteres alfanuméricos.';
  }
  return null;
}

/** Advertencia preventiva cuando una placa no encaja en los patrones habituales. */
export function getPlateWarning(plate: string, type: VehicleType): string | null {
  if (!plate || plate.length < 4 || plate.length > 8) return null;
  if (!isStandardPlate(plate, type)) {
    return `Formato especial no habitual (${displayPlate(plate)}). Se permite el ingreso preventivo.`;
  }
  return null;
}

export const NAME_CHAR = /[^\p{L}\s.'-]/u;       // todo lo que NO es letra
export const onlyLetters = (s: string) => s.replace(/[^\p{L}\s.'-]/gu, '');
export const onlyDigits = (s: string) => s.replace(/\D/g, '');
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
