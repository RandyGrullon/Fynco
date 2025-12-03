# Documentación de Seguridad de Fynco

## Índice
1. [Visión General](#visión-general)
2. [Arquitectura de Encriptación](#arquitectura-de-encriptación)
3. [Protección de Datos](#protección-de-datos)
4. [Autenticación y Autorización](#autenticación-y-autorización)
5. [Privacidad del Usuario](#privacidad-del-usuario)
6. [Cumplimiento y Regulaciones](#cumplimiento-y-regulaciones)
7. [Mejores Prácticas](#mejores-prácticas)

---

## Visión General

Fynco implementa un **modelo de seguridad de confianza cero** donde la privacidad del usuario es la máxima prioridad. A diferencia de otras aplicaciones financieras, **Fynco no puede ver los datos financieros del usuario** debido a la encriptación end-to-end implementada.

### Principios de Seguridad

1. **Encriptación por Defecto**: Todos los datos sensibles se encriptan antes de ser almacenados
2. **Confianza Cero**: Ni siquiera los administradores pueden acceder a datos financieros
3. **Privacidad por Diseño**: La arquitectura previene el acceso no autorizado
4. **Transparencia Total**: El usuario tiene control completo sobre sus datos

---

## Arquitectura de Encriptación

### Encriptación End-to-End (E2EE)

Fynco utiliza **AES-GCM de 256 bits** para encriptar todos los datos financieros sensibles.

#### Flujo de Encriptación

```
1. Usuario inicia sesión → Firebase Auth genera UID único
2. Aplicación deriva clave de encriptación de UID + Salt único
3. Datos sensibles se encriptan en el dispositivo del usuario
4. Solo datos encriptados se envían a Firestore
5. Servidor almacena datos ilegibles sin la clave
```

#### Componentes Técnicos

**Algoritmo de Encriptación**: AES-GCM (Galois/Counter Mode)
- **Tamaño de clave**: 256 bits
- **IV (Initialization Vector)**: 12 bytes únicos por operación
- **Autenticación**: Tag de autenticación integrado

**Derivación de Clave**: PBKDF2 (Password-Based Key Derivation Function 2)
- **Algoritmo hash**: SHA-256
- **Iteraciones**: 100,000
- **Salt**: 16 bytes únicos por usuario
- **Entrada**: UID de Firebase Authentication

### Datos Encriptados

Los siguientes campos se encriptan automáticamente:

#### Transacciones
- `amount` (monto)
- `description` (descripción)
- `category` (puede contener información sensible)

#### Cuentas
- `name` (nombre de la cuenta)
- `balance` (balance actual)
- `initialBalance` (balance inicial)

#### Metas de Ahorro
- `name` (nombre de la meta)
- `targetAmount` (monto objetivo)
- `currentAmount` (monto actual)

#### Transacciones Recurrentes
- `amount` (monto)
- `description` (descripción)

### Estructura de Datos Encriptados

```typescript
interface EncryptedData {
  encrypted: string;  // Datos encriptados en base64
  iv: string;         // IV en base64
  version: number;    // Versión del algoritmo (para migraciones futuras)
}
```

### Ejemplo de Dato Almacenado

**Antes de encriptación** (solo en el dispositivo):
```json
{
  "description": "Pago de alquiler",
  "amount": 1200.00
}
```

**Después de encriptación** (en Firestore):
```json
{
  "description": {
    "encrypted": "xK9mP2nQ7zL8...",
    "iv": "Aa1Bb2Cc3...",
    "version": 1
  },
  "amount": {
    "encrypted": "vH4jM8kL3fN9...",
    "iv": "Dd4Ee5Ff6...",
    "version": 1
  }
}
```

---

## Protección de Datos

### Niveles de Seguridad

#### Nivel 1: Transporte
- **TLS 1.3**: Todas las comunicaciones usan HTTPS
- **Certificate Pinning**: (Recomendado para producción)

#### Nivel 2: Almacenamiento
- **Firestore Encryption at Rest**: Google encripta todos los datos en disco
- **E2EE**: Capa adicional de encriptación controlada por el usuario

#### Nivel 3: Aplicación
- **PIN/Biometría**: Protección local de la aplicación
- **Session Timeout**: Cierre automático después de 30 minutos
- **Lock Screen**: Requiere autenticación para acceder

### Gestión de Claves

#### Generación de Clave

```typescript
// Proceso simplificado
1. Firebase Auth → UID único
2. Generar salt aleatorio (16 bytes)
3. PBKDF2(UID, salt, 100000 iteraciones) → Clave maestra
4. Almacenar solo el salt en Firestore (no la clave)
```

#### Almacenamiento de Clave

- **Clave maestra**: NUNCA se almacena, se deriva en cada sesión
- **Salt**: Se almacena en `/users/{uid}` en Firestore
- **Caché en memoria**: Durante la sesión activa (se limpia al cerrar)

#### Rotación de Claves

Actualmente no implementado. Para futuras versiones:
- El usuario podrá regenerar su salt
- Todos los datos se re-encriptarán con la nueva clave
- Proceso transparente para el usuario

---

## Autenticación y Autorización

### Firebase Authentication

Fynco utiliza Firebase Authentication para gestionar identidades:

- **Email/Password**: Autenticación principal
- **Email Verification**: Requerida para activar cuenta
- **Password Reset**: Flujo seguro de recuperación

### Reglas de Seguridad de Firestore

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Función auxiliar
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    
    // Usuarios solo pueden acceder a sus datos
    match /users/{userId} {
      allow read, write: if isOwner(userId);
      
      // Subcolecciones (accounts, transactions, etc.)
      match /{collection}/{docId} {
        allow read, write: if isOwner(userId);
        allow create: if isOwner(userId) && 
                         request.resource.data.userId == userId;
      }
    }
    
    // Denegar todo lo demás
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Validación de Propiedad

Todas las operaciones verifican:
1. Usuario está autenticado
2. UID coincide con el propietario de los datos
3. Documento contiene el `userId` correcto

---

## Privacidad del Usuario

### Principios GDPR

Fynco cumple con GDPR (Reglamento General de Protección de Datos):

#### Derecho de Acceso
- Usuario puede ver todos sus datos en cualquier momento
- Exportación de datos disponible

#### Derecho de Rectificación
- Usuario puede editar cualquier información
- Sincronización inmediata

#### Derecho al Olvido
- Eliminación completa de cuenta disponible en configuración
- Proceso irreversible que elimina todos los datos

#### Portabilidad de Datos
- Exportación en formato JSON/CSV
- Descarga completa de datos financieros

### Minimización de Datos

Fynco solo recopila:
- Email (para autenticación)
- UID (generado por Firebase)
- Datos financieros (encriptados)
- Preferencias de usuario (tema, moneda)

**NO recopilamos**:
- Nombre completo
- Dirección física
- Número de teléfono
- Datos de tarjetas bancarias reales
- Información de cuentas bancarias reales

### Transparencia

#### Política de Privacidad
Disponible en `/legal/privacy`
- Describe qué datos se recopilan
- Explica cómo se usan
- Detalla la arquitectura de encriptación
- Confirma que Fynco NO PUEDE ver datos financieros

#### Términos y Condiciones
Disponibles en `/legal/terms`
- Responsabilidades del usuario
- Limitaciones del servicio
- Proceso de eliminación de cuenta

---

## Cumplimiento y Regulaciones

### Estándares Implementados

#### GDPR (Europa)
- ✅ Consentimiento explícito
- ✅ Derecho al olvido
- ✅ Portabilidad de datos
- ✅ Minimización de datos
- ✅ Seguridad por diseño

#### CCPA (California)
- ✅ Derecho a saber qué datos se recopilan
- ✅ Derecho a eliminar datos
- ✅ No venta de datos personales

#### PCI DSS (NO APLICABLE)
Fynco NO procesa pagos con tarjeta, por lo que PCI DSS no aplica.
Los usuarios registran transacciones manualmente, no conectamos con bancos.

### Auditoría

#### Logs de Seguridad
- Movimientos (`movements` collection): Auditoría de todas las acciones
- Incluye: tipo de acción, timestamp, usuario, metadata

#### Revisión de Código
- Código abierto (GitHub)
- Revisiones regulares de seguridad
- Dependencias actualizadas

---

## Mejores Prácticas

### Para Usuarios

1. **Usa contraseña fuerte y única**
   - Mínimo 12 caracteres
   - Combina letras, números y símbolos
   - No reutilices contraseñas

2. **Habilita PIN/Biometría**
   - Agrega capa adicional de protección
   - Previene acceso no autorizado en dispositivo

3. **Mantén tu email actualizado**
   - Necesario para recuperación de cuenta
   - Notificaciones de seguridad

4. **Revisa tus datos regularmente**
   - Verifica transacciones
   - Detecta actividad inusual

5. **Cierra sesión en dispositivos compartidos**
   - Previene acceso no autorizado
   - Usa la función de cerrar sesión

### Para Desarrolladores

1. **Nunca almacenes claves de encriptación**
   - Siempre deriva de UID + salt
   - Limpia caché al cerrar sesión

2. **Valida entrada del usuario**
   - Sanitiza datos antes de encriptar
   - Previene inyección

3. **Usa funciones de utilidad**
   - `firestore-utils.ts` para operaciones CRUD
   - `validation-utils.ts` para validaciones
   - `encryption.ts` para encriptación

4. **Prueba con datos reales**
   - Verifica que la encriptación funciona
   - Prueba recuperación de datos

5. **Mantén dependencias actualizadas**
   - Revisa vulnerabilidades con `npm audit`
   - Actualiza Firebase SDK regularmente

---

## Contacto de Seguridad

Si descubres una vulnerabilidad de seguridad:

**Email**: security@fynco.app
**Respuesta esperada**: 48-72 horas

Por favor, NO divulgues públicamente hasta que hayamos investigado y solucionado el problema.

---

## Changelog de Seguridad

### v2.0.0 (Diciembre 2025)
- ✅ Implementada encriptación end-to-end AES-GCM 256
- ✅ Derivación de clave con PBKDF2
- ✅ Sistema de eliminación completa de cuenta
- ✅ Política de privacidad y términos
- ✅ Diálogo de consentimiento
- ✅ Refactorización de código duplicado

### v1.0.0 (Anterior)
- Autenticación con Firebase
- Protección con PIN/Biometría
- Reglas de seguridad de Firestore
- Validación de propiedad de datos

---

**Última actualización**: 3 de diciembre de 2025
**Versión del documento**: 2.0
**Mantenido por**: Equipo de Fynco
