<script lang="ts">
  

  

  
  interface Props {
    /** Title on hover */
    title: string;
    /** Size */
    size?: 'small' | 'normal';
    /** Callback when the button is clicked */
    onClick?: any;
    children?: import('svelte').Snippet;
  }

  let {
    title,
    size = 'normal',
    onClick = () => {},
    children
  }: Props = $props();
</script>

<button
  type="button"
  {title}
  onclick={onClick}
  class="button-primary btn-text {size === 'small' ? 'btn-small' : 'btn'}"
>
  {@render children?.()}
</button>
