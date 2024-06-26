<script lang="ts">
  import IconButton from '@lib/ButtonIcon.svelte';
  import { PlayIcon, WritteIcon, OptionsIcon } from '@/assets/svg';
  import { goToView } from '@/stores';
  import { socket } from '@/socket';
</script>

<svelte:window
  on:keydown={event => {
    // @ts-ignore
    if (['input', 'textarea'].includes(event.target.tagName.toLowerCase())) return;
    if (!event.altKey) return;
    const keycode = event.code;
    if (keycode === 'KeyK') socket.emit('player:play');
  }}
/>

<div class="actions actions-home">
  <IconButton
    title="Start"
    size="normal"
    on:click={() => {
      socket.emit('player:play');
      if (import.meta.env.DEV) {
        goToView('reader');
      }
    }}
  >
    <PlayIcon />
  </IconButton>
  <IconButton title="Go to write" size="normal" on:click={() => goToView('writer')}>
    <WritteIcon />
  </IconButton>
  <IconButton title="Go to options" size="normal" on:click={() => goToView('options')}>
    <OptionsIcon />
  </IconButton>
</div>

<style>
  .actions-home {
    justify-content: center;
    align-items: center;
    height: 100%;
  }
</style>
