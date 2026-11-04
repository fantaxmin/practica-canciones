<script lang="ts">
  import { onMount } from "svelte";
  import { practiceLog } from "../lib/practiceLog";
  import { songs } from "../lib/stores";
  import { daysSince } from "../lib/freshness";
  import { computeStreak, totalPracticeSeconds, topSongs, formatDuration, dailyMinutes, staleSongs } from "../lib/stats";

  let { onNavigate }: { onNavigate: (tab: "repertorio" | "setlist" | "stats") => void } = $props();
  let now = $state(Date.now());
  const streak = $derived.by(() => { now; return computeStreak($practiceLog); });
  const totalSeconds = $derived(totalPracticeSeconds($practiceLog));
  const top = $derived(topSongs($practiceLog, 5));
  const activity = $derived(dailyMinutes($practiceLog, 14, now));
  const maxMinutes = $derived(Math.max(1, ...activity.map((day) => day.minutes)));
  const retomables = $derived(staleSongs($songs, 3));
  const dateLabel = (at: number) => new Date(at).toLocaleDateString("es", { day: "numeric", month: "short" });
  const minuteLabel = (minutes: number) => `${minutes.toLocaleString("es", { maximumFractionDigits: 1 })} min`;

  onMount(() => {
    const clock = setInterval(() => { now = Date.now(); }, 60_000);
    return () => clearInterval(clock);
  });
</script>

<div class="stats">
  <h2 tabindex="-1">Estadísticas</h2>
  {#if !$practiceLog.length}
    <div class="empty">
      <svg aria-hidden="true" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="34" width="10" height="20" rx="3" fill="var(--primary)"/><rect x="27" y="10" width="10" height="44" rx="3" fill="var(--accent)"/><rect x="44" y="24" width="10" height="30" rx="3" fill="var(--primary)"/></svg>
      <h3>Aún no hay prácticas</h3>
      <p>Marca las canciones que practiques para ver tu actividad.</p>
      <button class="press-btn" onclick={() => onNavigate("setlist")}>Generar un setlist</button>
    </div>
  {:else}
    <dl class="stat-grid">
      <div class="stat-card"><dt>{streak === 1 ? "día seguido" : "días seguidos"}</dt><dd>{streak}</dd></div>
      <div class="stat-card"><dt>tiempo total</dt><dd>{formatDuration(totalSeconds)}</dd></div>
      <div class="stat-card"><dt>{$practiceLog.length === 1 ? "práctica marcada" : "prácticas marcadas"}</dt><dd>{$practiceLog.length}</dd></div>
    </dl>

    <section class="activity-section" aria-labelledby="activity-title">
      <h3 id="activity-title">Actividad de los últimos 14 días</h3>
      <p class="hint">Minutos practicados por día. La última barra corresponde a hoy.</p>
      <svg class="activity-chart" viewBox="0 0 560 160" role="img" aria-labelledby="activity-title activity-description">
        <desc id="activity-description">{activity.map((day, index) => `${index === 13 ? "Hoy" : dateLabel(day.at)}: ${minuteLabel(day.minutes)}`).join(". ")}</desc>
        <line x1="0" x2="560" y1="140" y2="140" stroke="var(--line)" />
        {#each activity as day, index (day.date)}
          {@const height = (day.minutes / maxMinutes) * 120}
          <g role="img" aria-label={`${index === 13 ? "Hoy" : dateLabel(day.at)}: ${minuteLabel(day.minutes)}`}>
            <title>{dateLabel(day.at)}: {minuteLabel(day.minutes)}</title>
            <rect x={index * 40 + 9} y={140 - height} width="22" height={Math.max(0, height)} rx="3" fill={index === 13 ? "var(--primary)" : "color-mix(in srgb, var(--accent) 70%, var(--text))"} />
            <text x={index * 40 + 20} y="157" text-anchor="middle" aria-hidden="true">{index === 13 ? "Hoy" : new Date(day.at).getDate()}</text>
          </g>
        {/each}
      </svg>
      <details class="activity-data">
        <summary>Ver actividad en tabla</summary>
        <table><caption class="sr-only">Minutos practicados en los últimos 14 días</caption><thead><tr><th scope="col">Día</th><th scope="col">Minutos</th></tr></thead><tbody>
          {#each activity as day, index (day.date)}<tr><th scope="row">{dateLabel(day.at)}{index === 13 ? " · Hoy" : ""}</th><td>{minuteLabel(day.minutes)}</td></tr>{/each}
        </tbody></table>
      </details>
    </section>

    <section class="top-section" aria-labelledby="top-title">
      <h3 id="top-title">Más practicadas</h3>
      <ol class="top-list">
        {#each top as song (song.songId)}
          <li>
            <div class="top-row"><span class="song-title">{song.title}</span><span class="count">{song.count} {song.count === 1 ? "vez" : "veces"}</span></div>
            <div class="relative-track" aria-hidden="true"><div style:width={`${(song.count / top[0].count) * 100}%`}></div></div>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if retomables.length}
    <section class="retomar-section" aria-labelledby="retomar-title">
      <div class="section-header"><h3 id="retomar-title">Para retomar</h3><button class="pill-btn" onclick={() => onNavigate("repertorio")}>Ir a repertorio</button></div>
      <ul class="retomar-list">
        {#each retomables as song (song.id)}
          {@const freshness = daysSince(song.lastPracticedAt, now)}
          <li><span class="freshness-dot {freshness.level}" aria-hidden="true"></span><div><span class="song-title">{song.title}</span>{#if song.artist}<p class="artist">{song.artist}</p>{/if}<p class="freshness">{freshness.text}</p></div></li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .stats { display:flex; flex-direction:column; gap:28px; }
  h2 { font:700 1.25rem/1.3 "Bricolage Grotesque", sans-serif; margin:0; }
  h3 { font:700 1.125rem/1.3 "Bricolage Grotesque", sans-serif; margin:0 0 16px; }
  .stat-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; margin:0; }
  .stat-card { display:flex; flex-direction:column-reverse; gap:8px; padding:20px; border:1px solid var(--line); border-radius:var(--radius-md); background:var(--surface); }
  dt { color:var(--muted); font-size:.8125rem; }
  dd { margin:0; font:700 1.75rem/1.2 "Bricolage Grotesque", sans-serif; overflow-wrap:anywhere; }
  section { border-top:1px solid var(--line); padding-top:24px; min-width:0; }
  .hint { color:var(--muted); font-size:.8125rem; margin:0 0 16px; }
  .activity-chart { display:block; width:100%; max-height:220px; }
  .activity-chart text { fill:var(--muted); font:12px "Manrope", sans-serif; }
  summary { min-height:44px; padding:12px 0; font-weight:700; font-size:.875rem; cursor:pointer; }
  summary:focus-visible { outline:3px solid var(--focus-ring); outline-offset:3px; }
  table { width:100%; border-collapse:collapse; font-size:.8125rem; }
  th,td { padding:10px 8px; text-align:left; border-bottom:1px solid var(--line); }
  tbody th { font-weight:500; }
  td { text-align:right; font-family:"JetBrains Mono", monospace; }
  .top-list, .retomar-list { margin:0; padding:0; list-style:none; }
  .top-list { display:flex; flex-direction:column; gap:20px; }
  .top-row { display:flex; align-items:baseline; justify-content:space-between; gap:16px; margin-bottom:8px; }
  .song-title { font:700 1rem/1.4 "Bricolage Grotesque", sans-serif; overflow-wrap:anywhere; }
  .count { color:var(--muted); font-size:.8125rem; white-space:nowrap; }
  .relative-track { height:4px; background:var(--surface-muted); border-radius:2px; overflow:hidden; }
  .relative-track div { height:100%; background:var(--primary); }
  .section-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
  .section-header h3 { margin:0; }
  .retomar-list { display:flex; flex-direction:column; gap:16px; }
  .retomar-list li { display:flex; align-items:flex-start; gap:12px; }
  .retomar-list li > div { min-width:0; }
  .freshness-dot { width:8px; height:8px; flex-shrink:0; border-radius:50%; margin-top:7px; }
  .fresh { background:var(--accent); } .warm { background:var(--warning); } .stale { background:color-mix(in srgb, var(--primary) 65%, var(--surface)); }
  .artist, .freshness { color:var(--muted); font-size:.8125rem; margin:4px 0 0; overflow-wrap:anywhere; }
  .empty { text-align:center; padding:24px 16px; }
  .empty h3 { margin:16px 0 8px; }
  .empty p { color:var(--muted); font-size:.875rem; margin:0 0 20px; }
  @media (max-width:640px) { .activity-chart text { font-size:20px; } }
  @media (max-width:420px) { .stat-grid { grid-template-columns:1fr; gap:8px; } .stat-card { flex-direction:row-reverse; align-items:center; justify-content:space-between; padding:16px; gap:16px; } dd { font-size:1.375rem; text-align:right; } }
</style>
