<script lang="ts">
  let { size = 36 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
  <rect width="36" height="36" rx="9" fill="#1F6B45" />
  <path d="M10 17h16v9a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round" />
  <path d="M15 21.5h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
  <path d="M18 14.5s-3.5-3-3.5-5.6a3.5 3.5 0 0 1 7 0c0 2.6-3.5 5.6-3.5 5.6z" fill="#fff" />
  <circle cx="18" cy="8.9" r="1.3" fill="#1F6B45" />
</svg>
