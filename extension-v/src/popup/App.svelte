<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Input } from '$lib/components/ui/input/index';
  import { Button } from '$lib/components/ui/button/index';
  import { Label } from '$lib/components/ui/label/index';

  export let status: 'Connected' | 'Disconnected' | undefined;
  export let serverUrl: string | undefined;

  const dispatch = createEventDispatcher();
</script>

<main class="flex flex-col items-center justify-center space-y-4 max-w-sm w-full mx-auto">
  <div class="w-full space-y-2">
    <Label
      for="server-url"
      class="font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-sm"
      >Server URL:</Label
    >
    <!-- <label for="server-url">Server URL:</label> -->
    <Input
      bind:value={serverUrl}
      type="text"
      name="server-url"
      id="server-url"
      placeholder="http://..."
      disabled={status === 'Connected'}
      class="flex h-10 rounded-md border border-input bg-background px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-sm w-full"
    />
    <!-- <input
      bind:value={serverUrl}
      type="text"
      name="server-url"
      id="server-url"
      placeholder="http://..."
      disabled={status === 'Connected'}
    /> -->
  </div>
  <div class="w-full">
    <Button
      type="button"
      on:click={() => {
        dispatch('button-click', serverUrl);
      }}
      class={`inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 w-full text-sm px-4 py-2 rounded-md ${status === 'Disconnected' ? 'bg-green-500' : 'bg-red-500'} hover:${status === 'Disconnected' ? 'bg-green-600' : 'bg-red-600'} text-white`}
      >{status === 'Connected' ? 'Disconnect' : 'Connect'}</Button
    >
  </div>
  <div
    class="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
  >
    Connection Status: <span class="font-bold">{status || 'loading...'}</span>
  </div>
</main>
