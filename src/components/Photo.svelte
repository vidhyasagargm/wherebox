<script lang="ts">
  import { photoBlob, type StoredPhoto } from '../lib/db'

  let { photo, alt }: { photo: StoredPhoto | Blob; alt: string } = $props()

  // A damaged photo shows nothing rather than breaking the screen.
  const url = $derived.by(() => {
    try {
      const blob = photoBlob(photo)
      return blob ? URL.createObjectURL(blob) : ''
    } catch {
      return ''
    }
  })
  $effect(() => {
    const current = url
    return () => current && URL.revokeObjectURL(current)
  })
</script>

{#if url}<img src={url} {alt} />{/if}

<style>
  img {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
    border-radius: 14px;
    display: block;
  }
</style>
