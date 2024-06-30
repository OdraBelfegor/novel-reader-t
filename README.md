# Novel Reader (Server, Web App/Page, Extension)

## Docker Install

### Docker Build

``` bash
docker build -t odra_belf/novel-reader . --network="host"
```

### Docker Run

``` bash
docker run --gpus all -p 5000:5000/tcp -v E:/CoquiTTS/models/:/models -v E:\CoquiTTS\results\:/results -d odra_belf/novel-reader
```

## Instructions (Manual)

if server/public doesn't exists

```bash
    mkdir server/public
```

Build first webapp

```bash
    cd web
    pnpm run build
    pnpm run copy:destroy
```

Build server and install python deps

```bash
    # Create venv
    cd ..
    python -m venv env
    source env/bin/activate

    # Install dependecies
    cd server
    pip install -r requirements.txt

    # Build server
    pnpm run build

    # To use with .env run the next two separetly
    pnpm run start:dev
    pnpm run tts

    # OR run as it is with
    pnpm run start
```

To use extension first build

```bash
    cd extension
    pnpm run build
```

Localize path to directory and load in chrome based browser with developer mode, load extension without package

## Todo

- [x] Text processor to separate by sentences
- [x] Cache audio from a sentence in a Player, so as to not to request multiple times
- [x] Frontend use of sentences
- [x] Make the web page a web app, to not use a tab in the browser
- [x] Make DOCKERFILE
- [x] Add loop limiter and loop control to server and web
- [ ] Change way of playing audio?
- [ ] Add way to change which viewer is the player of audio
- [x] Add key bindings
