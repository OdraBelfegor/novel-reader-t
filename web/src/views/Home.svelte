<script lang="ts">
  import IconButton from '@lib/ButtonIcon.svelte';
  import { PlayIcon, WritteIcon, OptionsIcon } from '@/assets/svg';
  import { goToView } from '@/stores';
  import { socket } from '@/socket';
</script>

<div class="actions actions-home">
  <IconButton
    title="Start"
    size="normal"
    onClick={() => {
      socket.emit('player:play');
    }}
  >
    <PlayIcon />
  </IconButton>
  <IconButton title="Go to write" size="normal" onClick={() => goToView('writer')}>
    <WritteIcon />
  </IconButton>
  <IconButton title="Go to options" size="normal" onClick={() => goToView('options')}>
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
