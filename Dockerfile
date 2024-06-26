FROM ubuntu:jammy

ENV DEBIAN_FRONTEND noninteractive
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

ENV TTS_HOME=/models/ OUTPUT_DIR=/results/ TTS_SERVER=8088 PORT_SERVER=8080

RUN apt-get update

RUN apt-get install -y \
    espeak-ng \
    libsndfile1-dev \
    software-properties-common \
    curl

RUN add-apt-repository ppa:deadsnakes/ppa -y \
    && apt-get install -y python3.11 python3-pip


RUN curl -sL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs

RUN apt-get -y upgrade

RUN apt-get clean && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/python3.11 /usr/bin/python

RUN python -m pip install --upgrade pip

EXPOSE ${PORT_SERVER}

CMD [ "npm", "run", "start", "-w", "server" ]