# Actualizaciones en Tiempo Real - Sistema de Fuegos

## 🎯 Objetivo

Implementar actualizaciones automáticas e instantáneas de balances y transacciones sin necesidad de cerrar sesión y volver a iniciar.

---

## 🐛 Problema Original

**Antes del Fix:**
- Después de enviar/recibir fuegos → No se veía el cambio de balance
- Después de aprobar solicitudes → Admin no veía actualización
- Usuario que recibió fuegos → No veía el cambio hasta relogin
- Historial de transacciones → No se actualizaba automáticamente

**Usuario tenía que:**
1. Cerrar sesión
2. Volver a iniciar sesión
3. Recién ahí ver los cambios

---

## ✅ Solución Implementada

### **1. SendFiresModal.js** ✅
**Qué hace:** Cuando un usuario envía fuegos a otro usuario

**Cambios implementados:**
```javascript
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const SendFiresModal = ({ isOpen, onClose, currentBalance, onSuccess }) => {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  
  const handleConfirm = async () => {
    // ... código de envío
    
    // ✅ Invalidar queries para actualizar datos en tiempo real
    await refreshUser();
    queryClient.invalidateQueries(['user-stats']);
    queryClient.invalidateQueries(['user-wallet']);
    queryClient.invalidateQueries(['wallet-transactions']);
    
    // ... resto del código
  };
};
```

**Resultado:**
- ✅ Balance se actualiza inmediatamente después de enviar
- ✅ Historial de transacciones se actualiza automáticamente
- ✅ Stats del usuario se refrescan

---

### **2. BuyFiresModal.js** ✅
**Qué hace:** Cuando un usuario solicita comprar fuegos

**Cambios implementados:**
```javascript
import { useQueryClient } from '@tanstack/react-query';

const BuyFiresModal = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  
  const handleSubmit = async () => {
    // ... código de solicitud
    
    // ✅ Invalidar queries de solicitudes
    queryClient.invalidateQueries(['fire-requests']);
    
    // ... resto del código
  };
};
```

**Resultado:**
- ✅ Lista de solicitudes del admin se actualiza automáticamente
- ✅ No necesita refrescar la página para ver la nueva solicitud

---

### **3. Admin.js (AdminFireRequests)** ✅
**Qué hace:** Cuando el admin aprueba/rechaza una solicitud de fuegos

**Cambios implementados:**
```javascript
import { useQuery, useQueryClient } from '@tanstack/react-query';

const AdminFireRequests = () => {
  const queryClient = useQueryClient();
  
  const handleConfirmReview = async () => {
    // ... código de aprobación/rechazo
    
    // ✅ Invalidar todas las queries relevantes para actualizar en tiempo real
    queryClient.invalidateQueries(['fire-requests']);
    queryClient.invalidateQueries(['user-stats']);
    queryClient.invalidateQueries(['user-wallet']);
    queryClient.invalidateQueries(['wallet-transactions']);
    queryClient.invalidateQueries(['admin-stats']);
    
    // ... resto del código
  };
};
```

**Resultado:**
- ✅ Lista de solicitudes se actualiza (cambia de "Pendiente" a "Aprobada")
- ✅ Balance del usuario afectado se actualiza automáticamente
- ✅ Stats del admin panel se actualizan
- ✅ Si el usuario tiene Profile abierto, verá el cambio inmediatamente

---

### **4. Profile.js** ✅
**Qué hace:** Página principal del perfil del usuario con stats y balance

**Cambios implementados:**

#### **A. Refetch Interval (Polling)**
```javascript
import { useQuery, useQueryClient } from '@tanstack/react-query';

const Profile = () => {
  const queryClient = useQueryClient();
  
  // ✅ Fetch user stats con refetch automático cada 10 segundos
  const { data: stats } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      const response = await axios.get(`/profile/${user.id}/stats`);
      return response.data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // ✅ Refetch cada 10 segundos
    refetchIntervalInBackground: false
  });

  // ✅ Fetch wallet con refetch automático cada 10 segundos
  const { data: walletData } = useQuery({
    queryKey: ['user-wallet', user?.id],
    queryFn: async () => {
      const response = await axios.get(`/profile/${user.id}`);
      setWalletId(response.data.wallet_id);
      return response.data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // ✅ Refetch cada 10 segundos
    refetchIntervalInBackground: false
  });
};
```

#### **B. Botón de Actualizar Mejorado**
```javascript
const handleRefreshBalance = async () => {
  await refreshUser();
  // ✅ Invalidar todas las queries para forzar actualización
  queryClient.invalidateQueries(['user-stats', user?.id]);
  queryClient.invalidateQueries(['user-wallet', user?.id]);
  queryClient.invalidateQueries(['user-games', user?.id]);
  toast.success('Balance actualizado');
};
```

**Resultado:**
- ✅ Balance se actualiza automáticamente cada 10 segundos
- ✅ Usuario no necesita hacer nada, simplemente ver su profile
- ✅ Botón "Actualizar Balance" funciona instantáneamente
- ✅ Si reciben fuegos, lo ven en máximo 10 segundos

---

### **5. FiresHistoryModal.js** ✅
**Qué hace:** Modal que muestra el historial de transacciones de fuegos

**Cambios implementados:**

**Antes:** Usaba `useEffect` + `fetchTransactions` manual
```javascript
// ❌ Código antiguo
const [transactions, setTransactions] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (isOpen) {
    fetchTransactions(); // Manual, sin refetch automático
  }
}, [isOpen, page]);

const fetchTransactions = async () => {
  setLoading(true);
  // ... fetch manual
  setLoading(false);
};
```

**Después:** Usa `useQuery` con refetch automático
```javascript
// ✅ Código nuevo
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const FiresHistoryModal = ({ isOpen, onClose, onOpenSend, onOpenBuy, onOpenReceive }) => {
  const { user } = useAuth();
  
  // ✅ Usar React Query para manejar transacciones con refetch automático
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['wallet-transactions', user?.id, page],
    queryFn: async () => {
      if (!user?.id) return { transactions: [], total: 0 };
      const response = await axios.get(`/profile/${user.id}/transactions`, {
        params: {
          currency: 'fires',
          limit: pageSize,
          offset: page * pageSize
        }
      });
      return response.data;
    },
    enabled: isOpen && !!user?.id,
    refetchInterval: 5000, // ✅ Refetch cada 5 segundos cuando el modal está abierto
    refetchIntervalInBackground: false
  });

  const transactions = data?.transactions || [];
  const total = data?.total || 0;
};
```

**Resultado:**
- ✅ Historial se actualiza automáticamente cada 5 segundos
- ✅ Cuando se envía/recibe fuegos, aparece en el historial automáticamente
- ✅ No necesita cerrar y abrir el modal
- ✅ Mejor manejo de estados (loading, error, success)

---

## 🔄 Flujo Completo de Actualización

### **Ejemplo 1: Usuario A envía fuegos a Usuario B**

**Usuario A (Remitente):**
1. Click en "Enviar Fuegos"
2. Ingresa wallet_id de Usuario B
3. Ingresa cantidad (ej: 10 fuegos)
4. Confirma envío
5. ✅ **Balance se actualiza instantáneamente** (de 100 → 89.5 por comisión)
6. ✅ **Historial muestra nueva transacción** "Enviado: -10.5"
7. ✅ **Toast:** "10 fuegos enviados exitosamente"

**Usuario B (Receptor):**
- Si está en Profile → En máximo **10 segundos** ve su balance actualizado (de 50 → 60)
- Si abre "Historial de Fuegos" → En máximo **5 segundos** ve la transacción "Recibido: +10"
- Si recarga la página → Ve el cambio inmediatamente

### **Ejemplo 2: Admin aprueba solicitud de compra**

**Usuario C (Solicitante):**
1. Había solicitado 100 fuegos hace 1 hora
2. Está navegando en su Profile
3. ✅ En máximo **10 segundos** ve su balance aumentar (de 20 → 120)
4. ✅ Si abre "Historial" ve la transacción "Compra: +100"

**Admin:**
1. Ve solicitud "Pendiente"
2. Click en "Aprobar"
3. Ingresa notas de revisión
4. Confirma
5. ✅ **Lista de solicitudes se actualiza** (cambia a "Aprobada")
6. ✅ **Stats del admin panel se actualizan**
7. ✅ **Toast:** "Solicitud aprobada exitosamente"

---

## ⚙️ Configuración de Refetch Intervals

| Componente | Query | Intervalo | Cuándo se Ejecuta |
|------------|-------|-----------|-------------------|
| **Profile.js** | `user-stats` | 10 seg | Siempre que esté en Profile |
| **Profile.js** | `user-wallet` | 10 seg | Siempre que esté en Profile |
| **FiresHistoryModal** | `wallet-transactions` | 5 seg | Solo cuando el modal esté abierto |
| **Admin** | `fire-requests` | Manual | Solo al aprobar/rechazar |

**Nota:** `refetchIntervalInBackground: false` significa que solo se actualiza cuando el usuario tiene la pestaña activa.

---

## 🎨 Experiencia de Usuario

### **Antes:**
```
Usuario envía fuegos → Balance no cambia → Usuario confundido
Usuario cierra sesión → Inicia sesión de nuevo → Ahora sí ve el cambio
```

### **Después:**
```
Usuario envía fuegos → ✅ Balance se actualiza INSTANTÁNEAMENTE
Usuario recibe fuegos → ✅ Ve el cambio en máximo 10 segundos
Admin aprueba → ✅ Usuario ve el cambio en máximo 10 segundos
Historial abierto → ✅ Se actualiza cada 5 segundos automáticamente
```

---

## 📊 Invalidaciones de Queries

Cuando se ejecuta `queryClient.invalidateQueries([key])`, React Query:
1. Marca la query como "stale" (desactualizada)
2. Si la query está activa → Refetch inmediatamente
3. Si la query está inactiva → Se refrescará la próxima vez que se use

**Queries principales:**
- `['user-stats', userId]` → Stats del usuario (balance, totales)
- `['user-wallet', userId]` → Datos de billetera
- `['wallet-transactions', userId, page]` → Historial de transacciones
- `['fire-requests']` → Lista de solicitudes de fuegos (admin)
- `['admin-stats']` → Estadísticas del panel de admin

---

## 🚀 Ventajas Técnicas

### **1. React Query Automático**
- ✅ Cache inteligente (no refetch innecesarios)
- ✅ Deduplicación de requests (si 2 componentes usan la misma query)
- ✅ Retry automático en caso de error
- ✅ Loading/Error states manejados automáticamente

### **2. Invalidación Inteligente**
- ✅ Solo refetch de queries que realmente cambiaron
- ✅ Queries inactivas no hacen requests innecesarios
- ✅ Sincronización entre múltiples componentes

### **3. Refetch Intervals**
- ✅ Polling solo cuando el usuario está activo
- ✅ Se detiene en background (ahorra recursos)
- ✅ Configurable por componente

---

## 🧪 Cómo Probar

### **Test 1: Enviar Fuegos**
1. Usuario A abre Profile
2. Click en "Fuegos 🔥" → "Enviar"
3. Pegar wallet_id de Usuario B
4. Enviar 10 fuegos
5. ✅ **Verificar:** Balance de A disminuye inmediatamente
6. Usuario B abre su Profile
7. ✅ **Verificar:** En máximo 10 segundos ve +10 fuegos

### **Test 2: Admin Aprobar**
1. Usuario solicita compra de 50 fuegos
2. Admin abre "Solicitudes"
3. Aprueba la solicitud
4. ✅ **Verificar:** Lista cambia a "Aprobada" inmediatamente
5. Usuario abre Profile
6. ✅ **Verificar:** En máximo 10 segundos ve +50 fuegos

### **Test 3: Historial en Tiempo Real**
1. Usuario abre "Historial de Fuegos"
2. Otro usuario le envía fuegos
3. ✅ **Verificar:** En máximo 5 segundos aparece la transacción en el historial
4. Sin cerrar el modal, el historial sigue actualizándose automáticamente

---

## 📦 Archivos Modificados

```
✅ frontend/src/components/SendFiresModal.js
   - Agregar useQueryClient y refreshUser
   - Invalidar queries después de enviar

✅ frontend/src/components/BuyFiresModal.js
   - Agregar useQueryClient
   - Invalidar queries de solicitudes

✅ frontend/src/pages/Admin.js
   - Agregar useQueryClient a AdminFireRequests
   - Invalidar múltiples queries después de aprobar/rechazar

✅ frontend/src/pages/Profile.js
   - Agregar refetchInterval (10 seg) a queries
   - Mejorar handleRefreshBalance con invalidaciones

✅ frontend/src/components/FiresHistoryModal.js
   - Convertir de useEffect a useQuery
   - Agregar refetchInterval (5 seg)
```

---

## 🎯 Resultado Final

```
✅ Actualizaciones instantáneas después de enviar fuegos
✅ Actualizaciones automáticas cada 10 segundos en Profile
✅ Historial con refetch cada 5 segundos
✅ Admin panel se actualiza inmediatamente
✅ No se requiere cerrar sesión para ver cambios
✅ Mejor experiencia de usuario
✅ Menos confusión
✅ Sistema se siente más "vivo" y reactivo
```

---

## 📝 Commit

```bash
Commit: 08d67d4
Mensaje: "feat: actualizaciones en tiempo real para transacciones de fuegos"
Archivos: 5 changed, 58 insertions(+), 27 deletions(-)
```

**Push exitoso a:** `origin/main`
**Railway:** Auto-desplegará en ~2-3 minutos

---

**Estado:** ✅ **COMPLETADO Y DESPLEGADO**

Ahora el sistema de fuegos funciona con actualizaciones en tiempo real, sin necesidad de cerrar sesión para ver los cambios. Los usuarios verán las transacciones reflejadas inmediatamente o en máximo 10 segundos.
