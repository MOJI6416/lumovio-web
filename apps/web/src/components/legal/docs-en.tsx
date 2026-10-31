import type { ReactNode } from "react";
import { A, H, L, LEGAL_CONTACT, type LegalDoc, P, ScoreMethodology, TmdbMark } from "./parts";
import { RightsNoticeForm } from "./RightsNoticeForm";

/** The legal pages in English — the version that has legal force (design-system 1.3, 8.11; L10N-01). */
export const DOCS_EN: Record<LegalDoc, () => ReactNode> = {
  terms: () => (
    <>
      <P>Lumovio is a free catalog, personal library and media hub. By creating an account you agree to these terms.</P>
      <H>What Lumovio is — and is not</H>
      <P>
        Lumovio shows information about films and series (from TMDB), keeps your lists and history, and lets you play video from servers you connect yourself (Jellyfin, Plex, TorrServer).
        Lumovio does not host, sell or distribute films, and its servers do not relay your video streams.
      </P>
      <H>Your responsibilities</H>
      <L
        items={[
          "You may connect only servers and content you are entitled to use. You are responsible for what you add to your own media servers and torrent clients.",
          "Do not use Lumovio to infringe copyright, harass others, spam, scrape the service, or attack its infrastructure.",
          "Public profiles and public lists must not contain illegal, hateful or misleading content.",
          "Keep your credentials safe. We recommend two-step verification.",
        ]}
      />
      <H>Accounts and profiles</H>
      <P>An account can have several profiles. Kids profiles restrict content by age rating; ratings come from third-party data and may be incomplete, so supervise young children.</P>
      <H>Free service, no guarantees</H>
      <P>Lumovio is provided free of charge, “as is”. Features may change. We may suspend accounts that break these terms. We aim for high availability but do not guarantee it.</P>
      <H>Third-party services</H>
      <P>Metadata comes from TMDB; streaming availability from JustWatch via TMDB; sign-in may use Google, Apple or Discord. Their own terms apply to them.</P>
      <H>Termination</H>
      <P>You can export your data and delete your account at any time in Settings → Privacy &amp; data.</P>
      <H>Contact</H>
      <P>{LEGAL_CONTACT}</P>
    </>
  ),
  privacy: () => (
    <>
      <P>We collect the minimum needed to run Lumovio and never sell personal data. There are no ads and no third-party trackers.</P>
      <H>What we store</H>
      <L
        items={[
          "Account: email address, display name, password hash (or the identifier from Google/Apple/Discord sign-in), two-step verification secret.",
          "Profiles: names, avatars, language and region preferences (audio and subtitle languages, preferred dubbing studios), PIN hashes.",
          "Your library: lists, watchlist, favourites, ratings, watch history and playback positions — per profile.",
          "Recommendations: what a profile tells them (likes, “Not interested” with its reason, “Don't use”, genres and people to leave out, the settings) and, while “Use opened pages” is on, which title pages it stayed on for a few seconds (the title and the day, kept 180 days). Settings → Recommendations shows them and removes one or all; they are in your data export and deleted with the profile.",
          "Media server connections: server address and an access token, encrypted at rest (AES-256-GCM). Video never passes through our servers. A TorrServer you connect may be searched for releases from your own device (you can turn this off per server); our servers never see the searches or the release list. For a title in your watchlist, your device keeps with your profile only the best release's audio language, kind of translation, dubbing studio and picture quality (no links, file hashes or trackers), so your other devices show it too; it is in your data export and is deleted with the profile.",
          "Security data: active sessions with browser user-agent, IP address and the kind of device (the site, the installed app or a TV), rate-limiting counters, an audit log of administrator actions.",
          "Support requests: the topic, your messages and the support’s answers, the e-mail for the answer and — only if you tick “Attach a technical summary” — your browser (user-agent), screen size, language, whether the installed app is open and the player’s last failure in this browser (no server addresses, passwords or titles; until you send it, it stays in your browser only). Answers come by e-mail through Resend; without signing in, the form may be protected by Cloudflare Turnstile. Closed requests are deleted 12 months after closing, an account’s requests together with the account.",
          "Imports: files you upload are parsed and the matched rows stored; you can undo an import.",
          "Anonymous shelf counts: how often cards on a page's shelves are seen and opened, and whether a watchlist add or a play followed — counted per day, page, shelf and position, and whether the visitor was signed in. No account, profile, title, cookie or device storage is involved, and nothing is counted when your browser sends Do Not Track or Global Privacy Control.",
          "Usage counts that keep the service running: how many accounts were active each day, how many of them on a TV and in the installed app, and — for each week of sign-up — how many of those accounts came back in each later week (counted with HyperLogLog sketches, from which nobody can be listed); how many searches reached our server and how many found nothing; the player’s starts and failures by playback method, with the time to the first frame; the server’s request and error counts, also by hour. The words of a search that found nothing are kept only when at least five different people searched them on the same day, and never with Do Not Track or Global Privacy Control; until that’s counted they stay on our server for at most 35 days. Only the totals are kept, for 13 months; no title or browsing history is stored with them.",
          "Trakt or Simkl, if you link one to a profile: the account name and its sign-in (access and refresh tokens, encrypted at rest with AES-256-GCM), what you chose to sync, the service's last-activity timestamps, and a record of what Lumovio already sent there.",
          "Discord, if you connect a channel in Settings → Notifications: the channel's webhook address (encrypted at rest with AES-256-GCM) and its name.",
        ]}
      />
      <H>What is private by default</H>
      <P>Watch history, playback progress, connected servers and personal data are never public. Public profiles show only what you opt into (favourites, chosen lists, ratings).</P>
      <H>Processors</H>
      <L
        items={[
          "Cloudflare — DNS, TLS and request proxying.",
          "Resend — transactional e-mail (verification, password reset, optional notifications).",
          "TMDB — catalog data; requests are made by our server and contain no personal data.",
          "MDBList, OMDb, Wikidata, TVmaze and AniList — scores and cross-links for titles, and episode air times (TVmaze); our server asks by title id only, with no personal data.",
          "fanart.tv — logos and backgrounds: our server asks by title id; your browser then loads the images from fanart.tv's CDN, as it does TMDB's.",
          "MusicBrainz and Wikidata — soundtrack albums, asked by our server by title id; album covers load in your browser from the Cover Art Archive (archive.org).",
          "Spotify — only if you press “Listen on Spotify” on a title page: Spotify's own player then loads from Spotify, under Spotify's terms and privacy policy. Nothing is loaded from Spotify before that.",
          "MDBList — for lists you follow, our server fetches that public list by its address once a day; nothing about you is sent. Stop following in the list's page; its titles stay.",
          "Trakt and Simkl — only for a profile you link in Settings → Trakt & Simkl. Our server reads that account's watch history, ratings and watchlist (as you choose) while you use Lumovio. It writes to the service only what you turn on: plays, ratings and watchlist additions made in Lumovio after that, older ones only when you press “Send existing”, and — with scrobbling on — what you start, pause and finish in Lumovio's player (title, episode, progress). Nothing is ever deleted on the service. Disconnecting (or deleting your account or the profile) asks the service to revoke Lumovio's sign-in and erases it here; what was imported stays until you undo the import.",
          "Discord — only if you connect a channel in Settings → Notifications: our server posts the new episodes of the series you follow there (the series, season and episode, the episode's name). Disconnecting erases its address here.",
          "OpenAI — only when you use AI search: the text of your query (and, if you opt in, titles/genres from your history). Never your e-mail or servers.",
          "Our hosting provider (a virtual server) — runs the service and the database; backups go to encrypted object storage (Cloudflare R2).",
        ]}
      />
      <H>Cookies</H>
      <P>Only essential cookies: your session, chosen language, theme and TV mode. No advertising or analytics cookies.</P>
      <H>Retention</H>
      <P>Data is kept while your account exists. Deleting your account removes all profiles, history and connections; encrypted backups roll over within 30 days.</P>
      <H>Your rights</H>
      <P>You can access, export (JSON), correct and delete your data yourself in Settings. For anything else, write to {LEGAL_CONTACT}.</P>
    </>
  ),
  credits: () => (
    <>
      <H>Data</H>
      <TmdbMark />
      <P>
        This product uses the TMDB API but is not endorsed or certified by TMDB. Film and series metadata, images and people data © their respective owners, provided by{" "}
        <A href="https://www.themoviedb.org">The Movie Database (TMDB)</A>.
      </P>
      <P>
        Some title logos and backgrounds come from <A href="https://fanart.tv">fanart.tv</A>, made by its community; where fanart.tv records a rights holder it is named on the
        title&apos;s Details. Lumovio uses them where TMDB has no logo in your language, or no backdrop.
      </P>
      <P>
        Soundtrack albums come from <A href="https://musicbrainz.org">MusicBrainz</A> (core data CC0) and Wikidata, only when one of them links the album to the title; covers from the{" "}
        <A href="https://coverartarchive.org">Cover Art Archive</A>. The player is Spotify&apos;s official embed.
      </P>
      <P>Lumovio uses Trakt but is not endorsed or certified by Trakt. Linking Simkl uses the Simkl API; Lumovio isn&apos;t affiliated with Simkl.</P>
      <P>
        Streaming availability is provided by <A href="https://www.justwatch.com">JustWatch</A> through TMDB.
      </P>
      <P>
        IMDb scores: Information courtesy of IMDb (<A href="https://www.imdb.com">https://www.imdb.com</A>). Used with permission. They come from IMDb&apos;s ratings dataset, loaded daily
        and shown with its date.
      </P>
      <P>
        Rotten Tomatoes (Tomatometer and Popcornmeter), Metacritic, Letterboxd, Trakt and MyAnimeList scores, and IMDb scores for titles missing from that dataset, come from{" "}
        <A href="https://mdblist.com">MDBList</A> (dated with MDBList&apos;s last update of the title), the <A href="https://www.omdbapi.com">OMDb API</A> (CC BY-NC 4.0) or from dated
        snapshots on <A href="https://www.wikidata.org">Wikidata</A> (CC0), which also supplies cross-links; TV data from <A href="https://www.tvmaze.com">TVmaze</A> (CC BY-SA 4.0); anime
        data from <A href="https://anilist.co">AniList</A>. Each score is shown with its source and links to it. IMDb, Rotten Tomatoes, Metacritic, Letterboxd, Trakt, Kinopoisk,
        MyAnimeList, AniList, TVmaze and TMDB names and logos are trademarks of their owners, used only to identify the source; Lumovio is not affiliated with or endorsed by them.
      </P>
      <P>
        The marks next to your servers name their type: the <A href="https://jellyfin.org">Jellyfin</A> logo is © the Jellyfin contributors under{" "}
        <A href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</A>; <A href="https://www.plex.tv">Plex</A> is a trademark of Plex, Inc.; the{" "}
        <A href="https://github.com/YouROK/TorrServer">TorrServer</A> icon belongs to the TorrServer project. Lumovio is not affiliated with or endorsed by them.
      </P>
      <P>
        The marks of the history import sources name where a file comes from: Trakt, Simkl, IMDb, Letterboxd, Netflix and Stremio are trademarks of their
        owners; the <A href="https://github.com/yumata/lampa">Lampa</A> icon comes from the Lampa project under{" "}
        <A href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL-2.0</A>. Lumovio is not affiliated with or endorsed by them.
      </P>
      <P>
        The marks in the share window name where a link goes: Telegram, WhatsApp, X, Facebook and Reddit are trademarks of their owners, drawn from <A href="https://simpleicons.org">Simple Icons</A> (CC0). Lumovio is not affiliated with or endorsed by them.
      </P>
      <P>
        The Lumovio Score is Lumovio&apos;s own derived score, calculated from the IMDb, TMDB, Rotten Tomatoes, Metacritic, Letterboxd, Trakt and MyAnimeList scores above (TVmaze and
        AniList are not part of it). None of these services publishes or endorses it; how it works is below.
      </P>
      <ScoreMethodology locale="en" />
      <H>Open-source software</H>
      <L
        items={[
          "Video.js 10 (Apache-2.0)",
          "Next.js, React (MIT)",
          "Fastify, Drizzle ORM, BullMQ (MIT)",
          "Better Auth (MIT)",
          "hls.js (Apache-2.0)",
          "Mediabunny (MPL-2.0) with FFmpeg's AC-3/E-AC-3 and DTS decoders and AAC encoder (LGPL-2.1 or later; source at ffmpeg.org): in your browser, it rebuilds files the browser can't open itself",
          <>
            FFmpeg (LGPL-2.1 or later): the audio (Dolby TrueHD, MP3, FLAC, Vorbis, AC-3, MP2) and video (MPEG-4 Part 2 — Xvid and DivX, MPEG-1/2, H.263) decoders of Lumovio&apos;s player are built to WebAssembly from version 8.0.3 without GPL parts —{" "}
            <A href="https://github.com/FFmpeg/FFmpeg/tree/n8.0.3">source of that version</A>; the build script is scripts/player-codecs in Lumovio&apos;s source, and /codecs/audio.*
            and /codecs/video.* can be replaced with your own build
          </>,
          <>
            <A href="https://github.com/ThaUnknown/jassub">JASSUB</A> (MIT) with libass (ISC), FreeType (FTL), HarfBuzz (MIT) and FriBidi (LGPL-2.1 or later;{" "}
            <A href="https://github.com/fribidi/fribidi">source</A>) — ASS/SSA subtitles with their styling; Liberation Sans font (SIL OFL 1.1)
          </>,
          "Stream preparation on Lumovio's server (when it is turned on): FFmpeg with x264 (GPL-2.0 or later) in an Alpine Linux image",
          "Radix UI, Lucide (MIT / ISC)",
          "Manrope font (SIL OFL 1.1)",
        ]}
      />
      <P>The Lumovio web client is open source under the Apache License 2.0.</P>
    </>
  ),
  copyright: () => (
    <>
      <P>
        Lumovio does not host films or series. Playback comes from servers that users connect themselves. If you believe content made available through Lumovio (for example in a public list or
        a public profile) infringes your rights, send a notice below. We review every notice and respond.
      </P>
      <RightsNoticeForm />
    </>
  ),
};
