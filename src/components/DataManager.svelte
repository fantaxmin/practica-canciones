<script lang="ts">
  import { createBackup, parseBackup, restoreBackup, type ImportSummary } from "../lib/backup";

  let fileInput: HTMLInputElement;
  let pendingFile = $state<File | null>(null);
  let pendingSummary = $state<ImportSummary | null>(null);
  let pendingBackup = $state<ReturnType<typeof parseBackup>["backup"] | null>(null);
  let status = $state("");
  let error = $state("");

  async function exportData() {
    error = "";
    status = "";
    try {
      const backup = await createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `practica-canciones-${date}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      status = `Respaldo creado con ${backup.songs.length} canciones.`;
    } catch {
      error = "No se pudo crear el respaldo. Inténtalo nuevamente.";
    }
  }

  async function inspectFile(event: Event) {
    error = "";
    status = "";
    pendingSummary = null;
    pendingBackup = null;
    pendingFile = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    if (!pendingFile) return;
    try {
      const result = parseBackup(await pendingFile.text());
      pendingBackup = result.backup;
      pendingSummary = result.summary;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "No se pudo leer el respaldo.";
      pendingFile = null;
      fileInput.value = "";
    }
  }

  function confirmImport() {
    if (!pendingBackup || !pendingSummary) return;
    restoreBackup(pendingBackup);
    status = `Importación completa: ${pendingSummary.songs} canciones y ${pendingSummary.practiceEvents} prácticas.`;
    pendingFile = null;
    pendingSummary = null;
    pendingBackup = null;
    fileInput.value = "";
  }

  function cancelImport() {
    pendingFile = null;
    pendingSummary = null;
    pendingBackup = null;
    fileInput.value = "";
  }
</script>

<section class="data-card" aria-labelledby="data-title">
  <div>
    <h2 id="data-title">Respaldo y transferencia</h2>
    <p>Descarga tus canciones e historial para restaurarlos en otro navegador.</p>
  </div>
  <div class="data-actions">
    <button class="press-btn ghost" type="button" onclick={exportData}>Exportar datos</button>
    <label class="press-btn file-button">
      Importar respaldo
      <input bind:this={fileInput} type="file" accept="application/json,.json" onchange={inspectFile} />
    </label>
  </div>
</section>

{#if pendingSummary}
  <div class="notice warning" role="alert">
    <strong>¿Restaurar “{pendingFile?.name}”?</strong>
    <span>Reemplazará los datos actuales por {pendingSummary.songs} canciones y {pendingSummary.practiceEvents} prácticas.</span>
    {#if pendingSummary.audioFilesToRelink > 0}
      <span>⚠ {pendingSummary.audioFilesToRelink} audios subidos que deberás adjuntar de nuevo en este navegador.</span>
    {/if}
    <div class="notice-actions">
      <button class="press-btn" type="button" onclick={confirmImport}>Sí, restaurar</button>
      <button class="pill-btn" type="button" onclick={cancelImport}>Cancelar</button>
    </div>
  </div>
{/if}
{#if status}<p class="notice success" role="status">✓ {status}</p>{/if}
{#if error}<p class="notice error" role="alert">⚠ {error}</p>{/if}

<style>
  .data-card { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:24px; border:1px solid var(--line); border-radius:var(--radius-lg); background:var(--surface); }
  h2 { margin:0 0 8px; font:700 1rem/1.2 "Bricolage Grotesque", sans-serif; }
  p { margin:0; color:var(--muted); font-size:.875rem; }
  .data-actions,.notice-actions { display:flex; gap:8px; flex-wrap:wrap; }
  .file-button { display:inline-flex; align-items:center; justify-content:center; }
  .file-button input { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
  .notice { display:flex; flex-direction:column; gap:8px; margin-top:16px; padding:16px; border:1px solid var(--line); border-radius:var(--radius-md); font-size:.875rem; }
  .notice.warning { background:var(--warning-soft); }
  .notice.success { color:var(--success); background:var(--success-soft); }
  .notice.error { color:var(--error); background:var(--error-soft); }
  @media (max-width: 640px) { .data-card { align-items:stretch; flex-direction:column; } .data-actions > * { flex:1; } }
</style>
