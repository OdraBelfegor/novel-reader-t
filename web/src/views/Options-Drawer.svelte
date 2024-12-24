<script lang="ts">
  import IconButton from '@lib/ButtonIcon.svelte';
  import TextButton from '@lib/ButtonText.svelte';
  import { increaseFontSize, decreaseFontSize } from '@utils/user-config';
  import { playerStateStore, themeStore, audioControlStore } from '@/stores.svelte';
  import Dialog from '@/lib/Dialog.svelte';
  import {
    TextSizeUpIcon,
    TextSizeDownIcon,
    UniqueIcon,
    LoopIcon,
    SetLoopLimitIcon,
    RemoveLoopLimitIcon,
    DarkThemeIcon,
    LightThemeIcon,
    SoundIcon,
  } from '@/assets/svg';
  import { socket } from '@/socket';

  let dialog: Dialog;
  // svelte-ignore non_reactive_update
  let limitElememt: HTMLInputElement;

  let isOpen: boolean = $state(false);
  let volumeValue: number = $state($audioControlStore.volume);
  let playbackValue: number = $state($audioControlStore.playback);

  $effect(() => {
    audioControlStore.changeValues({ volume: volumeValue, playback: playbackValue });
  });

  export function open() {
    isOpen = true;
  }

  export function close() {
    isOpen = false;
  }

  function onclickLoopLimit() {
    if ($playerStateStore.loopLimit !== null) {
      socket.emit('player:remove-loop-limit');
      return;
    }

    let limit = Number(limitElememt.value);
    if (limit <= 0) return;

    socket.emit('player:set-loop-limit', limit);

    dialog.close();
  }
</script>

<Dialog bind:this={dialog}>
  {#if $playerStateStore.loopLimit === null}
    <input id="limit" type="number" bind:this={limitElememt} />
    <!-- <button onclick={onclickLoopLimit}>Set loop limit</button> -->
    <TextButton onclick={onclickLoopLimit}>Set loop limit</TextButton>
  {:else}
    <button onclick={onclickLoopLimit}>Remove loop limit</button>
  {/if}
</Dialog>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="options"
  class:open={isOpen}
  onclick={event => event.currentTarget === event.target && close()}
>
  <div class="container" class:open={isOpen}>
    <div class="controls">
      <div class="grouping">
        <div class="font-controls">
          <IconButton title="Increase font size" size="normal" onclick={increaseFontSize}>
            <TextSizeUpIcon />
          </IconButton>
          <IconButton title="Decrease font size" size="normal" onclick={decreaseFontSize}>
            <TextSizeDownIcon />
          </IconButton>
        </div>
        <div class="device-controls">
          <IconButton
            title="Listen here"
            size="small"
            onclick={() => socket.emit('audio:change-device')}
          >
            <SoundIcon />
          </IconButton>
        </div>
      </div>
      <div class="grouping">
        <div class="group-1">
          {#if $playerStateStore.loop}
            <IconButton
              title={`${$playerStateStore.loopActive ? 'Break' : 'Continue'} loop`}
              onclick={() => socket.emit('player:toggle-loop')}
            >
              {#if $playerStateStore.loopActive}
                <UniqueIcon />
              {:else}
                <LoopIcon />
              {/if}
            </IconButton>
          {/if}
          {#if $playerStateStore.loop}
            <IconButton
              title={`${$playerStateStore.loopLimit === null ? 'Set' : 'Remove'} loop limit`}
              onclick={() =>
                $playerStateStore.loopLimit !== null ? onclickLoopLimit() : dialog.open()}
            >
              {#if $playerStateStore.loopLimit !== null}
                <RemoveLoopLimitIcon />
              {:else}
                <SetLoopLimitIcon />
              {/if}
            </IconButton>
          {/if}
        </div>
        <div class="group-2">
          <IconButton title="Switch theme" size="normal" onclick={themeStore.toggle}>
            {#if $themeStore === 'light'}
              <DarkThemeIcon />
            {:else}
              <LightThemeIcon />
            {/if}
          </IconButton>
        </div>
      </div>
    </div>
    <div class="sliders">
      <div>
        <label for="volume">Volume: </label>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.02"
          name="volume"
          id="volume"
          bind:value={volumeValue}
        />
        <label for="volume">{volumeValue}</label>
      </div>
      <div>
        <label for="speed">Playback: </label>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.02"
          name="speed"
          id="speed"
          bind:value={playbackValue}
        />
        <label for="speed">{playbackValue}</label>
      </div>
    </div>
  </div>
</div>

<style>
  .options {
    position: fixed;
    z-index: 8;
    width: 100dvw;
    height: 100dvh;
    top: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0);
    visibility: hidden;
    transition:
      visibility 0.3s ease,
      background-color 0.3s ease;
  }
  .options.open {
    visibility: visible;
    background-color: rgba(0, 0, 0, 0.5);
  }
  .container {
    position: fixed;
    width: 100dvw;
    height: 40dvh;
    top: 0;
    left: 0;
    transform: translateY(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background-color: var(--secondary-color);
  }

  .container.open {
    transform: translateY(0);
  }

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 1rem;
  }

  .font-controls {
    align-self: start;
  }

  .grouping {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .group-1 {
    display: flex;
    gap: 0.5rem;
  }
  .group-2 {
    display: flex;
    justify-content: end;
  }

  .sliders {
    display: flex;
    flex-direction: column;
    margin: 3rem 1rem;
    gap: 2rem;
    flex-wrap: wrap;
    > div {
      display: flex;
      align-items: center;

      > input {
        width: 100%;
      }
      > label {
        width: 6rem;
        text-align: center;
        flex-shrink: 0;
        font-weight: 900;
      }
    }
  }
</style>
