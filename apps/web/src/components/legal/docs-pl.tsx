import type { ReactNode } from "react";
import { A, H, L, LEGAL_CONTACT, type LegalDoc, P, ScoreMethodology, TmdbMark } from "./parts";
import { RightsNoticeForm } from "./RightsNoticeForm";

/**
 * The legal pages in Polish — a translation (owner's decision 1.3, L10N-01): the English version has legal force, and the
 * page says so with a link to it. "ty" as everywhere in the Polish interface (glossary-pl.md); names of services, licences
 * and IMDb's required attribution stay as they are.
 */
export const DOCS_PL: Record<LegalDoc, () => ReactNode> = {
  terms: () => (
    <>
      <P>Lumovio to bezpłatny katalog, osobista biblioteka i centrum multimediów. Tworząc konto, akceptujesz ten regulamin.</P>
      <H>Czym Lumovio jest – a czym nie jest</H>
      <P>
        Lumovio pokazuje informacje o filmach i serialach (z TMDB), przechowuje twoje listy i historię oraz pozwala odtwarzać wideo z serwerów, które łączysz samodzielnie
        (Jellyfin, Plex, TorrServer). Lumovio nie hostuje, nie sprzedaje ani nie rozpowszechnia filmów, a jego serwery nie przekazują twoich strumieni wideo.
      </P>
      <H>Twoje obowiązki</H>
      <L
        items={[
          "Możesz łączyć tylko serwery i treści, z których masz prawo korzystać. Odpowiadasz za to, co dodajesz do własnych serwerów multimedialnych i klientów torrent.",
          "Nie używaj Lumovio do naruszania praw autorskich, nękania innych, wysyłania spamu, automatycznego pobierania danych z serwisu (scrapingu) ani atakowania jego infrastruktury.",
          "Publiczne profile i publiczne listy nie mogą zawierać treści niezgodnych z prawem, nienawistnych ani wprowadzających w błąd.",
          "Chroń swoje dane logowania. Zalecamy weryfikację dwuetapową.",
        ]}
      />
      <H>Konta i profile</H>
      <P>
        Konto może mieć kilka profili. Profile dziecięce ograniczają treści według kategorii wiekowej; kategorie wiekowe pochodzą z danych zewnętrznych i mogą być niepełne,
        dlatego miej oko na małe dzieci.
      </P>
      <H>Bezpłatna usługa bez gwarancji</H>
      <P>
        Lumovio jest udostępniane bezpłatnie, w stanie „takim, jakie jest”. Funkcje mogą się zmieniać. Możemy zawiesić konta, które naruszają ten regulamin. Dążymy do wysokiej
        dostępności, ale jej nie gwarantujemy.
      </P>
      <H>Usługi zewnętrzne</H>
      <P>
        Metadane pochodzą z TMDB, dostępność w serwisach streamingowych – z JustWatch przez TMDB; do logowania można użyć Google, Apple lub Discord. Do tych usług stosuje się ich
        własne warunki.
      </P>
      <H>Zakończenie korzystania</H>
      <P>W każdej chwili możesz wyeksportować swoje dane i usunąć konto w Ustawienia → Prywatność i dane.</P>
      <H>Kontakt</H>
      <P>{LEGAL_CONTACT}</P>
    </>
  ),
  privacy: () => (
    <>
      <P>Zbieramy tylko minimum danych potrzebnych do działania Lumovio i nigdy nie sprzedajemy danych osobowych. Nie ma reklam ani zewnętrznych trackerów.</P>
      <H>Co przechowujemy</H>
      <L
        items={[
          "Konto: adres e-mail, wyświetlana nazwa, hash hasła (lub identyfikator z logowania przez Google/Apple/Discord), sekret weryfikacji dwuetapowej.",
          "Profile: nazwy, awatary, ustawienia języka i regionu (języki audio i napisów, preferowane studia dubbingowe i lektorskie), hashe PIN-ów.",
          "Twoja biblioteka: listy, lista Do obejrzenia, Ulubione, oceny, historia oglądania i miejsca odtwarzania – osobno dla każdego profilu.",
          "Rekomendacje: to, co profil im przekazuje (polubienia, „Nie interesuje mnie” z powodem, „Nie uwzględniaj”, gatunki i osoby do pominięcia, ustawienia) oraz – gdy włączone jest „Używaj otwartych stron” – na których stronach tytułów profil pozostał kilka sekund (tytuł i dzień, przechowywane 180 dni). Ustawienia → Rekomendacje pokazują je i pozwalają usunąć jedną lub wszystkie; są w eksporcie twoich danych i są usuwane razem z profilem.",
          "Połączenia z serwerami: adres serwera i token dostępu, przechowywane w postaci zaszyfrowanej (AES-256-GCM). Wideo nigdy nie przechodzi przez nasze serwery. Połączony TorrServer może być przeszukiwany pod kątem wydań z twojego własnego urządzenia (można to wyłączyć dla każdego serwera); nasze serwery nigdy nie widzą wyszukiwań ani listy wydań. Dla tytułu z listy Do obejrzenia twoje urządzenie zapisuje w profilu tylko język audio, rodzaj tłumaczenia, studio i jakość obrazu najlepszego wydania (bez linków, hashy plików i trackerów), aby pokazywały je też twoje inne urządzenia; te dane są w eksporcie twoich danych i są usuwane razem z profilem.",
          "Dane bezpieczeństwa: aktywne sesje z identyfikatorem przeglądarki (user-agent), adresem IP i rodzajem urządzenia (strona, zainstalowana aplikacja lub telewizor), liczniki ograniczania liczby zapytań, dziennik audytu działań administratorów.",
          "Zgłoszenia do pomocy: temat, Twoje wiadomości i odpowiedzi pomocy, e-mail do odpowiedzi oraz — tylko jeśli zaznaczysz „Dołącz podsumowanie techniczne” — przeglądarka (user-agent), rozmiar ekranu, język, czy otwarta jest zainstalowana aplikacja, i ostatni błąd odtwarzacza w tej przeglądarce (bez adresów serwerów, haseł i tytułów; do wysłania przechowywany jest tylko w Twojej przeglądarce). Odpowiedzi przychodzą e-mailem przez Resend; bez logowania formularz może chronić weryfikacja Cloudflare Turnstile. Zamknięte zgłoszenia są usuwane 12 miesięcy po zamknięciu, a zgłoszenia konta — razem z kontem.",
          "Importy: przesłane pliki są analizowane, a dopasowane wiersze zapisywane; import można cofnąć.",
          "Anonimowe liczniki rzędów: jak często karty w rzędach strony są wyświetlane i otwierane oraz czy potem nastąpiło dodanie do listy Do obejrzenia lub odtworzenie – liczone według dnia, strony, rzędu i pozycji oraz tego, czy odwiedzający był zalogowany. Nie są przy tym używane konto, profil, tytuł, pliki cookie ani pamięć urządzenia, a nic nie jest liczone, gdy twoja przeglądarka wysyła Do Not Track lub Global Privacy Control.",
          "Liczniki użycia potrzebne do działania serwisu: ile kont było aktywnych danego dnia, ile z nich na telewizorze i w zainstalowanej aplikacji, a dla każdego tygodnia rejestracji — ile z tych kont wróciło w każdym kolejnym tygodniu (liczone szkicami HyperLogLog, z których nie da się odtworzyć, kto to był); ile wyszukiwań dotarło do naszego serwera i ile nic nie znalazło; uruchomienia i błędy odtwarzacza według sposobu odtwarzania, z czasem do pierwszej klatki; liczba żądań i błędów serwera, także według godzin. Słowa wyszukiwania, które nic nie znalazło, są zapisywane tylko wtedy, gdy tego samego dnia szukało ich co najmniej pięć różnych osób, i nigdy przy sygnale Do Not Track lub Global Privacy Control; do tego czasu pozostają na naszym serwerze najwyżej 35 dni. Przechowujemy tylko sumy, przez 13 miesięcy; nie są z nimi powiązane żadne tytuły ani historia.",
          "Szybkość stron: jak szybko strona pokazała główną treść, jak szybko odpowiedziała na dotknięcie lub klawisz i jak bardzo przesuwała się podczas ładowania (LCP, INP, CLS) — liczone dziennie, według rodzaju strony (główna, strona tytułu, wyszukiwanie…) i rodzaju urządzenia (komputer, telefon, TV), bez twojego konta, ciasteczek i adresu. Przy Do Not Track lub Global Privacy Control nic nie jest wysyłane. Przechowywane jako dzienne sumy przez 13 miesięcy.",
          "Obrazy wybrane przez ciebie dla strony tytułu (tło i logo, dla każdego profilu) i — tylko jeśli go dodasz — twój własny klucz fanart.tv, zaszyfrowany (AES-256-GCM); z nim nasz serwer pyta fanart.tv o obrazy tego tytułu, gdy otwierasz wybór.",
          "Trakt lub Simkl, jeśli połączysz jeden z nich z profilem: nazwa konta i logowanie w serwisie (tokeny dostępu i odświeżania, przechowywane w postaci zaszyfrowanej AES-256-GCM), to, co wybrano do synchronizacji, znaczniki czasu ostatniej aktywności w serwisie oraz zapis tego, co Lumovio już tam wysłało.",
          "Discord, jeśli połączysz kanał w Ustawieniach → Powiadomieniach: adres URL webhooka kanału (zaszyfrowany AES-256-GCM) i jego nazwa.",
        ]}
      />
      <H>Co jest domyślnie prywatne</H>
      <P>
        Historia oglądania, postęp odtwarzania, połączone serwery i dane osobowe nigdy nie są publiczne. Profile publiczne pokazują tylko to, co zdecydujesz się udostępnić (Ulubione,
        wybrane listy, oceny).
      </P>
      <H>Podmioty przetwarzające</H>
      <L
        items={[
          "Cloudflare – DNS, TLS i przekazywanie zapytań (proxy).",
          "Resend – e-maile transakcyjne (weryfikacja, resetowanie hasła, opcjonalne powiadomienia).",
          "TMDB – dane katalogu; zapytania wysyła nasz serwer i nie zawierają one danych osobowych.",
          "MDBList, OMDb, Wikidata, TVmaze i AniList – oceny i powiązania między bazami dla tytułów oraz godziny emisji odcinków (TVmaze); nasz serwer pyta tylko po identyfikatorze tytułu, bez danych osobowych.",
          "fanart.tv – logo i tła: nasz serwer pyta po identyfikatorze tytułu, a twoja przeglądarka wczytuje obrazy z CDN fanart.tv, tak jak w przypadku TMDB.",
          "MusicBrainz i Wikidata – albumy ze ścieżką dźwiękową, o które nasz serwer pyta po identyfikatorze tytułu; okładki albumów twoja przeglądarka wczytuje z Cover Art Archive (archive.org).",
          "Spotify – tylko jeśli klikniesz „Słuchaj w Spotify” na stronie tytułu: wtedy ze Spotify wczytuje się jego własny odtwarzacz, na warunkach i według polityki prywatności Spotify. Wcześniej nic ze Spotify się nie wczytuje.",
          "MDBList – dla obserwowanych list nasz serwer raz dziennie pobiera tę publiczną listę po jej adresie; nic o tobie nie jest przesyłane. Obserwowanie zakończysz na stronie listy; jej tytuły zostają.",
          "Trakt i Simkl – tylko dla profilu, który połączysz w Ustawienia → Trakt i Simkl. Gdy korzystasz z Lumovio, nasz serwer odczytuje historię oglądania, oceny i listę do obejrzenia tego konta (zgodnie z twoim wyborem). Do serwisu zapisuje tylko to, co włączysz: odtworzenia, oceny i dodania do listy do obejrzenia dokonane potem w Lumovio, starsze – tylko gdy klikniesz „Wyślij istniejące…”, a przy włączonym scrobblingu – to, co uruchamiasz, wstrzymujesz i kończysz w odtwarzaczu Lumovio (tytuł, odcinek, postęp). W serwisie nic nigdy nie jest usuwane. Rozłączenie (albo usunięcie konta lub profilu) prosi serwis o unieważnienie logowania Lumovio i usuwa je u nas; to, co zaimportowano, zostaje, dopóki nie cofniesz importu.",
          "Discord – tylko jeśli połączysz kanał w Ustawieniach → Powiadomieniach: nasz serwer publikuje tam nowe odcinki obserwowanych seriali (serial, sezon i odcinek, tytuł odcinka). Po rozłączeniu adres jest tu usuwany.",
          "OpenAI – tylko gdy używasz wyszukiwania AI: tekst twojego zapytania (i, jeśli się zgodzisz, tytuły/gatunki z twojej historii). Nigdy twój adres e-mail ani serwery.",
          "Nasz dostawca hostingu (serwer wirtualny) – obsługuje serwis i bazę danych; kopie zapasowe trafiają do zaszyfrowanego magazynu obiektów (Cloudflare R2).",
        ]}
      />
      <H>Pliki cookie</H>
      <P>Tylko niezbędne pliki cookie: twoja sesja, wybrany język, motyw i tryb TV. Żadnych plików cookie reklamowych ani analitycznych.</P>
      <H>Okres przechowywania</H>
      <P>
        Dane są przechowywane, dopóki istnieje twoje konto. Usunięcie konta usuwa wszystkie profile, historię i połączenia; zaszyfrowane kopie zapasowe są zastępowane nowymi w ciągu
        30 dni.
      </P>
      <H>Twoje prawa</H>
      <P>W ustawieniach możesz samodzielnie przeglądać, eksportować (JSON), poprawiać i usuwać swoje dane. W pozostałych sprawach napisz na {LEGAL_CONTACT}.</P>
    </>
  ),
  credits: () => (
    <>
      <H>Dane</H>
      <TmdbMark />
      <P>
        Ten produkt korzysta z API TMDB, ale nie jest popierany ani certyfikowany przez TMDB. Metadane filmów i seriali, obrazy i dane o osobach © ich właściciele, udostępnione przez{" "}
        <A href="https://www.themoviedb.org">The Movie Database (TMDB)</A>.
      </P>
      <P>
        Niektóre logo i tła tytułów pochodzą z <A href="https://fanart.tv">fanart.tv</A> i zostały stworzone przez jego społeczność; jeśli fanart.tv podaje właściciela praw, jest on
        wymieniony w „Szczegółach” tytułu. Lumovio używa ich, gdy TMDB nie ma logo w twoim języku albo tła.
      </P>
      <P>
        Albumy ze ścieżką dźwiękową pochodzą z <A href="https://musicbrainz.org">MusicBrainz</A> (dane podstawowe CC0) i Wikidata, tylko gdy jedno z nich wiąże album z tytułem;
        okładki – z <A href="https://coverartarchive.org">Cover Art Archive</A>. Odtwarzacz to oficjalny osadzony odtwarzacz Spotify.
      </P>
      <P>Lumovio korzysta z Trakt, ale nie jest przez Trakt popierane ani certyfikowane. Połączenie z Simkl korzysta z API Simkl; Lumovio nie jest powiązane z Simkl.</P>
      <P>
        Dane o dostępności w serwisach streamingowych udostępnia <A href="https://www.justwatch.com">JustWatch</A> przez TMDB.
      </P>
      <P>
        Oceny IMDb:{" "}
        <span lang="en">
          Information courtesy of IMDb (<A href="https://www.imdb.com">https://www.imdb.com</A>). Used with permission.
        </span>{" "}
        Pochodzą ze zbioru ocen IMDb, wczytywanego codziennie, i są pokazywane z jego datą.
      </P>
      <P>
        Oceny Rotten Tomatoes (Tomatometer i Popcornmeter), Metacritic, Letterboxd, Trakt i MyAnimeList oraz oceny IMDb dla tytułów, których brakuje w tym zbiorze, pochodzą z{" "}
        <A href="https://mdblist.com">MDBList</A> (z datą ostatniej aktualizacji tytułu w MDBList), z <A href="https://www.omdbapi.com">OMDb API</A> (CC BY-NC 4.0) lub z
        datowanych zapisów w <A href="https://www.wikidata.org">Wikidata</A> (CC0), skąd pochodzą też powiązania między bazami; dane seriali – z{" "}
        <A href="https://www.tvmaze.com">TVmaze</A> (CC BY-SA 4.0); dane anime – z <A href="https://anilist.co">AniList</A>. Każda ocena jest pokazywana ze swoim źródłem i do
        niego linkuje. Nazwy i logo IMDb, Rotten Tomatoes, Metacritic, Letterboxd, Trakt, Kinopoisk, MyAnimeList, AniList, TVmaze i TMDB są znakami towarowymi ich właścicieli i
        służą tylko do wskazania źródła; Lumovio nie jest z nimi powiązane ani przez nie popierane.
      </P>
      <P>
        Ikony przy twoich serwerach wskazują ich rodzaj: logo <A href="https://jellyfin.org">Jellyfin</A> jest © współtwórców Jellyfin i jest udostępniane na licencji{" "}
        <A href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</A>; <A href="https://www.plex.tv">Plex</A> jest znakiem towarowym Plex, Inc.; ikona{" "}
        <A href="https://github.com/YouROK/TorrServer">TorrServer</A> należy do projektu TorrServer. Lumovio nie jest z nimi powiązane ani przez nie popierane.
      </P>
      <P>
        Ikony źródeł importu historii wskazują, skąd pochodzi plik: Trakt, Simkl, IMDb, Letterboxd, Netflix i Stremio są znakami towarowymi ich właścicieli; ikona{" "}
        <A href="https://github.com/yumata/lampa">Lampa</A> pochodzi z projektu Lampa i jest udostępniana na licencji{" "}
        <A href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL-2.0</A>. Lumovio nie jest z nimi powiązane ani przez nie popierane.
      </P>
      <P>
        Znaki w oknie udostępniania mówią, dokąd trafi link: Telegram, WhatsApp, X, Facebook i Reddit są znakami towarowymi ich właścicieli, narysowanymi według <A href="https://simpleicons.org">Simple Icons</A> (CC0). Lumovio nie jest z nimi powiązane ani przez nie wspierane.
      </P>
      <P>
        Lumovio Score to własna ocena pochodna Lumovio, obliczana z powyższych ocen IMDb, TMDB, Rotten Tomatoes, Metacritic, Letterboxd, Trakt i MyAnimeList (TVmaze i AniList nie są
        uwzględniane). Żaden z tych serwisów jej nie publikuje ani nie popiera; jak działa – opisano poniżej.
      </P>
      <ScoreMethodology locale="pl" />
      <H>Oprogramowanie open source</H>
      <L
        items={[
          "Video.js 10 (Apache-2.0)",
          "Next.js, React (MIT)",
          "Fastify, Drizzle ORM, BullMQ (MIT)",
          "Better Auth (MIT)",
          "hls.js (Apache-2.0)",
          "Mediabunny (MPL-2.0) z dekoderami AC-3/E-AC-3 i DTS oraz koderem AAC z FFmpeg (LGPL-2.1 lub nowsza; kod źródłowy na ffmpeg.org): w twojej przeglądarce przepakowuje pliki, których przeglądarka sama nie otwiera",
          <>
            FFmpeg (LGPL-2.1 lub nowsza): dekodery audio (Dolby TrueHD, MP3, FLAC, Vorbis, AC-3, MP2) i wideo (MPEG-4 Part 2 – Xvid i DivX, MPEG-1/2, H.263) odtwarzacza Lumovio są
            kompilowane do WebAssembly z wersji 8.0.3 bez elementów GPL –{" "}
            <A href="https://github.com/FFmpeg/FFmpeg/tree/n8.0.3">kod źródłowy tej wersji</A>; skrypt budowania to scripts/player-codecs w kodzie źródłowym Lumovio, a /codecs/audio.*
            i /codecs/video.* można zastąpić własną kompilacją
          </>,
          <>
            <A href="https://github.com/ThaUnknown/jassub">JASSUB</A> (MIT) z libass (ISC), FreeType (FTL), HarfBuzz (MIT) i FriBidi (LGPL-2.1 lub nowsza;{" "}
            <A href="https://github.com/fribidi/fribidi">kod źródłowy</A>) – napisy ASS/SSA z ich formatowaniem; czcionka Liberation Sans (SIL OFL 1.1)
          </>,
          "Przygotowanie strumienia na serwerze Lumovio (gdy jest włączone): FFmpeg z x264 (GPL-2.0 lub nowsza) w obrazie Alpine Linux",
          "Radix UI, Lucide (MIT / ISC)",
          "Czcionka Onest (SIL OFL 1.1)",
        ]}
      />
      <P>Klient webowy Lumovio jest oprogramowaniem open source na licencji Apache License 2.0.</P>
    </>
  ),
  copyright: () => (
    <>
      <P>
        Lumovio nie hostuje filmów ani seriali. Odtwarzanie odbywa się z serwerów, które użytkownicy łączą samodzielnie. Jeśli uważasz, że treści udostępnione przez Lumovio (na
        przykład na publicznej liście lub w publicznym profilu) naruszają twoje prawa, wyślij zgłoszenie poniżej. Rozpatrujemy każde zgłoszenie i na nie odpowiadamy.
      </P>
      <RightsNoticeForm />
    </>
  ),
};
