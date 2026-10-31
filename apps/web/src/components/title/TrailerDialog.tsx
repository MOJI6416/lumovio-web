"use client";

import type { Video } from "@lumovio/contracts";
import { Dialog } from "@/components/ui/Dialog";

const embed = (v: Video) =>
  v.site === "YouTube"
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.key)}?autoplay=1&rel=0&modestbranding=1`
    : `https://player.vimeo.com/video/${encodeURIComponent(v.key)}?autoplay=1&dnt=1`;

/** The video's own page, for a link that opens it there (a middle click, no script). */
export const videoPage = (v: Video) => (v.site === "YouTube" ? `https://www.youtube.com/watch?v=${encodeURIComponent(v.key)}` : `https://vimeo.com/${encodeURIComponent(v.key)}`);

/**
 * A trailer or another video in a privacy-enhanced embed, loaded only once someone asks for it (ui/Dialog is light;
 * the frame and the player come when it opens).
 */
export function TrailerDialog({ video, title, onClose }: { video: Video | null; title: string; onClose: () => void }) {
  return (
    <Dialog open={video !== null} onOpenChange={(o) => !o && onClose()} title={video?.name ?? title} size="xl">
      {video && (
        // The frame's own black around the video (3.6).
        <div className="aspect-video overflow-hidden rounded-sm bg-black">
          <iframe
            src={embed(video)}
            title={video.name}
            className="size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
    </Dialog>
  );
}
