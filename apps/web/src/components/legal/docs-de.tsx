import type { ReactNode } from "react";
import { A, H, L, LEGAL_CONTACT, type LegalDoc, P, ScoreMethodology, TmdbMark } from "./parts";
import { RightsNoticeForm } from "./RightsNoticeForm";

/**
 * The legal pages in German — a translation: the English version has legal force, and the
 * page says so with a link to it. "du" as everywhere in the German interface; names of services, licences
 * and IMDb's required attribution stay as they are.
 */
export const DOCS_DE: Record<LegalDoc, () => ReactNode> = {
  terms: () => (
    <>
      <P>Lumovio ist ein kostenloser Katalog, eine persönliche Mediathek und ein Medien-Hub. Mit der Erstellung eines Kontos stimmst du diesen Bedingungen zu.</P>
      <H>Was Lumovio ist – und was nicht</H>
      <P>
        Lumovio zeigt Informationen zu Filmen und Serien (von TMDB), speichert deine Listen und deinen Verlauf und ermöglicht dir, Videos von Servern abzuspielen, die du selbst
        verbindest (Jellyfin, Plex, TorrServer). Lumovio hostet, verkauft und verbreitet keine Filme, und seine Server leiten deine Videostreams nicht weiter.
      </P>
      <H>Deine Pflichten</H>
      <L
        items={[
          "Du darfst nur Server und Inhalte verbinden, zu deren Nutzung du berechtigt bist. Für das, was du deinen eigenen Servern und Torrent-Clients hinzufügst, bist du selbst verantwortlich.",
          "Nutze Lumovio nicht, um Urheberrechte zu verletzen, andere zu belästigen, Spam zu versenden, Daten des Dienstes automatisiert abzugreifen (Scraping) oder seine Infrastruktur anzugreifen.",
          "Öffentliche Profile und öffentliche Listen dürfen keine rechtswidrigen, hasserfüllten oder irreführenden Inhalte enthalten.",
          "Bewahre deine Zugangsdaten sicher auf. Wir empfehlen die Bestätigung in zwei Schritten.",
        ]}
      />
      <H>Konten und Profile</H>
      <P>
        Ein Konto kann mehrere Profile haben. Kinderprofile beschränken Inhalte nach Altersfreigabe; die Altersfreigaben stammen aus Daten Dritter und können unvollständig sein,
        beaufsichtige daher kleine Kinder.
      </P>
      <H>Kostenloser Dienst ohne Gewähr</H>
      <P>
        Lumovio wird kostenlos und „wie besehen“ bereitgestellt. Funktionen können sich ändern. Wir können Konten sperren, die gegen diese Bedingungen verstoßen. Wir streben eine hohe
        Verfügbarkeit an, garantieren sie aber nicht.
      </P>
      <H>Dienste Dritter</H>
      <P>
        Metadaten stammen von TMDB, Angaben zur Streaming-Verfügbarkeit von JustWatch über TMDB; für die Anmeldung können Google, Apple oder Discord genutzt werden. Für diese Dienste
        gelten deren eigene Bedingungen.
      </P>
      <H>Beendigung</H>
      <P>Du kannst jederzeit unter Einstellungen → Datenschutz &amp; Daten deine Daten exportieren und dein Konto löschen.</P>
      <H>Kontakt</H>
      <P>{LEGAL_CONTACT}</P>
    </>
  ),
  privacy: () => (
    <>
      <P>
        Wir erheben nur das Minimum an Daten, das für den Betrieb von Lumovio nötig ist, und verkaufen niemals personenbezogene Daten. Es gibt keine Werbung und keine Tracker von
        Drittanbietern.
      </P>
      <H>Was wir speichern</H>
      <L
        items={[
          "Konto: E-Mail-Adresse, Anzeigename, Passwort-Hash (oder die Kennung aus der Anmeldung über Google/Apple/Discord), Geheimschlüssel für die Bestätigung in zwei Schritten.",
          "Profile: Namen, Avatare, Sprach- und Regionseinstellungen (Sprachen für Tonspuren und Untertitel, bevorzugte Synchronstudios), PIN-Hashes.",
          "Deine Mediathek: Listen, Merkliste, Favoriten, Bewertungen, Wiedergabeverlauf und Wiedergabepositionen – jeweils pro Profil.",
          "Empfehlungen: was ein Profil ihnen mitteilt („Gefällt mir“-Angaben, „Kein Interesse“ mit Begründung, „Nicht berücksichtigen“, auszuschließende Genres und Personen, die Einstellungen) und, solange „Geöffnete Seiten nutzen“ eingeschaltet ist, auf welchen Titelseiten es einige Sekunden geblieben ist (Titel und Tag, 180 Tage lang gespeichert). Unter Einstellungen → Empfehlungen werden sie angezeigt und lassen sich einzeln oder alle auf einmal entfernen; sie sind in deinem Datenexport enthalten und werden mit dem Profil gelöscht.",
          "Verbindungen zu Servern: Serveradresse und ein Zugriffstoken, verschlüsselt gespeichert (AES-256-GCM). Videos laufen nie über unsere Server. Ein TorrServer, den du verbindest, kann von deinem eigenen Gerät aus nach Releases durchsucht werden (das kannst du pro Server ausschalten); unsere Server sehen weder die Suchanfragen noch die Liste der Releases. Für einen Titel auf deiner Merkliste speichert dein Gerät in deinem Profil nur die Sprache der Tonspur, die Art der Synchronisation, das Synchronstudio und die Bildqualität des besten Releases (keine Links, Datei-Hashes oder Tracker), damit auch deine anderen Geräte sie anzeigen; diese Angaben sind in deinem Datenexport enthalten und werden mit dem Profil gelöscht.",
          "Sicherheitsdaten: aktive Sitzungen mit dem User-Agent des Browsers, der IP-Adresse und der Art des Geräts (Website, installierte App oder TV), Zähler zur Begrenzung der Anfragerate, ein Audit-Protokoll der Aktionen von Administratoren.",
          "Support-Anfragen: das Thema, deine Nachrichten und die Antworten des Supports, die E-Mail-Adresse für die Antwort und – nur wenn du „Technische Zusammenfassung anhängen“ ankreuzt – dein Browser (User-Agent), die Bildschirmgröße, die Sprache, ob die installierte App geöffnet ist, und der letzte Fehler des Players in diesem Browser (ohne Serveradressen, Passwörter und Titel; bis zum Senden bleibt er nur in deinem Browser). Antworten kommen per E-Mail über Resend; ohne Anmeldung kann das Formular durch Cloudflare Turnstile geschützt sein. Geschlossene Anfragen werden 12 Monate nach dem Schließen gelöscht, die Anfragen eines Kontos zusammen mit dem Konto.",
          "Importe: Dateien, die du hochlädst, werden ausgewertet und die zugeordneten Zeilen gespeichert; einen Import kannst du rückgängig machen.",
          "Anonyme Zählungen der Reihen: wie oft Karten in den Reihen einer Seite gesehen und geöffnet werden und ob darauf ein Hinzufügen zur Merkliste oder eine Wiedergabe folgte – gezählt pro Tag, Seite, Reihe und Position sowie danach, ob die besuchende Person angemeldet war. Konto, Profil, Titel, Cookies und Gerätespeicher werden dabei nicht einbezogen, und es wird nichts gezählt, wenn dein Browser Do Not Track oder Global Privacy Control sendet.",
          "Nutzungszahlen für den Betrieb des Dienstes: wie viele Konten an einem Tag aktiv waren, wie viele davon auf einem TV und in der installierten App, und – für jede Woche der Registrierung – wie viele dieser Konten in jeder späteren Woche wiederkamen (gezählt mit HyperLogLog-Sketches, aus denen sich niemand auflisten lässt); wie viele Suchen unseren Server erreichten und wie viele nichts fanden; Starts und Fehler des Players nach Wiedergabeart, mit der Zeit bis zum ersten Bild; die Zahl der Anfragen und Fehler des Servers, auch pro Stunde. Die Wörter einer Suche, die nichts fand, werden nur gespeichert, wenn mindestens fünf verschiedene Personen am selben Tag danach gesucht haben, und nie bei Do Not Track oder Global Privacy Control; bis dahin bleiben sie höchstens 35 Tage auf unserem Server. Gespeichert werden nur Summen, 13 Monate lang; weder Titel noch der Verlauf sind damit verknüpft.",
          "Seitengeschwindigkeit: wie schnell eine Seite ihren Hauptinhalt zeigte, wie schnell sie auf ein Tippen oder eine Taste reagierte und wie sehr sie sich beim Laden verschob (LCP, INP, CLS) – pro Tag, Seitenart (Startseite, Titelseite, Suche …) und Geräteart (Computer, Handy, TV), ohne dein Konto, ein Cookie oder deine Adresse. Mit Do Not Track oder Global Privacy Control wird nichts gesendet. Als Tagessummen 13 Monate gespeichert.",
          "Bilder, die du für die Seite eines Titels wählst (Hintergrund und Logo, pro Profil), und – nur wenn du ihn hinzufügst – dein eigener fanart.tv-Schlüssel, verschlüsselt gespeichert (AES-256-GCM); damit fragt unser Server fanart.tv nach den Bildern des Titels, wenn du die Auswahl öffnest.",
          "Trakt oder Simkl, wenn du einen der beiden Dienste mit einem Profil verknüpfst: der Kontoname und die Anmeldung dort (Zugriffs- und Aktualisierungstokens, verschlüsselt gespeichert mit AES-256-GCM), was du zur Synchronisierung ausgewählt hast, die Zeitstempel der letzten Aktivität beim Dienst und eine Aufzeichnung dessen, was Lumovio bereits dorthin gesendet hat.",
          "Discord, wenn du in Einstellungen → Benachrichtigungen einen Kanal verbindest: die Webhook-URL des Kanals (mit AES-256-GCM verschlüsselt gespeichert) und ihr Name.",
        ]}
      />
      <H>Was standardmäßig privat ist</H>
      <P>
        Wiedergabeverlauf, Wiedergabefortschritt, verbundene Server und personenbezogene Daten sind nie öffentlich. Öffentliche Profile zeigen nur, was du selbst freigibst (Favoriten,
        ausgewählte Listen, Bewertungen).
      </P>
      <H>Auftragsverarbeiter</H>
      <L
        items={[
          "Cloudflare – DNS, TLS und Weiterleitung von Anfragen (Proxy).",
          "Resend – Transaktions-E-Mails (Verifizierung, Zurücksetzen des Passworts, optionale Benachrichtigungen).",
          "TMDB – Katalogdaten; die Anfragen stellt unser Server, sie enthalten keine personenbezogenen Daten.",
          "MDBList, OMDb, Wikidata, TVmaze und AniList – Bewertungen und Querverweise zu Titeln sowie Ausstrahlungszeiten von Folgen (TVmaze); unser Server fragt nur anhand der Titel-ID an, ohne personenbezogene Daten.",
          "fanart.tv – Logos und Hintergründe: Unser Server fragt anhand der Titel-ID an; dein Browser lädt die Bilder dann aus dem CDN von fanart.tv, so wie bei TMDB.",
          "MusicBrainz und Wikidata – Soundtrack-Alben, die unser Server anhand der Titel-ID abfragt; Albumcover lädt dein Browser aus dem Cover Art Archive (archive.org).",
          "Spotify – nur wenn du auf einer Titelseite „Auf Spotify anhören“ wählst: Dann wird der eigene Player von Spotify von Spotify geladen; es gelten die Nutzungsbedingungen und die Datenschutzerklärung von Spotify. Vorher wird nichts von Spotify geladen.",
          "MDBList – für Listen, denen du folgst, ruft unser Server diese öffentliche Liste einmal täglich über ihre Adresse ab; dabei wird nichts über dich übermittelt. Auf der Seite der Liste kannst du ihr nicht mehr folgen; ihre Titel bleiben erhalten.",
          "Trakt und Simkl – nur für ein Profil, das du unter Einstellungen → Trakt & Simkl verknüpfst. Während du Lumovio nutzt, liest unser Server Wiedergabeverlauf, Bewertungen und Merkliste dieses Kontos (je nach deiner Auswahl). An den Dienst überträgt er nur, was du einschaltest: Wiedergaben, Bewertungen und Hinzufügungen zur Merkliste, die danach in Lumovio erfolgen, ältere nur, wenn du „Vorhandenes senden…“ wählst, und – bei eingeschaltetem Scrobbling – was du im Lumovio-Player startest, pausierst und beendest (Titel, Folge, Fortschritt). Beim Dienst wird nie etwas gelöscht. Wenn du die Verbindung trennst (oder dein Konto oder das Profil löschst), wird der Dienst gebeten, die Anmeldung von Lumovio zu widerrufen, und sie wird bei uns gelöscht; Importiertes bleibt erhalten, bis du den Import rückgängig machst.",
          "Discord – nur wenn du in Einstellungen → Benachrichtigungen einen Kanal verbindest: Unser Server postet dort neue Folgen der Serien, denen du folgst (Serie, Staffel und Folge, Titel der Folge). Beim Trennen wird die Adresse hier gelöscht.",
          "OpenAI – nur wenn du die KI-Suche nutzt: der Text deiner Suchanfrage (und, wenn du zustimmst, Titel/Genres aus deinem Verlauf). Nie deine E-Mail-Adresse oder deine Server.",
          "Unser Hosting-Anbieter (ein virtueller Server) – betreibt den Dienst und die Datenbank; Backups werden in verschlüsseltem Objektspeicher abgelegt (Cloudflare R2).",
        ]}
      />
      <H>Cookies</H>
      <P>Nur unbedingt erforderliche Cookies: deine Sitzung, die gewählte Sprache, das Design und der TV-Modus. Keine Werbe- oder Analyse-Cookies.</P>
      <H>Speicherdauer</H>
      <P>
        Daten werden gespeichert, solange dein Konto besteht. Das Löschen deines Kontos entfernt alle Profile, den Verlauf und die Verbindungen; verschlüsselte Backups werden innerhalb
        von 30 Tagen durch neue ersetzt.
      </P>
      <H>Deine Rechte</H>
      <P>In den Einstellungen kannst du deine Daten selbst einsehen, exportieren (JSON), berichtigen und löschen. Für alles Weitere schreib an {LEGAL_CONTACT}.</P>
    </>
  ),
  credits: () => (
    <>
      <H>Daten</H>
      <TmdbMark />
      <P>
        Dieses Produkt verwendet die TMDB-API, ist aber weder von TMDB befürwortet noch zertifiziert. Metadaten, Bilder und Personendaten zu Filmen und Serien © der jeweiligen
        Rechteinhaber, bereitgestellt von <A href="https://www.themoviedb.org">The Movie Database (TMDB)</A>.
      </P>
      <P>
        Einige Titellogos und Hintergründe stammen von <A href="https://fanart.tv">fanart.tv</A> und wurden von dessen Community erstellt; wenn fanart.tv einen Rechteinhaber angibt,
        wird er unter „Details“ des Titels genannt. Lumovio verwendet sie, wenn TMDB kein Logo in deiner Sprache oder kein Hintergrundbild hat.
      </P>
      <P>
        Soundtrack-Alben stammen von <A href="https://musicbrainz.org">MusicBrainz</A> (Kerndaten CC0) und Wikidata, und zwar nur, wenn einer der beiden das Album mit dem Titel
        verknüpft; die Cover stammen aus dem <A href="https://coverartarchive.org">Cover Art Archive</A>. Der Player ist der offizielle eingebettete Player von Spotify.
      </P>
      <P>Lumovio nutzt Trakt, ist aber weder von Trakt befürwortet noch zertifiziert. Die Verknüpfung mit Simkl nutzt die Simkl-API; Lumovio steht in keiner Verbindung zu Simkl.</P>
      <P>
        Angaben zur Streaming-Verfügbarkeit stellt <A href="https://www.justwatch.com">JustWatch</A> über TMDB bereit.
      </P>
      <P>
        IMDb-Bewertungen:{" "}
        <span lang="en">
          Information courtesy of IMDb (<A href="https://www.imdb.com">https://www.imdb.com</A>). Used with permission.
        </span>{" "}
        Diese Bewertungen stammen aus dem Bewertungsdatensatz von IMDb, der täglich geladen wird, und werden mit dessen Datum angezeigt.
      </P>
      <P>
        Bewertungen von Rotten Tomatoes (Tomatometer und Popcornmeter), Metacritic, Letterboxd, Trakt und MyAnimeList sowie IMDb-Bewertungen für Titel, die in diesem Datensatz
        fehlen, stammen von <A href="https://mdblist.com">MDBList</A> (datiert mit der letzten Aktualisierung des Titels bei MDBList), der{" "}
        <A href="https://www.omdbapi.com">OMDb API</A> (CC BY-NC 4.0) oder aus datierten Snapshots auf <A href="https://www.wikidata.org">Wikidata</A> (CC0), woher auch die
        Querverweise stammen; Seriendaten von <A href="https://www.tvmaze.com">TVmaze</A> (CC BY-SA 4.0); Anime-Daten von <A href="https://anilist.co">AniList</A>. Jede Bewertung wird
        mit ihrer Quelle angezeigt und verlinkt darauf. Namen und Logos von IMDb, Rotten Tomatoes, Metacritic, Letterboxd, Trakt, Kinopoisk, MyAnimeList, AniList, TVmaze und TMDB
        sind Marken ihrer jeweiligen Inhaber und werden nur zur Kennzeichnung der Quelle verwendet; Lumovio ist mit ihnen nicht verbunden und wird von ihnen nicht befürwortet.
      </P>
      <P>
        Die Symbole neben deinen Servern geben deren Typ an: Das Logo von <A href="https://jellyfin.org">Jellyfin</A> ist © der Jellyfin-Mitwirkenden und steht unter{" "}
        <A href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</A>; <A href="https://www.plex.tv">Plex</A> ist eine Marke von Plex, Inc.; das Symbol von{" "}
        <A href="https://github.com/YouROK/TorrServer">TorrServer</A> gehört dem TorrServer-Projekt. Lumovio ist mit ihnen nicht verbunden und wird von ihnen nicht befürwortet.
      </P>
      <P>
        Die Symbole der Importquellen für den Verlauf geben an, woher eine Datei stammt: Trakt, Simkl, IMDb, Letterboxd, Netflix und Stremio sind Marken ihrer jeweiligen Inhaber; das
        Symbol von <A href="https://github.com/yumata/lampa">Lampa</A> stammt aus dem Lampa-Projekt und steht unter{" "}
        <A href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL-2.0</A>. Lumovio ist mit ihnen nicht verbunden und wird von ihnen nicht befürwortet.
      </P>
      <P>
        Die Zeichen im Teilen-Fenster nennen, wohin ein Link geht: Telegram, WhatsApp, X, Facebook und Reddit sind Marken ihrer Inhaber, gezeichnet nach <A href="https://simpleicons.org">Simple Icons</A> (CC0). Lumovio ist mit ihnen nicht verbunden und wird nicht von ihnen unterstützt.
      </P>
      <P>
        Der Lumovio Score ist ein eigener, abgeleiteter Wert von Lumovio, berechnet aus den oben genannten Bewertungen von IMDb, TMDB, Rotten Tomatoes, Metacritic, Letterboxd, Trakt
        und MyAnimeList (TVmaze und AniList fließen nicht ein). Keiner dieser Dienste veröffentlicht oder befürwortet ihn; wie er funktioniert, steht unten.
      </P>
      <ScoreMethodology locale="de" />
      <H>Open-Source-Software</H>
      <L
        items={[
          "Video.js 10 (Apache-2.0)",
          "Next.js, React (MIT)",
          "Fastify, Drizzle ORM, BullMQ (MIT)",
          "Better Auth (MIT)",
          "hls.js (Apache-2.0)",
          "Mediabunny (MPL-2.0) mit den AC-3/E-AC-3- und DTS-Decodern und dem AAC-Encoder von FFmpeg (LGPL-2.1 oder neuer; Quellcode auf ffmpeg.org): In deinem Browser verpackt es Dateien neu, die der Browser selbst nicht öffnen kann",
          <>
            FFmpeg (LGPL-2.1 oder neuer): Die Audio-Decoder (Dolby TrueHD, MP3, FLAC, Vorbis, AC-3, MP2) und Video-Decoder (MPEG-4 Part 2 – Xvid und DivX, MPEG-1/2, H.263) des Lumovio-Players werden aus Version 8.0.3 ohne GPL-Bestandteile zu WebAssembly kompiliert –{" "}
            <A href="https://github.com/FFmpeg/FFmpeg/tree/n8.0.3">Quellcode dieser Version</A>; das Build-Skript ist scripts/player-codecs im Lumovio-Quellcode, und /codecs/audio.*
            und /codecs/video.* lassen sich durch einen eigenen Build ersetzen
          </>,
          <>
            <A href="https://github.com/ThaUnknown/jassub">JASSUB</A> (MIT) mit libass (ISC), FreeType (FTL), HarfBuzz (MIT) und FriBidi (LGPL-2.1 oder neuer;{" "}
            <A href="https://github.com/fribidi/fribidi">Quellcode</A>) – ASS/SSA-Untertitel mit ihrer Formatierung; Schriftart Liberation Sans (SIL OFL 1.1)
          </>,
          "Stream-Vorbereitung auf dem Lumovio-Server (wenn sie eingeschaltet ist): FFmpeg mit x264 (GPL-2.0 oder neuer) in einem Alpine-Linux-Image",
          "Radix UI, Lucide (MIT / ISC)",
          "Schriftart Onest (SIL OFL 1.1)",
        ]}
      />
      <P>Der Lumovio-Webclient ist Open Source unter der Apache License 2.0.</P>
    </>
  ),
  copyright: () => (
    <>
      <P>
        Lumovio hostet keine Filme oder Serien. Die Wiedergabe erfolgt von Servern, die Nutzer selbst verbinden. Wenn du der Ansicht bist, dass über Lumovio zugänglich gemachte
        Inhalte (zum Beispiel in einer öffentlichen Liste oder einem öffentlichen Profil) deine Rechte verletzen, sende unten eine Meldung. Wir prüfen jede Meldung und antworten
        darauf.
      </P>
      <RightsNoticeForm />
    </>
  ),
};
