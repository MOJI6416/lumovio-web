#!/usr/bin/env bash
# Builds the player's WebAssembly decoders from FFmpeg (LGPL-2.1-or-later; no GPL parts, no --enable-gpl) into
# apps/web/public/codecs/. Run from the repo root (Docker; nothing installed on the machine):
#
#   MSYS_NO_PATHCONV=1 docker run --rm -v lumovio-codecs-build:/build -v "$PWD/scripts/player-codecs:/work:ro" \
#     -v "$PWD/apps/web/public/codecs:/out" emscripten/emsdk:4.0.15 bash /work/build.sh audio
#
# Targets: audio — Dolby TrueHD / MLP, MP3, FLAC, Vorbis, AC-3, MP2 decoders (audio.c); video — MPEG-4 Part 2,
# MS-MPEG-4 v1–3, MPEG-1/2, H.263 (video.c), for AVI. The FFmpeg version is pinned below; the exact sources are
# https://github.com/FFmpeg/FFmpeg/tree/$FFMPEG_TAG (the "Acknowledgements" page links them, as the LGPL asks).
set -euo pipefail
FFMPEG_TAG=n8.0.3
TARGET=${1:?target: audio or video}
SRC=/build/ffmpeg-$FFMPEG_TAG
[ -d "$SRC" ] || git clone --quiet --depth 1 --branch "$FFMPEG_TAG" https://github.com/FFmpeg/FFmpeg.git "$SRC"

case "$TARGET" in
  audio) ENABLE=(--enable-decoder=truehd --enable-decoder=mlp --enable-decoder=mp3float --enable-decoder=flac --enable-decoder=vorbis --enable-decoder=ac3 --enable-decoder=mp2float --enable-parser=mpegaudio --enable-parser=ac3) ;;
  video) ENABLE=(--enable-decoder=mpeg4 --enable-decoder=msmpeg4v1 --enable-decoder=msmpeg4v2 --enable-decoder=msmpeg4v3 --enable-decoder=mpeg2video --enable-decoder=mpeg1video --enable-decoder=h263) ;;
  *) echo "unknown target $TARGET" >&2; exit 1 ;;
esac

LIB=/build/lib-$TARGET
rm -rf "$LIB" && mkdir -p "$LIB" && cd "$LIB"
emconfigure "$SRC/configure" \
  --target-os=none --arch=x86_32 --enable-cross-compile \
  --disable-asm --disable-x86asm --disable-inline-asm --disable-programs --disable-doc --disable-debug \
  --disable-everything --disable-autodetect --disable-pthreads --disable-runtime-cpudetect --disable-network \
  --disable-avdevice --disable-avformat --disable-swresample --disable-swscale --disable-avfilter \
  --enable-avcodec "${ENABLE[@]}" \
  --cc=emcc --cxx=em++ --ar=emar --ranlib=emranlib --nm=emnm \
  --extra-cflags="-DNDEBUG -O2 -flto -msimd128" --extra-ldflags="-O2 -flto" > configure.log
emmake make -j"$(nproc)" > make.log

# A classic script for a worker (importScripts) and its .wasm next to it.
emcc "/work/$TARGET.c" "$LIB/libavcodec/libavcodec.a" "$LIB/libavutil/libavutil.a" -I"$LIB" -I"$SRC" \
  -s MODULARIZE=1 -s EXPORT_NAME="create_$TARGET" -s ENVIRONMENT=worker,node -s FILESYSTEM=0 -s MALLOC=emmalloc \
  -s ALLOW_MEMORY_GROWTH=1 -s SUPPORT_LONGJMP=0 -s EXPORTED_RUNTIME_METHODS=cwrap,HEAPU8,HEAPF32 -s INITIAL_MEMORY=33554432 \
  -s EXPORTED_FUNCTIONS=_malloc,_free -msimd128 -flto -O2 -o "/out/$TARGET.js"
ls -l "/out/$TARGET.js" "/out/$TARGET.wasm"
