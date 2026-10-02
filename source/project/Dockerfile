FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c

# Linux extraction is intentional: the upstream source contains case-sensitive
# header names and Unix symlinks that Windows ZIP extraction cannot preserve.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates git cmake ninja-build python3 unzip p7zip-full ccache \
    && rm -rf /var/lib/apt/lists/*

# Emscripten 3.1.6 downloads .tar.xz tool bundles. Keep this separate so the
# previously downloaded build tools remain cached after the missing-tool fix.
RUN apt-get update \
    && apt-get install -y --no-install-recommends xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update \
    && apt-get install -y --no-install-recommends bzip2 \
    && rm -rf /var/lib/apt/lists/*

RUN git -c http.lowSpeedLimit=1024 -c http.lowSpeedTime=60 \
        clone --depth 1 --branch 3.1.6 https://github.com/emscripten-core/emsdk.git /opt/emsdk
RUN --mount=type=cache,target=/opt/emsdk/zips \
    /opt/emsdk/emsdk install 3.1.6 \
    && /opt/emsdk/emsdk activate 3.1.6

COPY NewShoes-source.zip /tmp/newshoes-source.zip
RUN echo '91dfb4dc739bd3b36bc893730d1f09eccda82143fbfd34dad6ae41b10739095e  /tmp/newshoes-source.zip' | sha256sum -c - \
    && mkdir -p /opt/newshoes \
    && unzip -q /tmp/newshoes-source.zip -d /tmp/source \
    && cp -a /tmp/source/NewShoes-main/. /opt/newshoes/ \
    && rm -rf /tmp/source /tmp/newshoes-source.zip

WORKDIR /opt/newshoes/WebAssembly
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY overrides/build/package.json overrides/build/package-lock.json ./
RUN npm ci --fetch-retries=1 --fetch-timeout=120000 --no-audit --no-fund

ENV CMAKE_BUILD_PARALLEL_LEVEL=2
RUN bash -c 'source /opt/emsdk/emsdk_env.sh >/dev/null && export PATH=/usr/local/bin:$PATH && npm run build:port:threaded:release'

# Apply project-specific import behavior after the expensive engine build,
# preserving compiler cache reuse when only launcher files change.
COPY overrides/harness/ ./harness/

ENV HOST=0.0.0.0 PORT=8080 HTTPS_PORT=0
EXPOSE 8080
CMD ["npm", "run", "serve:harness"]
