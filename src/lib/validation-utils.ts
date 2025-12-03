/**
 * Utilidades de validación compartidas
 * Centraliza la lógica de validación común en toda la aplicación
 */

import { User } from "firebase/auth";

/**
 * Resultado de validación
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valida que un usuario esté autenticado
 */
export function validateUserAuthentication(
  user: User | null | undefined
): ValidationResult {
  if (!user) {
    return {
      isValid: false,
      error: "Debes iniciar sesión para realizar esta acción",
    };
  }
  return { isValid: true };
}

/**
 * Valida que un userId sea válido
 */
export function validateUserId(
  userId: string | undefined | null
): ValidationResult {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return {
      isValid: false,
      error: "ID de usuario inválido",
    };
  }
  return { isValid: true };
}

/**
 * Valida un monto (debe ser positivo)
 */
export function validateAmount(amount: number): ValidationResult {
  if (typeof amount !== "number" || isNaN(amount)) {
    return {
      isValid: false,
      error: "El monto debe ser un número válido",
    };
  }
  if (amount <= 0) {
    return {
      isValid: false,
      error: "El monto debe ser mayor que cero",
    };
  }
  return { isValid: true };
}

/**
 * Valida una fecha
 */
export function validateDate(date: any): ValidationResult {
  if (!date) {
    return {
      isValid: false,
      error: "La fecha es requerida",
    };
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return {
      isValid: false,
      error: "La fecha no es válida",
    };
  }

  return { isValid: true };
}

/**
 * Valida un email
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== "string") {
    return {
      isValid: false,
      error: "El email es requerido",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: "El formato del email no es válido",
    };
  }

  return { isValid: true };
}

/**
 * Valida una cadena de texto no vacía
 */
export function validateNonEmptyString(
  value: string | undefined | null,
  fieldName: string = "Campo"
): ValidationResult {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return {
      isValid: false,
      error: `${fieldName} es requerido`,
    };
  }
  return { isValid: true };
}

/**
 * Valida la longitud de una cadena
 */
export function validateStringLength(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string = "Campo"
): ValidationResult {
  if (value.length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} debe tener al menos ${minLength} caracteres`,
    };
  }
  if (value.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} no puede tener más de ${maxLength} caracteres`,
    };
  }
  return { isValid: true };
}

/**
 * Valida un PIN (4-12 dígitos)
 */
export function validatePIN(pin: string): ValidationResult {
  if (!pin || typeof pin !== "string") {
    return {
      isValid: false,
      error: "El PIN es requerido",
    };
  }

  if (!/^\d{4,12}$/.test(pin)) {
    return {
      isValid: false,
      error: "El PIN debe contener entre 4 y 12 dígitos",
    };
  }

  return { isValid: true };
}

/**
 * Valida que un valor esté dentro de un rango
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = "Valor"
): ValidationResult {
  if (value < min) {
    return {
      isValid: false,
      error: `${fieldName} debe ser al menos ${min}`,
    };
  }
  if (value > max) {
    return {
      isValid: false,
      error: `${fieldName} no puede ser mayor que ${max}`,
    };
  }
  return { isValid: true };
}

/**
 * Valida un array no vacío
 */
export function validateNonEmptyArray<T>(
  array: T[] | undefined | null,
  fieldName: string = "Lista"
): ValidationResult {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return {
      isValid: false,
      error: `${fieldName} no puede estar vacía`,
    };
  }
  return { isValid: true };
}

/**
 * Valida que un valor sea uno de los permitidos
 */
export function validateEnum<T>(
  value: T,
  allowedValues: T[],
  fieldName: string = "Valor"
): ValidationResult {
  if (!allowedValues.includes(value)) {
    return {
      isValid: false,
      error: `${fieldName} debe ser uno de: ${allowedValues.join(", ")}`,
    };
  }
  return { isValid: true };
}

/**
 * Combina múltiples validaciones
 */
export function combineValidations(
  ...validations: ValidationResult[]
): ValidationResult {
  for (const validation of validations) {
    if (!validation.isValid) {
      return validation;
    }
  }
  return { isValid: true };
}

/**
 * Ejecuta validaciones y lanza error si alguna falla
 */
export function throwIfInvalid(...validations: ValidationResult[]): void {
  const result = combineValidations(...validations);
  if (!result.isValid) {
    throw new Error(result.error);
  }
}
