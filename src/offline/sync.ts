// src/offline/sync.ts

import { api } from "../api";
import {
  getOutbox,
  clearOutbox,
  setMapping,
  putTaskLocal,
  removeTaskLocal,
} from "./db";

// Asumimos que normalizeTask está disponible o copiada aquí (si no, importala)
function normalizeTask(x: any) {
    return {
        _id: String(x?._id ?? x?.id),
        title: String(x?.title ?? "(sin título)"),
        descrption: x?.descrption ?? "",
        status: x?.status === "Completada" || x?.status === "En Progreso" || x?.status === "Pendiente" ? x.status : "Pendiente",
    };
}


export async function syncNow() {
  if (!navigator.onLine) return;

  const ops = (await getOutbox()).sort((a, b) => a.ts - b.ts);
  if (!ops.length) return;

  console.log(`[SYNC] Intentando sincronizar ${ops.length} operaciones...`);

  for (const op of ops) {
    try {
      if (op.op === "create") {
        console.log(`[SYNC] Procesando CREATE para clienteId: ${op.clienteId}`);

        const res = await api.post("/tasks", op.data);
        
        // 1. NORMALIZAR LA RESPUESTA PARA OBTENER EL SERVER ID
        const serverTask = normalizeTask(res.data?.task ?? res.data);
        const serverId = serverTask._id;

        if (!serverId || serverId === op.clienteId) {
          throw new Error("Error en la respuesta del servidor: No se obtuvo un ID válido.");
        }

        console.log(`[SYNC-CREATE] Mapeando ${op.clienteId} -> ${serverId}`);
        await setMapping(op.clienteId, serverId);

        // 2. REEMPLAZO CRÍTICO DE ID EN CACHÉ LOCAL
        await removeTaskLocal(op.clienteId); 
        await putTaskLocal(serverTask); // Usar la tarea normalizada con el serverId
        
        console.log(`[SYNC-CREATE] Tarea ${op.clienteId} reemplazada con ${serverId} localmente.`);

      } 
      // ... (mantener update y delete igual)

      // Si la operación fue exitosa, podemos marcarla para limpieza (implícito si el for loop termina)

    } catch (err) {
      console.error(`[SYNC] Falló la operación ${op.op} (ID: ${op.clienteId || op.serverId}):, err`);
      // 🚨 SI FALLA, DETENEMOS LA SINCRONIZACIÓN para reintentar la operación en el próximo evento
      return; 
    }
  }

  // Si todo el loop se completa, limpiamos la outbox
  await clearOutbox();
  console.log("✅ Sincronización completada. Outbox limpia.");
}