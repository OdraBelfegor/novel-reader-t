<script lang="ts">
  import ToastItem from './ToastItem.svelte';
  import { toastStore } from '@/stores.svelte';
</script>

<div class="toast-container">
  <section>
    {#if $toastStore.length > 0}
      {#each $toastStore as toast}
        <ToastItem message={toast.message} type={toast.type} id={toast.id} />
      {/each}
    {/if}
  </section>
</div>

<style>
  .toast-container {
    position: fixed;
    z-index: 99;
    top: 0;
    right: 0;
    width: 100dvw;
    justify-content: flex-end;
    align-items: flex-end;
    height: 100dvh;
    display: flex;
    pointer-events: none;
  }

  section {
    padding: 0.5rem;
    display: flex;
    width: 50%;
    min-width: 400px;
    max-width: 800px;
    height: 100%;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-end;
    pointer-events: none;
  }
</style>
