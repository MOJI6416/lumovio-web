/*
 * Audio decoders the browser lacks, for Lumovio's in-browser rebuild (apps/web/src/lib/media/codecs/audio.ts): Dolby
 * TrueHD / MLP always, and MP3, FLAC, Vorbis where WebCodecs has no decoder for them; AC-3 and MP2 for AVI files
 * (legacy.ts drives these itself, outside Mediabunny). A thin bridge over FFmpeg's
 * libavcodec, compiled to WebAssembly by build.sh. libavcodec is LGPL-2.1-or-later; this file is Lumovio's
 * (Apache-2.0) and only calls its public API.
 *
 * One call decodes one container block (Matroska puts whole frames or access units in a block; the decoder takes
 * them one by one) and leaves every decoded sample, interleaved float32, in an output buffer the JavaScript side
 * copies out. For TrueHD, `max_channels` asks for its 2-channel or 5.1 presentation, which it decodes alone (cheaper
 * than 7.1 and a downmix), since the browser's AAC encoder takes at most 5.1.
 */
#include <emscripten.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "libavcodec/avcodec.h"
#include "libavutil/dict.h"
#include "libavutil/mem.h"

typedef struct {
	AVCodecContext *codec;
	AVCodecParserContext *parser;
	AVPacket *packet;
	AVFrame *frame;
	uint8_t *in;
	int in_capacity;
	int in_size;
	float *out;
	int out_capacity; /* floats */
	int out_samples;  /* per channel */
	int channels;
	int sample_rate;
} Decoder;

static const enum AVCodecID IDS[] = { AV_CODEC_ID_TRUEHD, AV_CODEC_ID_MLP, AV_CODEC_ID_MP3, AV_CODEC_ID_FLAC, AV_CODEC_ID_VORBIS, AV_CODEC_ID_AC3, AV_CODEC_ID_MP2 };

/* `extradata`: the container's codec header (FLAC STREAMINFO, Vorbis setup), or none. */
EMSCRIPTEN_KEEPALIVE
Decoder *init_decoder(int codec_index, int max_channels, int channels, int sample_rate, const uint8_t *extradata, int extradata_size) {
	if (codec_index < 0 || codec_index >= (int)(sizeof(IDS) / sizeof(IDS[0]))) return NULL;
	const AVCodec *c = avcodec_find_decoder(IDS[codec_index]);
	if (!c) return NULL;
	Decoder *d = calloc(1, sizeof(Decoder));
	if (!d) return NULL;
	d->codec = avcodec_alloc_context3(c);
	d->packet = av_packet_alloc();
	d->frame = av_frame_alloc();
	if (!d->codec || !d->packet || !d->frame) goto fail;
	if (channels > 0) av_channel_layout_default(&d->codec->ch_layout, channels);
	if (sample_rate > 0) d->codec->sample_rate = sample_rate;
	if (extradata_size > 0) {
		d->codec->extradata = av_mallocz(extradata_size + AV_INPUT_BUFFER_PADDING_SIZE);
		if (!d->codec->extradata) goto fail;
		memcpy(d->codec->extradata, extradata, extradata_size);
		d->codec->extradata_size = extradata_size;
	}
	AVDictionary *opts = NULL;
	if (codec_index <= 1 && max_channels == 2) av_dict_set(&opts, "downmix", "stereo", 0);
	else if (codec_index <= 1 && max_channels == 6) av_dict_set(&opts, "downmix", "5.1(side)", 0);
	int ret = avcodec_open2(d->codec, c, &opts);
	av_dict_free(&opts);
	if (ret < 0) goto fail;
	/* MP3, AC-3 and MP2 from AVI: its chunks cut frames anywhere, so a parser puts the frames back together. */
	if (codec_index == 2 || codec_index == 5 || codec_index == 6) d->parser = av_parser_init(IDS[codec_index]);
	return d;
fail:
	av_frame_free(&d->frame);
	av_packet_free(&d->packet);
	avcodec_free_context(&d->codec);
	free(d);
	return NULL;
}

/* Room for `size` bytes of input; the caller writes the block there, then calls decode(). */
EMSCRIPTEN_KEEPALIVE
uint8_t *input_buffer(Decoder *d, int size) {
	if (size + AV_INPUT_BUFFER_PADDING_SIZE > d->in_capacity) {
		uint8_t *grown = av_realloc(d->in, size + AV_INPUT_BUFFER_PADDING_SIZE);
		if (!grown) return NULL;
		d->in = grown;
		d->in_capacity = size + AV_INPUT_BUFFER_PADDING_SIZE;
	}
	memset(d->in + size, 0, AV_INPUT_BUFFER_PADDING_SIZE);
	d->in_size = size;
	return d->in;
}

static inline float sample_at(const AVFrame *f, int ch, int i, int channels) {
	switch (f->format) {
		case AV_SAMPLE_FMT_S16: return ((const int16_t *)f->data[0])[i * channels + ch] / 32768.0f;
		case AV_SAMPLE_FMT_S32: return ((const int32_t *)f->data[0])[i * channels + ch] / 2147483648.0f;
		case AV_SAMPLE_FMT_FLT: return ((const float *)f->data[0])[i * channels + ch];
		case AV_SAMPLE_FMT_S16P: return ((const int16_t *)f->extended_data[ch])[i] / 32768.0f;
		case AV_SAMPLE_FMT_S32P: return ((const int32_t *)f->extended_data[ch])[i] / 2147483648.0f;
		case AV_SAMPLE_FMT_FLTP: return ((const float *)f->extended_data[ch])[i];
		default: return 0.0f;
	}
}

static int append(Decoder *d) {
	AVFrame *f = d->frame;
	int ch = f->ch_layout.nb_channels;
	/* A change of layout mid-block is rare: the samples before it are returned first, the rest dropped. */
	if (d->out_samples > 0 && (ch != d->channels || f->sample_rate != d->sample_rate)) return 0;
	d->channels = ch;
	d->sample_rate = f->sample_rate;
	int need = (d->out_samples + f->nb_samples) * ch;
	if (need > d->out_capacity) {
		int cap = need * 2;
		float *grown = realloc(d->out, (size_t)cap * sizeof(float));
		if (!grown) return AVERROR(ENOMEM);
		d->out = grown;
		d->out_capacity = cap;
	}
	float *dst = d->out + (size_t)d->out_samples * ch;
	for (int i = 0; i < f->nb_samples; i++)
		for (int c = 0; c < ch; c++) *dst++ = sample_at(f, c, i, ch);
	d->out_samples += f->nb_samples;
	return 0;
}

static int send_and_receive(Decoder *d, const uint8_t *data, int size) {
	av_packet_unref(d->packet);
	if (av_new_packet(d->packet, size) < 0) return AVERROR(ENOMEM);
	memcpy(d->packet->data, data, size);
	int ret = avcodec_send_packet(d->codec, d->packet);
	av_packet_unref(d->packet);
	/* A damaged frame is skipped rather than ending playback: the next one carries its own sync. */
	if (ret < 0 && ret != AVERROR_INVALIDDATA) return ret;
	for (;;) {
		ret = avcodec_receive_frame(d->codec, d->frame);
		if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) return 0;
		if (ret == AVERROR_INVALIDDATA) continue;
		if (ret < 0) return ret;
		ret = append(d);
		av_frame_unref(d->frame);
		if (ret < 0) return ret;
	}
}

/* Decodes the block in the input buffer; returns the samples (per channel) now in the output buffer, or < 0. */
EMSCRIPTEN_KEEPALIVE
int decode(Decoder *d) {
	d->out_samples = 0;
	if (!d->parser) {
		int ret = send_and_receive(d, d->in, d->in_size);
		return ret < 0 ? ret : d->out_samples;
	}
	const uint8_t *in = d->in;
	int left = d->in_size;
	while (left > 0) {
		uint8_t *frame = NULL;
		int frame_size = 0;
		int used = av_parser_parse2(d->parser, d->codec, &frame, &frame_size, in, left, AV_NOPTS_VALUE, AV_NOPTS_VALUE, 0);
		if (used < 0) break;
		in += used;
		left -= used;
		if (frame_size > 0) {
			int ret = send_and_receive(d, frame, frame_size);
			if (ret < 0) return ret;
		}
		if (used == 0 && frame_size == 0) break;
	}
	return d->out_samples;
}

EMSCRIPTEN_KEEPALIVE float *output(Decoder *d) { return d->out; }
EMSCRIPTEN_KEEPALIVE int output_channels(Decoder *d) { return d->channels; }
EMSCRIPTEN_KEEPALIVE int output_rate(Decoder *d) { return d->sample_rate; }

EMSCRIPTEN_KEEPALIVE
void close_decoder(Decoder *d) {
	if (!d) return;
	if (d->parser) av_parser_close(d->parser);
	av_frame_free(&d->frame);
	av_packet_free(&d->packet);
	avcodec_free_context(&d->codec);
	av_free(d->in);
	free(d->out);
	free(d);
}
