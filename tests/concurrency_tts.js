

async function getAudio(text) {
    const res = await fetch('http://localhost:8000/tts', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: text,
    });
    if (!res.ok) throw new Error(`HTTP Error -${res.status}-: ${res.statusText}`);
    return await res.arrayBuffer();
}

async function main() {
    const result = await Promise.all([
        getAudio('Hello World, this is the first request'),
        getAudio('Hello World, this is the second request'),])
    console.log(result);
}

main();