import type { ReactNode } from "react";
import { A, H, L, LEGAL_CONTACT, type LegalDoc, P, ScoreMethodology, TmdbMark } from "./parts";
import { RightsNoticeForm } from "./RightsNoticeForm";

/**
 * The legal pages in Spanish — a translation (owner's decision 1.3, L10N-01): the English version has legal force, and the
 * page says so with a link to it. "tú" as everywhere in the Spanish interface (glossary-es.md); names of services, licences
 * and IMDb's required attribution stay as they are.
 */
export const DOCS_ES: Record<LegalDoc, () => ReactNode> = {
  terms: () => (
    <>
      <P>Lumovio es un catálogo gratuito, una biblioteca personal y un centro multimedia. Al crear una cuenta, aceptas estos términos.</P>
      <H>Qué es Lumovio y qué no es</H>
      <P>
        Lumovio muestra información sobre películas y series (de TMDB), guarda tus listas y tu historial y te permite reproducir vídeo desde servidores que conectas tú mismo
        (Jellyfin, Plex, TorrServer). Lumovio no aloja, vende ni distribuye películas, y sus servidores no retransmiten tus streams de vídeo.
      </P>
      <H>Tus responsabilidades</H>
      <L
        items={[
          "Solo puedes conectar servidores y contenidos que tengas derecho a usar. Eres responsable de lo que añadas a tus propios servidores multimedia y clientes de torrent.",
          "No uses Lumovio para infringir derechos de autor, acosar a otras personas, enviar spam, extraer datos del servicio de forma automatizada (scraping) ni atacar su infraestructura.",
          "Los perfiles públicos y las listas públicas no deben contener contenido ilegal, de odio o engañoso.",
          "Guarda tus credenciales en un lugar seguro. Te recomendamos la verificación en dos pasos.",
        ]}
      />
      <H>Cuentas y perfiles</H>
      <P>
        Una cuenta puede tener varios perfiles. Los perfiles infantiles limitan el contenido según la clasificación por edad; las clasificaciones proceden de datos de terceros y
        pueden estar incompletas, así que supervisa a los niños pequeños.
      </P>
      <H>Servicio gratuito, sin garantías</H>
      <P>
        Lumovio se ofrece gratis, «tal cual». Las funciones pueden cambiar. Podemos suspender las cuentas que incumplan estos términos. Intentamos que el servicio esté siempre
        disponible, pero no lo garantizamos.
      </P>
      <H>Servicios de terceros</H>
      <P>
        Los metadatos proceden de TMDB; la disponibilidad en streaming, de JustWatch a través de TMDB; el inicio de sesión puede usar Google, Apple o Discord. A ellos se aplican sus
        propias condiciones.
      </P>
      <H>Baja</H>
      <P>Puedes exportar tus datos y eliminar tu cuenta en cualquier momento en Ajustes → Privacidad y datos.</P>
      <H>Contacto</H>
      <P>{LEGAL_CONTACT}</P>
    </>
  ),
  privacy: () => (
    <>
      <P>Recogemos lo mínimo necesario para que Lumovio funcione y nunca vendemos datos personales. No hay anuncios ni rastreadores de terceros.</P>
      <H>Qué guardamos</H>
      <L
        items={[
          "Cuenta: dirección de correo electrónico, nombre visible, hash de la contraseña (o el identificador del inicio de sesión con Google, Apple o Discord) y el secreto de la verificación en dos pasos.",
          "Perfiles: nombres, avatares, preferencias de idioma y región (idiomas de audio y de subtítulos, estudios de doblaje preferentes) y hashes de los PIN.",
          "Tu biblioteca: listas, Pendientes, Favoritos, valoraciones, historial y posiciones de reproducción, por perfil.",
          "Recomendaciones: lo que un perfil les indica (Me gusta, «No me interesa» con su motivo, «No tener en cuenta», géneros y personas que excluir, los ajustes) y, mientras «Usar las páginas abiertas» está activado, en qué páginas de títulos se quedó unos segundos (el título y el día, guardados 180 días). Ajustes → Recomendaciones los muestra y permite quitar uno o todos; están en tu exportación de datos y se eliminan con el perfil.",
          "Conexiones con servidores multimedia: dirección del servidor y un token de acceso, cifrados en reposo (AES-256-GCM). El vídeo nunca pasa por nuestros servidores. En un TorrServer que conectes se pueden buscar releases desde tu propio dispositivo (puedes desactivarlo por servidor); nuestros servidores nunca ven las búsquedas ni la lista de releases. Para un título de tus Pendientes, tu dispositivo guarda con tu perfil solo el idioma del audio, el tipo de traducción, el estudio de doblaje y la calidad de imagen del mejor release (sin enlaces, hashes de archivos ni trackers), para que tus otros dispositivos también lo muestren; está en tu exportación de datos y se elimina con el perfil.",
          "Datos de seguridad: sesiones activas con el agente de usuario del navegador, la dirección IP y el tipo de dispositivo (el sitio, la app instalada o un televisor), contadores de límite de solicitudes y un registro de auditoría de las acciones de los administradores.",
          "Solicitudes de soporte: el tema, tus mensajes y las respuestas del soporte, el correo para la respuesta y —solo si marcas «Adjuntar un resumen técnico»— tu navegador (agente de usuario), el tamaño de pantalla, el idioma, si la app instalada está abierta y el último fallo del reproductor en este navegador (sin direcciones de servidores, contraseñas ni títulos; hasta que lo envías, solo se guarda en tu navegador). Las respuestas llegan por correo a través de Resend; sin iniciar sesión, el formulario puede estar protegido por Cloudflare Turnstile. Las solicitudes cerradas se eliminan 12 meses después del cierre, y las de una cuenta, junto con la cuenta.",
          "Importaciones: los archivos que subes se analizan y se guardan las filas emparejadas; puedes deshacer una importación.",
          "Recuentos anónimos de filas: con qué frecuencia se ven y se abren las tarjetas de las filas de una página, y si después se añadió el título a Pendientes o se reprodujo; se cuentan por día, página, fila y posición, y según si el visitante había iniciado sesión. No intervienen cuentas, perfiles, títulos, cookies ni almacenamiento del dispositivo, y no se cuenta nada cuando tu navegador envía Do Not Track o Global Privacy Control.",
          "Recuentos de uso para mantener el servicio: cuántas cuentas estuvieron activas cada día, cuántas en un televisor y en la app instalada y, para cada semana de registro, cuántas de esas cuentas volvieron en cada semana siguiente (contadas con esquemas HyperLogLog, de los que no se puede sacar quién); cuántas búsquedas llegaron a nuestro servidor y cuántas no encontraron nada; los inicios y fallos del reproductor por método de reproducción, con el tiempo hasta el primer fotograma; y las solicitudes y errores del servidor, también por hora. Las palabras de una búsqueda que no encontró nada solo se guardan si al menos cinco personas distintas las buscaron el mismo día, y nunca con Do Not Track o Global Privacy Control; hasta entonces permanecen en nuestro servidor como máximo 35 días. Solo se guardan los totales, durante 13 meses; no se les asocia ningún título ni historial.",
          "Trakt o Simkl, si vinculas uno a un perfil: el nombre de la cuenta y su inicio de sesión (tokens de acceso y de actualización, cifrados en reposo con AES-256-GCM), lo que elegiste sincronizar, las marcas de tiempo de la última actividad del servicio y un registro de lo que Lumovio ya envió allí.",
          "Discord, si conectas un canal en Ajustes → Notificaciones: la URL del webhook del canal (cifrada en reposo con AES-256-GCM) y su nombre.",
        ]}
      />
      <H>Qué es privado por defecto</H>
      <P>
        El historial, el progreso de reproducción, los servidores conectados y los datos personales nunca son públicos. Los perfiles públicos muestran solo lo que tú eliges
        (Favoritos, listas elegidas, valoraciones).
      </P>
      <H>Encargados del tratamiento</H>
      <L
        items={[
          "Cloudflare: DNS, TLS y proxy de las solicitudes.",
          "Resend: correo transaccional (verificación, restablecimiento de la contraseña, notificaciones opcionales).",
          "TMDB: datos del catálogo; las solicitudes las hace nuestro servidor y no contienen datos personales.",
          "MDBList, OMDb, Wikidata, TVmaze y AniList: notas y enlaces cruzados de los títulos, y horarios de emisión de los episodios (TVmaze); nuestro servidor pregunta solo por el identificador del título, sin datos personales.",
          "fanart.tv: logotipos y fondos; nuestro servidor pregunta por el identificador del título y después tu navegador carga las imágenes desde la CDN de fanart.tv, igual que las de TMDB.",
          "MusicBrainz y Wikidata: álbumes de bandas sonoras, que nuestro servidor consulta por el identificador del título; las portadas de los álbumes se cargan en tu navegador desde el Cover Art Archive (archive.org).",
          "Spotify: solo si pulsas «Escuchar en Spotify» en la página de un título; entonces el reproductor propio de Spotify se carga desde Spotify, con sus condiciones y su política de privacidad. Antes de eso no se carga nada de Spotify.",
          "MDBList: para las listas que sigues, nuestro servidor obtiene esa lista pública por su dirección una vez al día; no se envía nada sobre ti. Puedes dejar de seguirla en la página de la lista; sus títulos se quedan.",
          "Trakt y Simkl: solo para un perfil que vincules en Ajustes → Trakt y Simkl. Nuestro servidor lee el historial, las valoraciones y los Pendientes de esa cuenta (según elijas) mientras usas Lumovio. En el servicio escribe solo lo que actives: reproducciones, valoraciones y títulos añadidos a Pendientes en Lumovio a partir de ese momento, los anteriores solo cuando pulsas «Enviar lo existente» y, con el scrobbling activado, lo que empiezas, pausas y terminas en el reproductor de Lumovio (título, episodio, progreso). Nunca se elimina nada en el servicio. Al desconectar (o al eliminar tu cuenta o el perfil) se pide al servicio que revoque el acceso de Lumovio y aquí se borra; lo importado se queda hasta que deshagas la importación.",
          "Discord: solo si conectas un canal en Ajustes → Notificaciones. Nuestro servidor publica allí los nuevos episodios de las series que sigues (la serie, la temporada y el episodio, el título del episodio). Al desconectarlo, la dirección se borra aquí.",
          "OpenAI: solo cuando usas la búsqueda con IA; recibe el texto de tu búsqueda (y, si lo permites, títulos y géneros de tu historial). Nunca tu correo ni tus servidores.",
          "Nuestro proveedor de alojamiento (un servidor virtual): ejecuta el servicio y la base de datos; las copias de seguridad van a un almacenamiento de objetos cifrado (Cloudflare R2).",
        ]}
      />
      <H>Cookies</H>
      <P>Solo cookies esenciales: tu sesión, el idioma elegido, el tema y el modo TV. Ninguna cookie de publicidad ni de analítica.</P>
      <H>Conservación</H>
      <P>
        Los datos se conservan mientras exista tu cuenta. Al eliminar tu cuenta se eliminan todos los perfiles, el historial y las conexiones; las copias de seguridad cifradas se
        renuevan en un plazo de 30 días.
      </P>
      <H>Tus derechos</H>
      <P>Puedes acceder a tus datos, exportarlos (JSON), corregirlos y eliminarlos tú mismo en Ajustes. Para cualquier otra cosa, escribe a {LEGAL_CONTACT}.</P>
    </>
  ),
  credits: () => (
    <>
      <H>Datos</H>
      <TmdbMark />
      <P>
        Este producto usa la API de TMDB, pero no está respaldado ni certificado por TMDB. Los metadatos, las imágenes y los datos de personas de películas y series son © de sus
        respectivos titulares y los proporciona <A href="https://www.themoviedb.org">The Movie Database (TMDB)</A>.
      </P>
      <P>
        Algunos logotipos y fondos de títulos proceden de <A href="https://fanart.tv">fanart.tv</A> y los ha creado su comunidad; cuando fanart.tv registra un titular de derechos,
        se indica en los Detalles del título. Lumovio los usa cuando TMDB no tiene un logotipo en tu idioma o no tiene imagen de fondo.
      </P>
      <P>
        Los álbumes de bandas sonoras proceden de <A href="https://musicbrainz.org">MusicBrainz</A> (datos principales CC0) y de Wikidata, solo cuando uno de ellos vincula el álbum
        con el título; las portadas, del <A href="https://coverartarchive.org">Cover Art Archive</A>. El reproductor es el reproductor integrado oficial de Spotify.
      </P>
      <P>Lumovio usa Trakt, pero no está respaldado ni certificado por Trakt. La vinculación con Simkl usa la API de Simkl; Lumovio no está afiliado a Simkl.</P>
      <P>
        La disponibilidad en streaming la proporciona <A href="https://www.justwatch.com">JustWatch</A> a través de TMDB.
      </P>
      <P>
        Notas de IMDb:{" "}
        <span lang="en">
          Information courtesy of IMDb (<A href="https://www.imdb.com">https://www.imdb.com</A>). Used with permission.
        </span>{" "}
        Proceden del conjunto de datos de valoraciones de IMDb, que se carga a diario, y se muestran con su fecha.
      </P>
      <P>
        Las notas de Rotten Tomatoes (Tomatometer y Popcornmeter), Metacritic, Letterboxd, Trakt y MyAnimeList, y las notas de IMDb de los títulos que faltan en ese conjunto de
        datos, proceden de <A href="https://mdblist.com">MDBList</A> (con la fecha de la última actualización del título en MDBList), de la{" "}
        <A href="https://www.omdbapi.com">API de OMDb</A> (CC BY-NC 4.0) o de capturas fechadas de <A href="https://www.wikidata.org">Wikidata</A> (CC0), que también aporta los
        enlaces cruzados; los datos de TV, de <A href="https://www.tvmaze.com">TVmaze</A> (CC BY-SA 4.0); los datos de anime, de <A href="https://anilist.co">AniList</A>. Cada nota se
        muestra con su fuente y enlaza a ella. Los nombres y logotipos de IMDb, Rotten Tomatoes, Metacritic, Letterboxd, Trakt, Kinopoisk, MyAnimeList, AniList, TVmaze y TMDB son
        marcas de sus titulares y se usan solo para identificar la fuente; Lumovio no está afiliado a ellos ni respaldado por ellos.
      </P>
      <P>
        Los logotipos junto a tus servidores indican su tipo: el logotipo de <A href="https://jellyfin.org">Jellyfin</A> es © de los colaboradores de Jellyfin bajo{" "}
        <A href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</A>; <A href="https://www.plex.tv">Plex</A> es una marca de Plex, Inc.; el icono de{" "}
        <A href="https://github.com/YouROK/TorrServer">TorrServer</A> pertenece al proyecto TorrServer. Lumovio no está afiliado a ellos ni respaldado por ellos.
      </P>
      <P>
        Los logotipos de los orígenes de importación del historial indican de dónde procede un archivo: Trakt, Simkl, IMDb, Letterboxd, Netflix y Stremio son marcas de sus
        titulares; el icono de <A href="https://github.com/yumata/lampa">Lampa</A> procede del proyecto Lampa bajo{" "}
        <A href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL-2.0</A>. Lumovio no está afiliado a ellos ni respaldado por ellos.
      </P>
      <P>
        Lumovio Score es la nota derivada propia de Lumovio, calculada a partir de las notas de IMDb, TMDB, Rotten Tomatoes, Metacritic, Letterboxd, Trakt y MyAnimeList
        mencionadas arriba (TVmaze y AniList no forman parte de ella). Ninguno de estos servicios la publica ni la respalda; abajo se explica cómo funciona.
      </P>
      <ScoreMethodology locale="es" />
      <H>Software de código abierto</H>
      <L
        items={[
          "Video.js 10 (Apache-2.0)",
          "Next.js, React (MIT)",
          "Fastify, Drizzle ORM, BullMQ (MIT)",
          "Better Auth (MIT)",
          "hls.js (Apache-2.0)",
          "Mediabunny (MPL-2.0) con los decodificadores AC-3/E-AC-3 y DTS y el codificador AAC de FFmpeg (LGPL-2.1 o posterior; código fuente en ffmpeg.org): en tu navegador, reempaqueta los archivos que el navegador no puede abrir por sí mismo",
          <>
            FFmpeg (LGPL-2.1 o posterior): los decodificadores de audio (Dolby TrueHD, MP3, FLAC, Vorbis, AC-3, MP2) y de vídeo (MPEG-4 Part 2 —Xvid y DivX—, MPEG-1/2, H.263) del
            reproductor de Lumovio se compilan a WebAssembly a partir de la versión 8.0.3 sin partes GPL:{" "}
            <A href="https://github.com/FFmpeg/FFmpeg/tree/n8.0.3">código fuente de esa versión</A>; el script de compilación es scripts/player-codecs en el código fuente de Lumovio, y
            /codecs/audio.* y /codecs/video.* se pueden sustituir por tu propia compilación
          </>,
          <>
            <A href="https://github.com/ThaUnknown/jassub">JASSUB</A> (MIT) con libass (ISC), FreeType (FTL), HarfBuzz (MIT) y FriBidi (LGPL-2.1 o posterior;{" "}
            <A href="https://github.com/fribidi/fribidi">código fuente</A>): subtítulos ASS/SSA con su estilo; fuente Liberation Sans (SIL OFL 1.1)
          </>,
          "Preparación de streams en el servidor de Lumovio (cuando está activada): FFmpeg con x264 (GPL-2.0 o posterior) en una imagen de Alpine Linux",
          "Radix UI, Lucide (MIT / ISC)",
          "Fuente Manrope (SIL OFL 1.1)",
        ]}
      />
      <P>El cliente web de Lumovio es de código abierto bajo la licencia Apache 2.0.</P>
    </>
  ),
  copyright: () => (
    <>
      <P>
        Lumovio no aloja películas ni series. La reproducción procede de servidores que los propios usuarios conectan. Si crees que un contenido disponible a través de Lumovio (por
        ejemplo, en una lista pública o un perfil público) infringe tus derechos, envía un aviso a continuación. Revisamos cada aviso y respondemos.
      </P>
      <RightsNoticeForm />
    </>
  ),
};
