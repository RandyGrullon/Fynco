# Configuración de Firebase Firestore

## Problema: "Permission denied" o "Insufficient permissions"

Este error ocurre porque las reglas de seguridad de Firestore están bloqueando las operaciones de escritura.

## Solución: Actualizar las reglas de Firestore

### Paso 1: Ir a Firebase Console
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto "fynco-95682"
3. Ve a **Firestore Database** en el menú lateral
4. Haz clic en la pestaña **Rules**

### Paso 2: Actualizar las reglas
Reemplaza las reglas actuales con esto:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Allow users to read and write their own transactions
      match /transactions/{transactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Paso 3: Publicar las reglas
1. Haz clic en **Publish** para aplicar las nuevas reglas
2. Las reglas deberían activarse inmediatamente

## Prueba la configuración

1. Ve a `http://localhost:9002/firestore-test` 
2. Inicia sesión si no lo has hecho
3. Haz clic en "Test Add Transaction"
4. Si funciona, las reglas están configuradas correctamente

## Reglas explicadas

- `match /users/{userId}`: Permite acceso a documentos de usuario
- `allow read, write: if request.auth != null && request.auth.uid == userId`: Solo permite acceso si el usuario está autenticado Y es el propietario del documento
- `match /transactions/{transactionId}`: Permite acceso a las transacciones dentro del documento del usuario
- `allow read, write: if false`: Niega acceso a todo lo demás por seguridad

## Si sigues teniendo problemas

1. Verifica que estás logueado correctamente
2. Revisa la consola del navegador para errores adicionales
3. Confirma que el proyecto de Firebase es el correcto
4. Asegúrate de que las reglas se publicaron correctamente

## Reglas temporales para desarrollo (NO usar en producción)

Si necesitas probar rápidamente, puedes usar estas reglas temporales (MENOS SEGURAS):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Estas reglas permiten que cualquier usuario autenticado lea/escriba cualquier documento. Úsalas solo para pruebas y recuerda cambiarlas por las reglas seguras después.
