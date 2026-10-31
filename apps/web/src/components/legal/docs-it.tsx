import type { ReactNode } from "react";
import { A, H, L, LEGAL_CONTACT, type LegalDoc, P, ScoreMethodology, TmdbMark } from "./parts";
import { RightsNoticeForm } from "./RightsNoticeForm";

/**
 * The legal pages in Italian — a translation (owner's decision 1.3, L10N-01): the English version has legal force, and the
 * page says so with a link to it. "tu" as everywhere in the Italian interface (glossary-it.md); names of services, licences
 * and IMDb's required attribution stay as they are.
 */
export const DOCS_IT: Record<LegalDoc, () => ReactNode> = {
  terms: () => (
    <>
      <P>Lumovio è un catalogo gratuito, una libreria personale e un hub multimediale. Creando un account accetti questi termini.</P>
      <H>Cos’è Lumovio – e cosa non è</H>
      <P>
        Lumovio mostra informazioni su film e serie (da TMDB), conserva le tue liste e la tua cronologia e ti permette di riprodurre video dai server che colleghi tu stesso (Jellyfin,
        Plex, TorrServer). Lumovio non ospita, non vende e non distribuisce film, e i suoi server non inoltrano i tuoi flussi video.
      </P>
      <H>Le tue responsabilità</H>
      <L
        items={[
          "Puoi collegare solo server e contenuti che hai il diritto di usare. Sei responsabile di ciò che aggiungi ai tuoi server multimediali e ai tuoi client torrent.",
          "Non usare Lumovio per violare il diritto d’autore, molestare altre persone, inviare spam, estrarre automaticamente i dati del servizio (scraping) o attaccarne l’infrastruttura.",
          "I profili pubblici e le liste pubbliche non devono contenere contenuti illegali, d’odio o ingannevoli.",
          "Custodisci con cura le tue credenziali. Ti consigliamo la verifica in due passaggi.",
        ]}
      />
      <H>Account e profili</H>
      <P>
        Un account può avere più profili. I profili bambini limitano i contenuti in base alla classificazione per età; le classificazioni provengono da dati di terzi e possono essere
        incomplete, quindi sorveglia i bambini piccoli.
      </P>
      <H>Servizio gratuito, senza garanzie</H>
      <P>
        Lumovio è fornito gratuitamente, «così com’è». Le funzioni possono cambiare. Possiamo sospendere gli account che violano questi termini. Puntiamo a un’alta disponibilità, ma non la
        garantiamo.
      </P>
      <H>Servizi di terzi</H>
      <P>
        I metadati provengono da TMDB, la disponibilità in streaming da JustWatch tramite TMDB; per l’accesso si possono usare Google, Apple o Discord. A questi servizi si applicano i
        loro termini.
      </P>
      <H>Chiusura dell’account</H>
      <P>Puoi esportare i tuoi dati ed eliminare il tuo account in qualsiasi momento in Impostazioni → Privacy e dati.</P>
      <H>Contatti</H>
      <P>{LEGAL_CONTACT}</P>
    </>
  ),
  privacy: () => (
    <>
      <P>Raccogliamo il minimo necessario per far funzionare Lumovio e non vendiamo mai dati personali. Non ci sono pubblicità né tracker di terzi.</P>
      <H>Cosa conserviamo</H>
      <L
        items={[
          "Account: indirizzo email, nome visualizzato, hash della password (o l’identificativo dell’accesso con Google/Apple/Discord), segreto della verifica in due passaggi.",
          "Profili: nomi, avatar, preferenze di lingua e regione (lingue dell’audio e dei sottotitoli, studi di doppiaggio preferiti), hash dei PIN.",
          "La tua libreria: liste, Da guardare, preferiti, voti, cronologia e punti di riproduzione – per profilo.",
          "Consigli: ciò che un profilo indica loro (Mi piace, «Non mi interessa» con il suo motivo, «Non considerare», generi e persone da escludere, le impostazioni) e, finché «Usa le pagine aperte» è attivo, su quali pagine di titoli si è fermato per qualche secondo (il titolo e il giorno, conservati 180 giorni). Impostazioni → Consigli li mostra e ne rimuove uno o tutti; sono nella tua esportazione dei dati e vengono eliminati con il profilo.",
          "Connessioni ai server multimediali: indirizzo del server e un token d’accesso, cifrati a riposo (AES-256-GCM). I video non passano mai dai nostri server. Un TorrServer che colleghi può essere interrogato per cercare release dal tuo dispositivo (puoi disattivarlo per ogni server); i nostri server non vedono mai le ricerche né l’elenco delle release. Per un titolo nella tua lista Da guardare, il tuo dispositivo conserva con il tuo profilo solo la lingua dell’audio, il tipo di traduzione, lo studio di doppiaggio e la qualità d’immagine della release migliore (nessun link, hash di file o tracker), così che lo mostrino anche i tuoi altri dispositivi; è nella tua esportazione dei dati e viene eliminato con il profilo.",
          "Dati di sicurezza: sessioni attive con user-agent del browser, indirizzo IP e tipo di dispositivo (il sito, l’app installata o una TV), contatori di limitazione delle richieste, un registro delle azioni degli amministratori.",
          "Richieste al supporto: l’argomento, i tuoi messaggi e le risposte del supporto, l’email per la risposta e — solo se spunti «Allega un riepilogo tecnico» — il tuo browser (user-agent), le dimensioni dello schermo, la lingua, se l’app installata è aperta e l’ultimo errore del player in questo browser (senza indirizzi dei server, password o titoli; finché non lo invii, resta solo nel tuo browser). Le risposte arrivano via email tramite Resend; senza accesso, il modulo può essere protetto da Cloudflare Turnstile. Le richieste chiuse vengono eliminate 12 mesi dopo la chiusura, quelle di un account insieme all’account.",
          "Importazioni: i file che carichi vengono analizzati e le righe abbinate vengono salvate; puoi annullare un’importazione.",
          "Conteggi anonimi delle file: quante volte le schede nelle file di una pagina vengono viste e aperte, e se ne è seguita un’aggiunta a Da guardare o una riproduzione – conteggiati per giorno, pagina, fila e posizione, e in base al fatto che il visitatore avesse effettuato l’accesso. Non sono coinvolti account, profili, titoli, cookie o memoria del dispositivo, e non viene conteggiato nulla quando il tuo browser invia Do Not Track o Global Privacy Control.",
          "Conteggi d’uso per far funzionare il servizio: quanti account sono stati attivi ogni giorno, quanti su una TV e nell’app installata e, per ogni settimana di registrazione, quanti di quegli account sono tornati in ogni settimana successiva (contati con sketch HyperLogLog, da cui non si può risalire a nessuno); quante ricerche hanno raggiunto il nostro server e quante non hanno trovato nulla; avvii ed errori del player per metodo di riproduzione, con il tempo fino al primo fotogramma; il numero di richieste ed errori del server, anche per ora. Le parole di una ricerca che non ha trovato nulla vengono conservate solo se almeno cinque persone diverse le hanno cercate nello stesso giorno, e mai con Do Not Track o Global Privacy Control; fino ad allora restano sul nostro server al massimo 35 giorni. Si conservano solo i totali, per 13 mesi; nessun titolo né cronologia vi è collegato.",
          "Trakt o Simkl, se ne colleghi uno a un profilo: il nome dell’account e il suo accesso (token di accesso e di aggiornamento, cifrati a riposo con AES-256-GCM), ciò che hai scelto di sincronizzare, gli orari dell’ultima attività del servizio e un registro di ciò che Lumovio vi ha già inviato.",
          "Discord, se colleghi un canale in Impostazioni → Notifiche: l’URL del webhook del canale (cifrato a riposo con AES-256-GCM) e il suo nome.",
        ]}
      />
      <H>Cosa è privato per impostazione predefinita</H>
      <P>
        Cronologia, avanzamento della riproduzione, server collegati e dati personali non sono mai pubblici. I profili pubblici mostrano solo ciò che scegli di mostrare (preferiti, liste
        scelte, voti).
      </P>
      <H>Responsabili del trattamento</H>
      <L
        items={[
          "Cloudflare – DNS, TLS e inoltro delle richieste.",
          "Resend – email transazionali (verifica, reimpostazione della password, notifiche facoltative).",
          "TMDB – dati del catalogo; le richieste partono dal nostro server e non contengono dati personali.",
          "MDBList, OMDb, Wikidata, TVmaze e AniList – voti e collegamenti incrociati dei titoli, e orari di messa in onda degli episodi (TVmaze); il nostro server chiede solo tramite l’id del titolo, senza dati personali.",
          "fanart.tv – loghi e sfondi: il nostro server chiede tramite l’id del titolo; il tuo browser carica poi le immagini dalla CDN di fanart.tv, come fa con quelle di TMDB.",
          "MusicBrainz e Wikidata – album delle colonne sonore, richiesti dal nostro server tramite l’id del titolo; le copertine degli album si caricano nel tuo browser dal Cover Art Archive (archive.org).",
          "Spotify – solo se premi «Ascolta su Spotify» nella pagina di un titolo: il player di Spotify si carica allora da Spotify, secondo i termini e l’informativa sulla privacy di Spotify. Prima di allora non viene caricato nulla da Spotify.",
          "MDBList – per le liste che segui, il nostro server scarica quella lista pubblica tramite il suo indirizzo una volta al giorno; non viene inviato nulla su di te. Smetti di seguirla nella pagina della lista; i suoi titoli restano.",
          "Trakt e Simkl – solo per un profilo che colleghi in Impostazioni → Trakt e Simkl. Il nostro server legge cronologia, voti e lista Da guardare di quell’account (come scegli tu) mentre usi Lumovio. Scrive sul servizio solo ciò che attivi: visioni, voti e aggiunte a Da guardare fatti in Lumovio da quel momento, quelli precedenti solo quando premi «Invia esistenti», e – con lo scrobbling attivo – ciò che avvii, metti in pausa e finisci nel player di Lumovio (titolo, episodio, avanzamento). Sul servizio non viene mai eliminato nulla. La disconnessione (o l’eliminazione del tuo account o del profilo) chiede al servizio di revocare l’accesso di Lumovio e lo cancella qui; ciò che è stato importato resta finché non annulli l’importazione.",
          "Discord – solo se colleghi un canale in Impostazioni → Notifiche: il nostro server vi pubblica i nuovi episodi delle serie che segui (la serie, la stagione e l’episodio, il titolo dell’episodio). Scollegandolo, l’indirizzo viene cancellato qui.",
          "OpenAI – solo quando usi la ricerca con IA: il testo della tua richiesta (e, se lo consenti, titoli/generi dalla tua cronologia). Mai la tua email o i tuoi server.",
          "Il nostro fornitore di hosting (un server virtuale) – esegue il servizio e il database; i backup vanno in uno storage di oggetti cifrato (Cloudflare R2).",
        ]}
      />
      <H>Cookie</H>
      <P>Solo cookie essenziali: la tua sessione, la lingua scelta, il tema e la modalità TV. Nessun cookie pubblicitario o di analisi.</P>
      <H>Conservazione</H>
      <P>
        I dati vengono conservati finché esiste il tuo account. Eliminare l’account rimuove tutti i profili, la cronologia e le connessioni; i backup cifrati vengono sovrascritti entro 30
        giorni.
      </P>
      <H>I tuoi diritti</H>
      <P>Puoi accedere ai tuoi dati, esportarli (JSON), correggerli ed eliminarli da solo nelle Impostazioni. Per tutto il resto, scrivi a {LEGAL_CONTACT}.</P>
    </>
  ),
  credits: () => (
    <>
      <H>Dati</H>
      <TmdbMark />
      <P>
        Questo prodotto usa l’API di TMDB ma non è approvato né certificato da TMDB. Metadati di film e serie, immagini e dati sulle persone © dei rispettivi proprietari, forniti da{" "}
        <A href="https://www.themoviedb.org">The Movie Database (TMDB)</A>.
      </P>
      <P>
        Alcuni loghi e sfondi dei titoli provengono da <A href="https://fanart.tv">fanart.tv</A> e sono realizzati dalla sua community; quando fanart.tv indica un titolare dei diritti, è
        citato nei Dettagli del titolo. Lumovio li usa quando TMDB non ha un logo nella tua lingua o un’immagine di sfondo.
      </P>
      <P>
        Gli album delle colonne sonore provengono da <A href="https://musicbrainz.org">MusicBrainz</A> (dati principali CC0) e da Wikidata, solo quando uno dei due collega l’album al
        titolo; le copertine dal <A href="https://coverartarchive.org">Cover Art Archive</A>. Il player è l’embed ufficiale di Spotify.
      </P>
      <P>Lumovio usa Trakt ma non è approvato né certificato da Trakt. Il collegamento a Simkl usa l’API di Simkl; Lumovio non è affiliato a Simkl.</P>
      <P>
        La disponibilità in streaming è fornita da <A href="https://www.justwatch.com">JustWatch</A> tramite TMDB.
      </P>
      <P>
        Voti IMDb:{" "}
        <span lang="en">
          Information courtesy of IMDb (<A href="https://www.imdb.com">https://www.imdb.com</A>). Used with permission.
        </span>{" "}
        Provengono dal dataset dei voti di IMDb, caricato ogni giorno e mostrato con la sua data.
      </P>
      <P>
        I voti di Rotten Tomatoes (Tomatometer e Popcornmeter), Metacritic, Letterboxd, Trakt e MyAnimeList, e i voti IMDb dei titoli assenti da quel dataset, provengono da{" "}
        <A href="https://mdblist.com">MDBList</A> (datati con l’ultimo aggiornamento del titolo su MDBList), dall’<A href="https://www.omdbapi.com">OMDb API</A> (CC BY-NC 4.0) o da
        istantanee datate su <A href="https://www.wikidata.org">Wikidata</A> (CC0), che fornisce anche i collegamenti incrociati; i dati delle serie da{" "}
        <A href="https://www.tvmaze.com">TVmaze</A> (CC BY-SA 4.0); i dati degli anime da <A href="https://anilist.co">AniList</A>. Ogni voto è mostrato con la sua fonte e rimanda a
        essa. I nomi e i loghi di IMDb, Rotten Tomatoes, Metacritic, Letterboxd, Trakt, Kinopoisk, MyAnimeList, AniList, TVmaze e TMDB sono marchi dei rispettivi proprietari, usati solo
        per identificare la fonte; Lumovio non è affiliato a loro né approvato da loro.
      </P>
      <P>
        I simboli accanto ai tuoi server ne indicano il tipo: il logo di <A href="https://jellyfin.org">Jellyfin</A> è © dei contributori di Jellyfin con licenza{" "}
        <A href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</A>; <A href="https://www.plex.tv">Plex</A> è un marchio di Plex, Inc.; l’icona di{" "}
        <A href="https://github.com/YouROK/TorrServer">TorrServer</A> appartiene al progetto TorrServer. Lumovio non è affiliato a loro né approvato da loro.
      </P>
      <P>
        I simboli delle fonti di importazione della cronologia indicano da dove proviene un file: Trakt, Simkl, IMDb, Letterboxd, Netflix e Stremio sono marchi dei rispettivi proprietari;
        l’icona di <A href="https://github.com/yumata/lampa">Lampa</A> proviene dal progetto Lampa con licenza{" "}
        <A href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL-2.0</A>. Lumovio non è affiliato a loro né approvato da loro.
      </P>
      <P>
        I marchi nella finestra di condivisione indicano dove va un link: Telegram, WhatsApp, X, Facebook e Reddit sono marchi dei rispettivi proprietari, disegnati da <A href="https://simpleicons.org">Simple Icons</A> (CC0). Lumovio non è affiliato né approvato da loro.
      </P>
      <P>
        Il Lumovio Score è il punteggio derivato di Lumovio, calcolato dai voti di IMDb, TMDB, Rotten Tomatoes, Metacritic, Letterboxd, Trakt e MyAnimeList indicati sopra (TVmaze e AniList
        non ne fanno parte). Nessuno di questi servizi lo pubblica o lo approva; come funziona è spiegato qui sotto.
      </P>
      <ScoreMethodology locale="it" />
      <H>Software open source</H>
      <L
        items={[
          "Video.js 10 (Apache-2.0)",
          "Next.js, React (MIT)",
          "Fastify, Drizzle ORM, BullMQ (MIT)",
          "Better Auth (MIT)",
          "hls.js (Apache-2.0)",
          "Mediabunny (MPL-2.0) con i decoder AC-3/E-AC-3 e DTS e l’encoder AAC di FFmpeg (LGPL-2.1 o successiva; sorgente su ffmpeg.org): nel tuo browser riconfeziona i file che il browser non sa aprire da solo",
          <>
            FFmpeg (LGPL-2.1 o successiva): i decoder audio (Dolby TrueHD, MP3, FLAC, Vorbis, AC-3, MP2) e video (MPEG-4 Part 2 – Xvid e DivX, MPEG-1/2, H.263) del player di Lumovio sono
            compilati in WebAssembly dalla versione 8.0.3 senza parti GPL –{" "}
            <A href="https://github.com/FFmpeg/FFmpeg/tree/n8.0.3">sorgente di quella versione</A>; lo script di build è scripts/player-codecs nel codice sorgente di Lumovio, e
            /codecs/audio.* e /codecs/video.* si possono sostituire con una propria build
          </>,
          <>
            <A href="https://github.com/ThaUnknown/jassub">JASSUB</A> (MIT) con libass (ISC), FreeType (FTL), HarfBuzz (MIT) e FriBidi (LGPL-2.1 o successiva;{" "}
            <A href="https://github.com/fribidi/fribidi">sorgente</A>) – sottotitoli ASS/SSA con il loro stile; font Liberation Sans (SIL OFL 1.1)
          </>,
          "Preparazione dei flussi sul server di Lumovio (quando è attiva): FFmpeg con x264 (GPL-2.0 o successiva) in un’immagine Alpine Linux",
          "Radix UI, Lucide (MIT / ISC)",
          "Font Manrope (SIL OFL 1.1)",
        ]}
      />
      <P>Il client web di Lumovio è open source con licenza Apache License 2.0.</P>
    </>
  ),
  copyright: () => (
    <>
      <P>
        Lumovio non ospita film o serie. La riproduzione avviene dai server che gli utenti collegano da sé. Se ritieni che contenuti resi disponibili tramite Lumovio (per esempio in una
        lista pubblica o in un profilo pubblico) violino i tuoi diritti, invia una segnalazione qui sotto. Esaminiamo ogni segnalazione e rispondiamo.
      </P>
      <RightsNoticeForm />
    </>
  ),
};
