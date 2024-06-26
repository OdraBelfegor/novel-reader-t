<script lang="ts">
  import { derived } from 'svelte/store';
  import { get } from 'svelte/store';

  import IconButton from '@lib/ButtonIcon.svelte';
  import {
    SetLoopLimitIcon,
    RemoveLoopLimitIcon,
    DarkThemeIcon,
    LightThemeIcon,
    ReturnIcon,
  } from '@/assets/svg';
  import { toPreviousView, playerStateStore, audioControlStore } from '@/stores';
  import { socket } from '@/socket';
  import { onMount } from 'svelte';

  const volume = derived(audioControlStore, $audioControlStore => $audioControlStore.volume);
  const playbackRate = derived(
    audioControlStore,
    $audioControlStore => $audioControlStore.playback,
  );

  let volumeInput: HTMLInputElement;
  let playbackInput: HTMLInputElement;

  let theme: 'light' | 'dark' = 'light';

  onMount(() => {
    // @ts-ignore
    theme = localStorage.getItem('theme');
    volumeInput.value = $volume.toString();
    playbackInput.value = $playbackRate.toString();
  });

  const loop = derived(playerStateStore, $playerStateStore => $playerStateStore.loop);
  const loopLimit = derived(playerStateStore, $playerStateStore => $playerStateStore.loopLimit);

  function switchTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    document.documentElement.dataset['theme'] = theme;
  }

  function saveConfig() {
    const volumeToSave = Number(volumeInput.value);
    const playbackToSave = Number(playbackInput.value);

    let volumeUpdate: number | undefined;
    let playbackUpdate: number | undefined;

    if (volumeToSave <= 2 && volumeToSave >= 0) {
      localStorage.setItem('volumen', String(volumeToSave));
      volumeUpdate = volumeToSave;
    } else {
      volumeInput.value = $volume.toString();
    }

    if (playbackToSave <= 2 && playbackToSave > 0) {
      localStorage.setItem('playback', String(playbackToSave));
      playbackUpdate = playbackToSave;
    } else {
      playbackInput.value = $playbackRate.toString();
    }

    if (volumeUpdate !== undefined || playbackUpdate !== undefined)
      audioControlStore.update(value => {
        return {
          volume: volumeUpdate ?? value.volume,
          playback: playbackUpdate ?? value.playback,
        };
      });
  }

  function controlLoop() {
    if (get(loopLimit) === null) {
      setTimeout(() => {
        let limit = Number(prompt('Enter loop limit'));
        if (!isNaN(limit) && limit <= 20 && limit > 0) socket.emit('player:set-loop-limit', limit);
      }, 1);
    } else socket.emit('player:remove-loop-limit');
  }
</script>

<div class="actions actions-options">
  {#if $loop}
    <IconButton title="{$loopLimit === null ? 'Set' : 'Remove'} loop limit" on:click={controlLoop}>
      {#if $loopLimit !== null}
        <RemoveLoopLimitIcon />
      {:else}
        <SetLoopLimitIcon />
      {/if}
    </IconButton>
  {/if}
  <IconButton title="Switch theme" on:click={switchTheme}>
    {#if theme === 'light'}
      <DarkThemeIcon />
    {:else}
      <LightThemeIcon />
    {/if}
  </IconButton>
  <IconButton title="Return" on:click={toPreviousView}>
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
      bind:this={volumeInput}
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
      bind:this={playbackInput}
    />
  </div>
  <button class="button-primary btn-text" on:click|preventDefault={saveConfig}>Save</button>
</form>

<style>
  /* .option-group{
      & input {
  
      }
    } */
</style>
