# 🔧 ASIGNAR ROL ADMIN A PRUEBA1 PARA TESTING

## ❌ PROBLEMA DETECTADO

El usuario `prueba1` **NO tiene rol admin/tote**, solo tiene rol "user".

Por eso el panel de administración no aparece y el endpoint retorna:
```
403 Forbidden - Solo administradores pueden ver este panel
```

---

## ✅ SOLUCIÓN: Ejecutar SQL en Railway

### **Opción 1: Railway Dashboard (RECOMENDADO)**

1. Ir a https://railway.app/
2. Seleccionar proyecto `mundoxyz`
3. Click en PostgreSQL database
4. Click en pestaña "Query"
5. Pegar este SQL:

```sql
INSERT INTO user_roles (user_id, role_id, granted_by)
VALUES (
    '208d5eab-d6ce-4b56-9f18-f34bfdb29381',
    (SELECT id FROM roles WHERE name = 'admin'),
    '208d5eab-d6ce-4b56-9f18-f34bfdb29381'
)
ON CONFLICT (user_id, role_id) DO NOTHING;
```

6. Click "Run Query"

### **Opción 2: CLI**

```bash
# Conectar a Railway
railway login
railway link

# Ejecutar query
railway run psql -c "INSERT INTO user_roles (user_id, role_id, granted_by) VALUES ('208d5eab-d6ce-4b56-9f18-f34bfdb29381', (SELECT id FROM roles WHERE name = 'admin'), '208d5eab-d6ce-4b56-9f18-f34bfdb29381') ON CONFLICT (user_id, role_id) DO NOTHING;"
```

---

## ✅ VERIFICACIÓN

Después de ejecutar el SQL:

1. Cerrar sesión en la app
2. Volver a iniciar sesión con prueba1
3. Ir a `/profile`
4. Debería aparecer el panel rojo: **"🔧 Salas de Bingo (Administración)"**

---

## 📋 ARCHIVOS DISPONIBLES

- `ASSIGN_ADMIN_ROLE_PRUEBA1.sql` - Script completo con verificaciones
- `ASSIGN_ADMIN_PRUEBA1_QUICK.sql` - Script rápido para ejecutar directamente

---

## 🔍 ROLES ACTUALES DE PRUEBA1

```json
{
  "username": "prueba1",
  "roles": [
    {
      "id": 1,
      "name": "user",
      "description": "Regular user"
    }
  ]
}
```

**Después del SQL debería tener:**
```json
{
  "username": "prueba1",
  "roles": [
    {
      "id": 1,
      "name": "user"
    },
    {
      "id": 2,
      "name": "admin"
    }
  ]
}
```
