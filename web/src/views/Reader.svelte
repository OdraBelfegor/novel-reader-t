<script lang="ts">
  import type { Action } from 'svelte/action';
  import { derived, get } from 'svelte/store';
  import { tweened } from 'svelte/motion';
  import { sineOut } from 'svelte/easing';
  import scrollIntoView from 'scroll-into-view-if-needed';
  import { socket } from '@/socket';
  import IconButton from '@lib/ButtonIcon.svelte';
  import { increaseFontSize, decreaseFontSize } from '@utils/user-config';
  import {
    goToView,
    toPreviousView,
    contentStore,
    contentIndexStore,
    playerStateStore,
  } from '@/stores';

  import {
    TextSizeUpIcon,
    TextSizeDownIcon,
    SkipStartIcon,
    PauseIcon,
    PlayIcon,
    StopIcon,
    SkipEndIcon,
    UniqueIcon,
    LoopIcon,
    OptionsIcon,
    ReturnIcon,
  } from '@/assets/svg';

  const progress = tweened(0, {
    duration: 300,
    easing: sineOut,
  });
  let progressBar;

  const state = derived(playerStateStore, $playerStateStore => $playerStateStore.state);
  const loop = derived(playerStateStore, $playerStateStore => $playerStateStore.loop);
  const loopActive = derived(playerStateStore, $playerStateStore => $playerStateStore.loopActive);
  const loopLimit = derived(playerStateStore, $playerStateStore => $playerStateStore.loopLimit);
  const contentLength = derived(contentStore, $contentStore => $contentStore.length);

  function scrollIfActive(node: HTMLElement, active: boolean) {
    if (active) {
      scrollIntoView(node, { scrollMode: 'if-needed', block: 'center', behavior: 'smooth' });
      node.classList.add('active');
    } else node.classList.remove('active');
    return {
      update(active: boolean) {
        if (active) {
          scrollIntoView(node, { scrollMode: 'if-needed', block: 'center', behavior: 'smooth' });
          node.classList.add('active');
        } else node.classList.remove('active');
      },
      destroy() {},
    };
  }

  function onClickSentence(index: number) {
    console.log(`Sentence ${index} clicked`);
    socket.emit('player:seek', index);
  }

  function onScrollReader(e: Event) {
    const target = e.target as HTMLElement;
    let scrollTop = target.scrollTop;
    let scrollHeight = target.scrollHeight - target.clientHeight;
    let scrollPercentage = (scrollTop / scrollHeight) * 100;

    progress.set(scrollPercentage);
    // progressBar.style.width = `${scrollPercentage}%`;
  }
</script>

<div class="actions-reader">
  <div>
    <IconButton title="Increase font size" size="small" onClick={increaseFontSize}>
      <TextSizeUpIcon />
    </IconButton>
    <IconButton title="Decrease font size" size="small" onClick={decreaseFontSize}>
      <TextSizeDownIcon />
    </IconButton>
  </div>
  <div>
    <IconButton
      title="Skip backward"
      size="small"
      onClick={() => {
        console.log('Skip backward');
        socket.emit('player:backward');
      }}
    >
      <SkipStartIcon />
    </IconButton>
    <IconButton
      title="Start/Resume/Pause"
      onClick={() => {
        socket.emit('player:play');
      }}
    >
      {#if $state === 'PLAYING'}
        <PauseIcon />
      {:else}
        <PlayIcon />
      {/if}
    </IconButton>
    <IconButton
      title="Stop"
      onClick={() => {
        console.log('Stop');
        socket.emit('player:stop');
      }}
    >
      <StopIcon />
    </IconButton>
    <IconButton
      title="Skip forward"
      size="small"
      onClick={() => {
        console.log('Skip forward');
        socket.emit('player:forward');
      }}
    >
      <SkipEndIcon />
    </IconButton>
  </div>
  <div>
    {#if $loop}
      <IconButton
        title="{$loopActive ? 'Continue' : 'Break'} loop"
        size="small"
        onClick={() => socket.emit('player:toggle-loop')}
      >
        {#if $loopActive}
          <UniqueIcon />
        {:else}
          <LoopIcon />
        {/if}
      </IconButton>
    {/if}
    <!-- TODO: Add Priority Button -->
    <IconButton title="Options" onClick={() => goToView('options')}>
      <OptionsIcon />
    </IconButton>
  </div>
</div>
<div class="progress-wrapper">
  <div class="progress-bar" bind:this={progressBar} style="width:{$progress}%;"></div>
</div>
<div class="text-area" class:without-content={!$contentLength} on:scroll={onScrollReader}>
  {#if $contentStore.length !== 0}
    {#each $contentStore as paragraph}
      <p>
        {#each paragraph.sentences as sentence}
          <span
            role="button"
            tabindex="-1"
            style="cursor:pointer"
            use:scrollIfActive={$contentIndexStore === sentence.id}
            on:keydown={() => onClickSentence(sentence.id)}
            on:click={() => onClickSentence(sentence.id)}>{`${sentence.sentence} `}</span
          >
        {/each}
      </p>
    {/each}
  {/if}
</div>
<div class="reader-bottom">
  <div>
    {#if !$contentLength}
      <IconButton title="Return" onClick={toPreviousView}>
        <ReturnIcon />
      </IconButton>
    {:else}
      <div />
    {/if}
  </div>
  <div>
    {#if $loopLimit !== null}
      <p>Loop limit: {$loopLimit}</p>
    {/if}
  </div>
</div>

<style>
  .actions-reader {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    column-gap: 1%;
    margin-bottom: 0.5rem;

    & div {
      display: flex;
      align-items: center;
      gap: 1%;

      &:nth-child(1) {
        justify-content: start;
      }
      &:nth-child(2) {
        justify-content: center;
        gap: 0.5% !important;
      }
      &:nth-child(3) {
        justify-content: end;
      }
    }
  }

  .reader-bottom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 1%;
    align-items: center;
    margin-top: 8px;
    & div:nth-child(2) {
      color: var(--senary-color);
      font-size: 0.8rem;
      font-weight: 700;

      & p {
        text-align: end;
      }
    }
  }

  .progress-bar,
  .progress-wrapper {
    border-radius: 5px;
  }

  .progress-wrapper {
    background-color: var(--quaternary-color);
    margin-bottom: 2px;
    border: 1px solid var(--tertiary-color);
  }

  .progress-bar {
    height: 10px;
    background-color: var(--tertiary-color);
    width: 0%;
  }

  .text-area::-webkit-scrollbar {
    display: none;
  }
</style>
