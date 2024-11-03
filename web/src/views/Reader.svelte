<script lang="ts">
  import { tick } from 'svelte';
  import { derived } from 'svelte/store';
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
  } from '@/stores.svelte';

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
  let progressBar: HTMLDivElement;
  let content: HTMLDivElement;

  const state = derived(playerStateStore, $playerStateStore => $playerStateStore.state);
  const loop = derived(playerStateStore, $playerStateStore => $playerStateStore.loop);
  const loopActive = derived(playerStateStore, $playerStateStore => $playerStateStore.loopActive);
  const loopCounter = derived(playerStateStore, $playerStateStore => $playerStateStore.loopCounter);
  const loopLimit = derived(playerStateStore, $playerStateStore => $playerStateStore.loopLimit);
  const contentLength = derived(contentStore, $contentStore => $contentStore.length);

  contentLength.subscribe(async () => {
    await tick();
    progress.set(0);
  });

  function scrollIfActive(node: HTMLSpanElement, active: boolean) {
    if (active) {
      scrollIntoView(node, { scrollMode: 'if-needed', block: 'center', behavior: 'instant' });
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

  function controlProgressBar(
    e: UIEvent & {
      currentTarget: HTMLDivElement;
    },
  ) {
    const target = e.currentTarget;
    let scrollTop = target.scrollTop;
    let scrollHeight = target.scrollHeight - target.clientHeight;
    let scrollPercentage = (scrollTop / scrollHeight) * 100;

    progress.set(scrollPercentage);
  }

  function controlScrollbar(
    event: MouseEvent & {
      currentTarget: HTMLDivElement;
    },
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;

    const progressPercentage = Math.round((x / rect.width) * 10000) / 10000;

    const contentHeight = content.scrollHeight - content.getBoundingClientRect().height;
    content.scrollTop = contentHeight * progressPercentage;
  }

  function handleKeydownWindow(
    event: KeyboardEvent & {
      currentTarget: EventTarget & Window;
    },
  ) {
    const target = event.target as HTMLElement;
    if (['input', 'textarea'].includes(target.tagName.toLowerCase())) return;

    if (!event.altKey) return;

    const keycode = event.code;
    if (keycode === 'KeyJ') socket.emit('player:backward');
    if (keycode === 'KeyK') socket.emit('player:play');
    if (keycode === 'KeyL') socket.emit('player:forward');
    if (keycode === 'KeyI') socket.emit('player:toggle-loop');
    if (keycode === 'KeyO') socket.emit('player:stop');
  }
</script>

<svelte:window onkeydown={handleKeydownWindow} />

<div class="actions-reader">
  <div>
    <IconButton title="Increase font size" size="small" onclick={increaseFontSize}>
      <TextSizeUpIcon />
    </IconButton>
    <IconButton title="Decrease font size" size="small" onclick={decreaseFontSize}>
      <TextSizeDownIcon />
    </IconButton>
  </div>
  <div>
    <IconButton title="Skip backward" size="small" onclick={() => socket.emit('player:backward')}>
      <SkipStartIcon />
    </IconButton>
    <IconButton title="Start/Resume/Pause" onclick={() => socket.emit('player:play')}>
      {#if $state === 'PLAYING' || $state === 'IDLE'}
        <PauseIcon />
      {:else}
        <PlayIcon />
      {/if}
    </IconButton>
    <IconButton title="Stop" onclick={() => socket.emit('player:stop')}>
      <StopIcon />
    </IconButton>
    <IconButton title="Skip forward" size="small" onclick={() => socket.emit('player:forward')}>
      <SkipEndIcon />
    </IconButton>
  </div>
  <div>
    {#if $loop}
      <IconButton
        title="{$loopActive ? 'Break' : 'Continue'} loop"
        size="small"
        onclick={() => socket.emit('player:toggle-loop')}
      >
        {#if $loopActive}
          <UniqueIcon />
        {:else}
          <LoopIcon />
        {/if}
      </IconButton>
    {/if}
    <!-- TODO: Add Priority Button -->
    <IconButton title="Options" onclick={() => goToView('options')}>
      <OptionsIcon />
    </IconButton>
  </div>
</div>
<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="progress-wrapper" tabindex="-1" onclick={controlScrollbar}>
  <div class="progress-bar" bind:this={progressBar} style:width={`${$progress}%`}></div>
</div>
<div
  id="content"
  class="text-area"
  class:without-content={!$contentLength}
  onscroll={controlProgressBar}
  bind:this={content}
>
  {#if $contentStore.length !== 0}
    {#each $contentStore as paragraph}
      <p>
        {#each paragraph.sentences as sentence}
          {@const sentenceId = sentence.id}
          <span
            role="button"
            tabindex="-1"
            style="cursor:pointer"
            use:scrollIfActive={sentenceId === $contentIndexStore}
            onkeydown={() => onClickSentence(sentence.id)}
            onclick={() => onClickSentence(sentence.id)}>{`${sentence.sentence} `}</span
          >
        {/each}
      </p>
    {/each}
  {/if}
</div>
<div class="reader-bottom">
  {#if !$contentLength}
    <IconButton title="Return" onclick={toPreviousView}>
      <ReturnIcon />
    </IconButton>
  {/if}
  {#if $loopCounter !== null && $loopLimit !== null}
    <p>Remainig chapters: {$loopLimit - $loopCounter}</p>
  {/if}
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
    & p {
      color: var(--senary-color);
      font-size: 0.8rem;
      font-weight: 700;
      text-align: end;
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
    pointer-events: none;
  }

  .text-area::-webkit-scrollbar {
    display: none;
  }
</style>
