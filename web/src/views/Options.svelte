<script lang="ts">
  import { derived } from 'svelte/store';
  import { get } from 'svelte/store';

  import IconButton from '@lib/ButtonIcon.svelte';
  import {
    RequesterIcon,
    SetLoopLimitIcon,
    RemoveLoopLimitIcon,
    DarkThemeIcon,
    LightThemeIcon,
    ReturnIcon,
  } from '@/assets/svg';
  import { toPreviousView, playerStateStore } from '@/stores';
  import { socket } from '@/socket';

  let volume = Number(localStorage.getItem('volumen'));
  let playback = Number(localStorage.getItem('playback'));

  let theme = localStorage.getItem('theme');

  const loop = derived(playerStateStore, $playerStateStore => $playerStateStore.loop);
  const loopLimit = derived(playerStateStore, $playerStateStore => $playerStateStore.loopLimit);

  function switchTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    document.documentElement.dataset['theme'] = theme;
  }

  function onSave() {
    if (volume <= 2 && volume >= 0) {
      localStorage.setItem('volumen', String(volume));
    } else volume = Number(localStorage.getItem('volumen'));
    if (playback <= 2 && playback > 0) {
      localStorage.setItem('playback', String(playback));
    } else playback = Number(localStorage.getItem('playback'));
  }
</script>

<div class="actions actions-options">
  {#if $loop}
    <IconButton
      title="{$loopLimit !== null ? 'Remove' : 'Set'} loop limit"
      onClick={() => {
        if (get(loopLimit) === null) {
          setTimeout(() => {
            let limit = Number(prompt('Enter loop limit'));
            if (!isNaN(limit) && limit <= 10 && limit > 0)
              socket.emit('player:set-loop-limit', limit);
          }, 1);
        } else socket.emit('player:remove-loop-limit');
      }}
    >
      {#if $loopLimit !== null}
        <RemoveLoopLimitIcon />
      {:else}
        <SetLoopLimitIcon />
      {/if}
    </IconButton>
  {/if}
  <IconButton title="Switch theme" onClick={switchTheme}>
    {#if theme === 'light'}
      <DarkThemeIcon />
    {:else}
      <LightThemeIcon />
    {/if}
  </IconButton>
  <IconButton title="Return" onClick={toPreviousView}>
    <ReturnIcon />
  </IconButton>
</div>
<form class="options-container" name="options">
  <legend>Options</legend>
  <div class="option-group">
    <label for="volume">Volume: </label>
    <input
      type="number"
      inputmode="numeric"
      id="volume"
      min="0"
      max="2"
      step="0.05"
      bind:value={volume}
    />
  </div>
  <div class="option-group">
    <label for="playbackrate">Playback: </label>
    <input
      type="number"
      inputmode="numeric"
      id="playbackrate"
      min="0"
      max="2"
      step="0.05"
      bind:value={playback}
    />
  </div>
  <button class="button-primary btn-text" on:click|preventDefault={onSave}>Save</button>
</form>

<style>
  /* .option-group{
      & input {
  
      }
    } */
</style>
