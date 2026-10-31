/*
 * Old video codecs for Lumovio's in-browser playback of AVI releases (apps/web/src/lib/media/legacy.ts): MPEG-4 Part 2
 * (Xvid, DivX 4/5), Microsoft MPEG-4 v1–v3 (DivX 3), H.263, MPEG-1 and MPEG-2 (DVD rips). A thin bridge over FFmpeg's
 * libavcodec, compiled to WebAssembly by build.sh (LGPL-2.1-or-later; this file is Lumovio's, Apache-2.0).
 *
 * One call decodes one AVI chunk; every picture it gives (none, one, or two for DivX's packed B-frames) is copied as
 * packed I420 into an output buffer, with its time, for the browser's own H.264 encoder (WebCodecs).
 */
#include <emscripten.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "libavcodec/avcodec.h"
#include "libavutil/mem.h"

#define MAX_FRAMES 8

typedef struct {
	AVCodecContext *codec;
	AVPacket *packet;
	AVFrame *frame;
	uint8_t *out;
	size_t out_capacity;
	int count;
	int width;
	int height;
	int64_t pts[MAX_FRAMES];
} Decoder;

static const enum AVCodecID IDS[] = {
	AV_CODEC_ID_MPEG4, AV_CODEC_ID_MSMPEG4V3, AV_CODEC_ID_MSMPEG4V2, AV_CODEC_ID_MSMPEG4V1,
	AV_CODEC_ID_MPEG2VIDEO, AV_CODEC_ID_MPEG1VIDEO, AV_CODEC_ID_H263,
};

/* `tag`: the AVI's FourCC (the decoder works around the bugs of old encoders by it); `extradata`: the codec header. */
EMSCRIPTEN_KEEPALIVE
Decoder *init_decoder(int codec_index, int width, int height, unsigned int tag, const uint8_t *extradata, int extradata_size) {
	if (codec_index < 0 || codec_index >= (int)(sizeof(IDS) / sizeof(IDS[0]))) return NULL;
	const AVCodec *c = avcodec_find_decoder(IDS[codec_index]);
	if (!c) return NULL;
	Decoder *d = calloc(1, sizeof(Decoder));
	if (!d) return NULL;
	d->codec = avcodec_alloc_context3(c);
	d->packet = av_packet_alloc();
	d->frame = av_frame_alloc();
	if (!d->codec || !d->packet || !d->frame) goto fail;
	d->codec->width = width;
	d->codec->height = height;
	d->codec->codec_tag = tag;
	d->codec->thread_count = 1;
	if (extradata_size > 0) {
		d->codec->extradata = av_mallocz(extradata_size + AV_INPUT_BUFFER_PADDING_SIZE);
		if (!d->codec->extradata) goto fail;
		memcpy(d->codec->extradata, extradata, extradata_size);
		d->codec->extradata_size = extradata_size;
	}
	if (avcodec_open2(d->codec, c, NULL) < 0) goto fail;
	return d;
fail:
	av_frame_free(&d->frame);
	av_packet_free(&d->packet);
	avcodec_free_context(&d->codec);
	free(d);
	return NULL;
}

EMSCRIPTEN_KEEPALIVE
uint8_t *input_buffer(Decoder *d, int size) {
	av_packet_unref(d->packet);
	if (av_new_packet(d->packet, size) < 0) return NULL;
	return d->packet->data;
}

/* Copies the frame as packed I420 (4:2:2 and 4:4:4 chroma taken down to 4:2:0) at even dimensions. */
static int keep(Decoder *d) {
	AVFrame *f = d->frame;
	if (d->count >= MAX_FRAMES) return 0;
	int fmt = f->format;
	int cw, ch, vsub, hsub;
	if (fmt == AV_PIX_FMT_YUV420P || fmt == AV_PIX_FMT_YUVJ420P) { hsub = 1; vsub = 1; }
	else if (fmt == AV_PIX_FMT_YUV422P || fmt == AV_PIX_FMT_YUVJ422P) { hsub = 1; vsub = 0; }
	else if (fmt == AV_PIX_FMT_YUV444P || fmt == AV_PIX_FMT_YUVJ444P) { hsub = 0; vsub = 0; }
	else return AVERROR(EINVAL);
	int w = f->width & ~1, h = f->height & ~1;
	if (d->count > 0 && (w != d->width || h != d->height)) return 0;
	d->width = w;
	d->height = h;
	size_t size = (size_t)w * h * 3 / 2;
	size_t need = size * (d->count + 1);
	if (need > d->out_capacity) {
		uint8_t *grown = realloc(d->out, need);
		if (!grown) return AVERROR(ENOMEM);
		d->out = grown;
		d->out_capacity = need;
	}
	uint8_t *dst = d->out + size * d->count;
	for (int y = 0; y < h; y++) memcpy(dst + (size_t)y * w, f->data[0] + (size_t)y * f->linesize[0], w);
	cw = w / 2;
	ch = h / 2;
	for (int p = 1; p <= 2; p++) {
		uint8_t *plane = dst + (size_t)w * h + (size_t)(p - 1) * cw * ch;
		for (int y = 0; y < ch; y++) {
			const uint8_t *row = f->data[p] + (size_t)(vsub ? y : y * 2) * f->linesize[p];
			if (hsub) memcpy(plane + (size_t)y * cw, row, cw);
			else for (int x = 0; x < cw; x++) plane[(size_t)y * cw + x] = row[x * 2];
		}
	}
	d->pts[d->count] = f->best_effort_timestamp != AV_NOPTS_VALUE ? f->best_effort_timestamp : f->pts;
	d->count++;
	return 0;
}

static int drain(Decoder *d) {
	for (;;) {
		int ret = avcodec_receive_frame(d->codec, d->frame);
		if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) return 0;
		if (ret < 0) return ret;
		ret = keep(d);
		av_frame_unref(d->frame);
		if (ret < 0) return ret;
	}
}

/* Decodes the chunk in the input buffer, `pts` in frame numbers; returns how many pictures are in the output buffer. */
EMSCRIPTEN_KEEPALIVE
int decode(Decoder *d, int pts) {
	d->count = 0;
	d->packet->pts = pts;
	d->packet->dts = AV_NOPTS_VALUE;
	int ret = avcodec_send_packet(d->codec, d->packet);
	av_packet_unref(d->packet);
	/* A damaged picture is skipped: the next key frame starts clean. */
	if (ret < 0 && ret != AVERROR_INVALIDDATA) return ret;
	ret = drain(d);
	return ret < 0 ? ret : d->count;
}

/* The pictures still held back for reordering, at the end of a run. */
EMSCRIPTEN_KEEPALIVE
int flush(Decoder *d) {
	d->count = 0;
	avcodec_send_packet(d->codec, NULL);
	int ret = drain(d);
	avcodec_flush_buffers(d->codec);
	return ret < 0 ? ret : d->count;
}

EMSCRIPTEN_KEEPALIVE uint8_t *output(Decoder *d) { return d->out; }
EMSCRIPTEN_KEEPALIVE int output_width(Decoder *d) { return d->width; }
EMSCRIPTEN_KEEPALIVE int output_height(Decoder *d) { return d->height; }
EMSCRIPTEN_KEEPALIVE int output_pts(Decoder *d, int i) { return (int)d->pts[i]; }

EMSCRIPTEN_KEEPALIVE
void close_decoder(Decoder *d) {
	if (!d) return;
	av_frame_free(&d->frame);
	av_packet_free(&d->packet);
	avcodec_free_context(&d->codec);
	free(d->out);
	free(d);
}
