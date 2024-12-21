<script lang="ts">
  type Props = {
    message: string;
    type: import('@/stores.svelte').ToastType;
    id: number;
  };
  let { message, type, id }: Props = $props();
  import { InfoIcon, WarningIcon, SuccessIcon, CloseIcon } from '@/assets/svg';
  import { toastStore } from '@/stores.svelte';
</script>

<div class="container">
  <div class="icon">
    {#if type === 'info'}
      <InfoIcon />
    {:else if type === 'warning'}
      <WarningIcon />
    {:else if type === 'success'}
      <SuccessIcon />
    {/if}
  </div>
  <div class="message">
    {message}
  </div>
  <div class="close">
    <button type="button" onclick={() => toastStore.remove(id)}>
      <CloseIcon />
    </button>
  </div>
</div>

<style>
  .container {
    display: flex;
    align-items: center;
    width: 100%;
    background-color: var(--secondary-color);
    border: 3px solid var(--text-color);
    height: 4rem;
    border-radius: 0.5rem;
    pointer-events: all;
  }

  .icon,
  .close {
    color: var(--text-color);
    height: 3rem;
    /* margin: 0 0.5rem; */
    width: 3rem;
    &svg {
      width: 100%;
      height: 100%;
    }
  }

  .close {
    > button {
      cursor: pointer;
      padding: 0;
      color: inherit;
      background-color: transparent;
      width: 3rem;
      height: 3rem;
      border: none;
    }
  }
  .message {
    flex: 1;
    color: var(--text-color);
    font-size: 16pt;
    /* width: 100%; */
  }
</style>
