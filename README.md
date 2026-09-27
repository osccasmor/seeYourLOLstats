# Summoner Search

Web sencilla con barra de búsqueda que consulta perfiles públicos con la **API oficial de Riot Games** y **registra cada búsqueda** (fecha, IP, plataforma, Nombre#TAG, resultado).

## Probar en local

1. Saca tu clave en https://developer.riotgames.com/ (la de dev caduca cada 24h).
2. Copia `.env.example` como `.env` y pega la clave en `RIOT_API_KEY`.
3. Instala y arranca:
   ```
   npm install
   npm start
   ```
4. Abre http://localhost:3000

Ver el log en vivo mientras alguien busca:
```
Get-Content searches.log -Wait -Tail 10
```

## Desplegar y mandar el link (Render, gratis)

1. **Sube el proyecto a GitHub** (crea un repo y haz push de esta carpeta).
2. Entra en https://render.com → **New → Web Service** → conecta el repo.
3. Configuración:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. En **Environment** añade la variable:
   - `RIOT_API_KEY` = tu clave de Riot
5. Deploy. Render te da una URL pública tipo `https://tu-app.onrender.com` → esa se la mandas a tu compa.
6. **Los logs:** en el panel de Render, pestaña **Logs**, ves cada búsqueda en directo (la línea `[SEARCH] ...`).

> Nota: en Render (plan gratis) el sistema de archivos es efímero, así que `searches.log` se puede borrar al reiniciar. Por eso las búsquedas también salen por consola, y **la consola de Render es tu registro fiable**.

## Aviso sobre la clave

- La **Development Key caduca cada 24h**. Si mañana tu compa abre el link y da error 403, renueva la clave en el portal de Riot y actualízala en Render. Para algo permanente hay que registrar un producto en el portal de desarrolladores.
- Nunca subas tu `.env` a un repo público (por eso está en `.gitignore`).
