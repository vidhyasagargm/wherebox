<script lang="ts">
  let { blob, alt }: { blob: Blob; alt: string } = $props()

  const url = $derived(URL.createObjectURL(blob))
  $effect(() => {
    const current = url
    return () => URL.revokeObjectURL(current)
  })
</script>

<img src={url} {alt} />

<style>
  img {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
    border-radius: 14px;
    display: block;
  }
</style>
