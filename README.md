# Finanzas Control

## Desplegar en Vercel

### Opción A: Desde GitHub (recomendado)
1. Sube esta carpeta a un repo de GitHub
2. Ve a [vercel.com](https://vercel.com) y crea cuenta con GitHub
3. "Import Project" → selecciona tu repo
4. Framework: Vite → Deploy

### Opción B: CLI
```bash
npm install
npm run build
npx vercel --prod
```

## Reglas de Firestore
Copia el contenido de `firestore.rules` en:
Firebase Console → Firestore → Rules → pega y publica.

## Instalar como app (PWA)
- **Android**: Chrome → menú ⋮ → "Agregar a pantalla de inicio"
- **iPhone**: Safari → compartir → "Agregar a inicio"
# finanzas-control
