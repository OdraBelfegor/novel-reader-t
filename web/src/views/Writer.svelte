<script lang="ts">
  import IconButton from '@lib/ButtonIcon.svelte';
  import { socket } from '@/socket';
  import { toPreviousView } from '@/stores';
  import { increaseFontSize, decreaseFontSize } from '@/utils/user-config';
  import { GetIcon, PlayIcon, ReturnIcon, TextSizeDownIcon, TextSizeUpIcon } from '@/assets/svg';

  let writer = '';
  function onStart() {
    if (writer) {
      let text = writer.split('\n');
      text = text.map(line => line.trim()).filter(line => line.length > 0);

      writer = '';
      socket.emit('player:read-this', text);
      console.log(text);
    } else {
      setTimeout(() => {
        alert('Please write something first');
      }, 1);
    }
  }

  async function getContentFromProvider() {
    const text: string[] | [] = await socket
      .timeout(15000)
      .emitWithAck('request-provider')
      .catch(() => []);

    if (text.length === 0) return;

    writer = text.join('\n');
  }
</script>

<div class="actions-writer">
  <div>
    <IconButton title="Increase font size" size="small" on:click={increaseFontSize}>
      <TextSizeUpIcon />
    </IconButton>
    <IconButton title="Decrease font size" size="small" on:click={decreaseFontSize}>
      <TextSizeDownIcon />
    </IconButton>
  </div>
  <div>
    <IconButton title="Start" on:click={onStart}>
      <PlayIcon />
    </IconButton>
  </div>
  <div>
    <IconButton
      title="Content from provider at current page"
      size="small"
      on:click={getContentFromProvider}
    >
      <GetIcon />
    </IconButton>
    <IconButton title="Return" on:click={toPreviousView}>
      <ReturnIcon />
    </IconButton>
  </div>
</div>
<textarea
  name="writer"
  class="text-area"
  autocomplete="off"
  placeholder="Write what you want to hear"
  bind:value={writer}
></textarea>

<style>
  .actions-writer {
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
      }
      &:nth-child(3) {
        justify-content: end;
      }
    }
  }

  textarea {
    resize: none;
  }
</style>
