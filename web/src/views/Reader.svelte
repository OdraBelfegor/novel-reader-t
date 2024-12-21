<script lang="ts">
  import { tick } from 'svelte';
  import { derived } from 'svelte/store';
  import { tweened } from 'svelte/motion';
  import { sineOut } from 'svelte/easing';
  import scrollIntoView from 'scroll-into-view-if-needed';
  import { socket } from '@/socket';
  import IconButton from '@lib/ButtonIcon.svelte';
  import {
    contentStore,
    contentIndexStore,
    playerStateStore,
    toPreviousView,
  } from '@/stores.svelte';
  import {
    SkipStartIcon,
    PauseIcon,
    PlayIcon,
    StopIcon,
    SkipEndIcon,
    OptionsIcon,
    ReturnIcon,
  } from '@/assets/svg';
  import OptionsDrawer from './Options-Drawer.svelte';

  const progress = tweened(0, {
    duration: 300,
    easing: sineOut,
  });
  let progressBar: HTMLDivElement;
  let content: HTMLDivElement;

  let optionsDrawer: OptionsDrawer;

  $effect.pre(() => {
    document.addEventListener('keydown', handleKeydownWindow);

    return () => {
      document.removeEventListener('keydown', handleKeydownWindow);
    };
  });
  $effect(() => {
    progressBar.style.width = `${$progress}%`;
  });

  const state = derived(playerStateStore, $playerStateStore => $playerStateStore.state);
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

  function handleKeydownWindow(event: KeyboardEvent) {
    console.log('Keydown:', event.code);
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

<OptionsDrawer bind:this={optionsDrawer} />

<div class="reader">
  <div class="top-reader" class:without-content={!$contentLength}>
    <div class="menus">
      <IconButton
        title={$state === 'INACTIVE' ? 'Return' : 'Stop'}
        size="small"
        onclick={() => {
          if ($state === 'INACTIVE') toPreviousView();
          else socket.emit('player:stop');
        }}
      >
        {#if $state === 'INACTIVE'}
          <ReturnIcon />
        {:else}
          <StopIcon />
        {/if}
      </IconButton>
      <div class="info">
        {#if $playerStateStore.loopLimit !== null && $playerStateStore.loopCounter !== null}
          <span>Remaining: {$playerStateStore.loopLimit - $playerStateStore.loopCounter}</span>
        {/if}
      </div>
      <IconButton title="Options" size="small" onclick={() => optionsDrawer.open()}>
        <OptionsIcon />
      </IconButton>
    </div>

    <div id="content" onscroll={controlProgressBar} bind:this={content}>
      {#if $contentLength !== 0}
        {#each $contentStore as paragraph}
          <p>
            {#each paragraph.sentences as sentence}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <span
                role="button"
                tabindex="-1"
                style="cursor: pointer"
                onclick={() => onClickSentence(sentence.id)}
                use:scrollIfActive={sentence.id === $contentIndexStore}
                >{`${sentence.sentence} `}</span
              >
            {/each}
          </p>
        {/each}
      {/if}
    </div>
  </div>
  <div class="bottom-reader">
    <div class="actions-reader">
      <IconButton title="Backward" size="small" onclick={() => socket.emit('player:backward')}>
        <SkipStartIcon />
      </IconButton>
      <IconButton
        title={$state === 'PLAYING' ? 'Pause' : 'Play'}
        onclick={() => socket.emit('player:play')}
      >
        {#if $state === 'PLAYING' || $state === 'IDLE'}
          <PauseIcon />
        {:else}
          <PlayIcon />
        {/if}
      </IconButton>
      <IconButton title="Forward" size="small" onclick={() => socket.emit('player:forward')}>
        <SkipEndIcon />
      </IconButton>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="progress-wrapper" tabindex="-1" onclick={controlScrollbar}>
      <div class="progress-bar" bind:this={progressBar}></div>
    </div>
  </div>
</div>

<style>
  .top-reader {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--secondary-color);
    border-radius: 0 0 2rem 2rem;
    overflow: hidden;
  }

  .bottom-reader {
    display: flex;
    flex-direction: column;
  }

  #content {
    font-family:
      Helvetica Neue,
      sans-serif,
      monospace;
    font-size: var(--text-size);
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    word-break: break-word;
    padding: calc(var(--area-padding) + 0.5rem);

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .menus {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 1rem;
  }

  .info {
    display: flex;
    align-items: center;
    color: var(--senary-color);
    font-size: 0.8rem;
    font-weight: 500;
  }
  .actions-reader {
    display: flex;
    justify-content: space-evenly;
    margin: 0.5rem 0;
    align-items: center;
    padding: 0 1rem;
  }

  .reader {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .progress-wrapper {
    background-color: var(--quaternary-color);
    /* border: 1px solid var(--tertiary-color); */
  }

  .progress-bar {
    height: 0.7rem;
    background-color: var(--tertiary-color);
    pointer-events: none;
  }
</style>
