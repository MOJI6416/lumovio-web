import type { ReactNode } from "react";
import { A, H, L, LEGAL_CONTACT, type LegalDoc, P, ScoreMethodology, TmdbMark } from "./parts";
import { RightsNoticeForm } from "./RightsNoticeForm";

/**
 * The legal pages in French — a translation (owner's decision 1.3, L10N-01): the English version has legal force, and the
 * page says so with a link to it. "vous" as everywhere in the French interface (glossary-fr.md); names of services, licences
 * and IMDb's required attribution stay as they are.
 */
export const DOCS_FR: Record<LegalDoc, () => ReactNode> = {
  terms: () => (
    <>
      <P>Lumovio est un catalogue gratuit, une bibliothèque personnelle et un centre multimédia. En créant un compte, vous acceptez ces conditions.</P>
      <H>Ce qu’est Lumovio – et ce qu’il n’est pas</H>
      <P>
        Lumovio affiche des informations sur les films et les séries (issues de TMDB), conserve vos listes et votre historique, et vous permet de lire des vidéos depuis des serveurs que
        vous connectez vous-même (Jellyfin, Plex, TorrServer). Lumovio n’héberge, ne vend ni ne distribue de films, et ses serveurs ne relaient pas vos flux vidéo.
      </P>
      <H>Vos responsabilités</H>
      <L
        items={[
          "Vous ne pouvez connecter que des serveurs et des contenus que vous avez le droit d’utiliser. Vous êtes responsable de ce que vous ajoutez à vos propres serveurs multimédias et clients BitTorrent.",
          "N’utilisez pas Lumovio pour porter atteinte au droit d’auteur, harceler d’autres personnes, envoyer du spam, extraire automatiquement les données du service (scraping) ou attaquer son infrastructure.",
          "Les profils publics et les listes publiques ne doivent pas contenir de contenus illégaux, haineux ou trompeurs.",
          "Gardez vos identifiants en sécurité. Nous recommandons la validation en deux étapes.",
        ]}
      />
      <H>Comptes et profils</H>
      <P>
        Un compte peut avoir plusieurs profils. Les profils enfant limitent les contenus selon la classification par âge ; ces classifications proviennent de données tierces et peuvent être
        incomplètes, alors gardez un œil sur les jeunes enfants.
      </P>
      <H>Service gratuit, sans garantie</H>
      <P>
        Lumovio est fourni gratuitement, « en l’état ». Les fonctionnalités peuvent changer. Nous pouvons suspendre les comptes qui enfreignent ces conditions. Nous visons une haute
        disponibilité, sans la garantir.
      </P>
      <H>Services tiers</H>
      <P>
        Les métadonnées proviennent de TMDB ; la disponibilité en streaming, de JustWatch via TMDB ; la connexion peut passer par Google, Apple ou Discord. Leurs propres conditions
        s’appliquent à ces services.
      </P>
      <H>Résiliation</H>
      <P>Vous pouvez exporter vos données et supprimer votre compte à tout moment dans Paramètres → Vie privée et données.</P>
      <H>Contact</H>
      <P>{LEGAL_CONTACT}</P>
    </>
  ),
  privacy: () => (
    <>
      <P>
        Nous collectons le minimum nécessaire au fonctionnement de Lumovio et ne vendons jamais de données personnelles. Il n’y a ni publicité ni traceurs tiers.
      </P>
      <H>Ce que nous conservons</H>
      <L
        items={[
          "Compte : adresse e-mail, nom affiché, empreinte du mot de passe (ou l’identifiant issu de la connexion Google/Apple/Discord), secret de la validation en deux étapes.",
          "Profils : noms, avatars, préférences de langue et de région (langues audio et de sous-titres, studios de doublage préférés), empreintes des PIN.",
          "Votre bibliothèque : listes, liste À regarder, favoris, notes, historique et positions de lecture – par profil.",
          "Recommandations : ce qu’un profil leur indique (J’aime, « Pas intéressé » avec sa raison, « Ne pas utiliser », genres et personnes à exclure, réglages) et, tant que « Utiliser les pages ouvertes » est activé, les pages de titres sur lesquelles il est resté quelques secondes (le titre et le jour, conservés 180 jours). Paramètres → Recommandations les affiche et permet d’en supprimer une ou toutes ; elles figurent dans votre export de données et sont supprimées avec le profil.",
          "Connexions aux serveurs multimédias : adresse du serveur et jeton d’accès, chiffrés au repos (AES-256-GCM). La vidéo ne passe jamais par nos serveurs. Un TorrServer que vous connectez peut être interrogé pour trouver des releases depuis votre propre appareil (vous pouvez le désactiver pour chaque serveur) ; nos serveurs ne voient jamais les recherches ni la liste des releases. Pour un titre de votre liste À regarder, votre appareil conserve avec votre profil uniquement la langue audio, le type de traduction, le studio de doublage et la qualité d’image de la meilleure release (aucun lien, empreinte de fichier ou tracker), pour que vos autres appareils l’affichent aussi ; ces informations figurent dans votre export de données et sont supprimées avec le profil.",
          "Données de sécurité : sessions actives avec l’user-agent du navigateur, l’adresse IP et le type d’appareil (le site, l’application installée ou un téléviseur), compteurs de limitation des requêtes, journal d’audit des actions des administrateurs.",
          "Demandes au support : le sujet, vos messages et les réponses du support, l’e-mail pour la réponse et — seulement si vous cochez « Joindre un résumé technique » — votre navigateur (user-agent), la taille de l’écran, la langue, si l’application installée est ouverte et le dernier échec du lecteur dans ce navigateur (sans adresses de serveurs, mots de passe ni titres ; jusqu’à l’envoi, il reste uniquement dans votre navigateur). Les réponses arrivent par e-mail via Resend ; sans connexion, le formulaire peut être protégé par Cloudflare Turnstile. Les demandes fermées sont supprimées 12 mois après leur fermeture, celles d’un compte avec le compte.",
          "Imports : les fichiers que vous envoyez sont analysés et les lignes rapprochées sont conservées ; vous pouvez annuler un import.",
          "Décomptes anonymes des rangées : combien de fois les cartes des rangées d’une page sont vues et ouvertes, et si un ajout à À regarder ou une lecture a suivi – comptés par jour, page, rangée et position, et selon que le visiteur était connecté ou non. Aucun compte, profil, titre, cookie ni stockage de l’appareil n’est utilisé, et rien n’est compté quand votre navigateur envoie Do Not Track ou Global Privacy Control.",
          "Compteurs d’utilisation nécessaires au service : combien de comptes ont été actifs chaque jour, combien sur une TV et dans l’application installée, et — pour chaque semaine d’inscription — combien de ces comptes sont revenus chaque semaine suivante (comptés avec des sketches HyperLogLog, dont on ne peut extraire personne) ; combien de recherches ont atteint notre serveur et combien n’ont rien trouvé ; les démarrages et échecs du lecteur par mode de lecture, avec le temps jusqu’à la première image ; le nombre de requêtes et d’erreurs du serveur, aussi par heure. Les mots d’une recherche qui n’a rien trouvé ne sont conservés que si au moins cinq personnes différentes les ont cherchés le même jour, et jamais avec Do Not Track ou Global Privacy Control ; d’ici là, ils restent au plus 35 jours sur notre serveur. Seuls les totaux sont conservés, 13 mois ; aucun titre ni historique n’y est rattaché.",
          "Trakt ou Simkl, si vous en liez un à un profil : le nom du compte et sa connexion (jetons d’accès et d’actualisation, chiffrés au repos avec AES-256-GCM), ce que vous avez choisi de synchroniser, les horodatages de dernière activité du service et un relevé de ce que Lumovio y a déjà envoyé.",
          "Discord, si vous connectez un salon dans Paramètres → Notifications : l’URL du webhook du salon (chiffrée au repos avec AES-256-GCM) et son nom.",
        ]}
      />
      <H>Ce qui est privé par défaut</H>
      <P>
        L’historique, la progression de lecture, les serveurs connectés et les données personnelles ne sont jamais publics. Les profils publics n’affichent que ce que vous choisissez
        (favoris, listes choisies, notes).
      </P>
      <H>Sous-traitants</H>
      <L
        items={[
          "Cloudflare – DNS, TLS et proxy des requêtes.",
          "Resend – e-mails transactionnels (vérification, réinitialisation du mot de passe, notifications facultatives).",
          "TMDB – données du catalogue ; les requêtes sont faites par notre serveur et ne contiennent aucune donnée personnelle.",
          "MDBList, OMDb, Wikidata, TVmaze et AniList – notes et liens croisés des titres, et horaires de diffusion des épisodes (TVmaze) ; notre serveur les interroge uniquement par identifiant de titre, sans donnée personnelle.",
          "fanart.tv – logos et arrière-plans : notre serveur les demande par identifiant de titre ; votre navigateur charge ensuite les images depuis le CDN de fanart.tv, comme pour celles de TMDB.",
          "MusicBrainz et Wikidata – albums de bandes originales, demandés par notre serveur par identifiant de titre ; les pochettes se chargent dans votre navigateur depuis le Cover Art Archive (archive.org).",
          "Spotify – uniquement si vous appuyez sur « Écouter sur Spotify » sur la page d’un titre : le lecteur de Spotify se charge alors depuis Spotify, selon les conditions et la politique de confidentialité de Spotify. Rien n’est chargé depuis Spotify avant cela.",
          "MDBList – pour les listes que vous suivez, notre serveur récupère cette liste publique par son adresse une fois par jour ; rien vous concernant n’est envoyé. Arrêtez de la suivre depuis la page de la liste ; ses titres restent.",
          "Trakt et Simkl – uniquement pour un profil que vous liez dans Paramètres → Trakt et Simkl. Notre serveur lit l’historique, les notes et la liste de ce compte (selon vos choix) pendant que vous utilisez Lumovio. Il n’écrit sur le service que ce que vous activez : les lectures, notes et ajouts à la liste faits dans Lumovio après l’activation, les plus anciens seulement quand vous appuyez sur « Envoyer l’existant », et – avec le scrobbling activé – ce que vous lancez, mettez en pause et terminez dans le lecteur de Lumovio (titre, épisode, progression). Rien n’est jamais supprimé sur le service. La déconnexion (ou la suppression de votre compte ou du profil) demande au service de révoquer la connexion de Lumovio et l’efface ici ; ce qui a été importé reste jusqu’à ce que vous annuliez l’import.",
          "Discord – uniquement si vous connectez un salon dans Paramètres → Notifications : notre serveur y publie les nouveaux épisodes des séries que vous suivez (la série, la saison et l’épisode, le titre de l’épisode). À la déconnexion, son adresse est effacée ici.",
          "OpenAI – uniquement quand vous utilisez la recherche par IA : le texte de votre requête (et, si vous l’acceptez, des titres et genres de votre historique). Jamais votre e-mail ni vos serveurs.",
          "Notre hébergeur (un serveur virtuel) – fait tourner le service et la base de données ; les sauvegardes vont vers un stockage objet chiffré (Cloudflare R2).",
        ]}
      />
      <H>Cookies</H>
      <P>Uniquement des cookies essentiels : votre session, la langue choisie, le thème et le mode TV. Aucun cookie publicitaire ou de mesure d’audience.</P>
      <H>Conservation</H>
      <P>
        Les données sont conservées tant que votre compte existe. La suppression de votre compte efface tous les profils, l’historique et les connexions ; les sauvegardes chiffrées sont
        renouvelées sous 30 jours.
      </P>
      <H>Vos droits</H>
      <P>
        Vous pouvez consulter, exporter (JSON), corriger et supprimer vos données vous-même dans les Paramètres. Pour toute autre demande, écrivez à {LEGAL_CONTACT}.
      </P>
    </>
  ),
  credits: () => (
    <>
      <H>Données</H>
      <TmdbMark />
      <P>
        Ce produit utilise l’API de TMDB mais n’est ni approuvé ni certifié par TMDB. Métadonnées des films et séries, images et données sur les personnes © leurs propriétaires respectifs,
        fournies par <A href="https://www.themoviedb.org">The Movie Database (TMDB)</A>.
      </P>
      <P>
        Certains logos et arrière-plans de titres proviennent de <A href="https://fanart.tv">fanart.tv</A> et sont réalisés par sa communauté ; quand fanart.tv indique un titulaire de
        droits, celui-ci est cité dans les Détails du titre. Lumovio les utilise quand TMDB n’a pas de logo dans votre langue, ou pas d’arrière-plan.
      </P>
      <P>
        Les albums de bandes originales proviennent de <A href="https://musicbrainz.org">MusicBrainz</A> (données principales CC0) et de Wikidata, uniquement quand l’un d’eux relie
        l’album au titre ; les pochettes, du <A href="https://coverartarchive.org">Cover Art Archive</A>. Le lecteur est l’intégration officielle de Spotify.
      </P>
      <P>Lumovio utilise Trakt mais n’est ni approuvé ni certifié par Trakt. La liaison avec Simkl utilise l’API de Simkl ; Lumovio n’est pas affilié à Simkl.</P>
      <P>
        La disponibilité en streaming est fournie par <A href="https://www.justwatch.com">JustWatch</A> via TMDB.
      </P>
      <P>
        Notes IMDb :{" "}
        <span lang="en">
          Information courtesy of IMDb (<A href="https://www.imdb.com">https://www.imdb.com</A>). Used with permission.
        </span>{" "}
        Elles proviennent du jeu de données des notes d’IMDb, chargé chaque jour et affiché avec sa date.
      </P>
      <P>
        Les notes Rotten Tomatoes (Tomatometer et Popcornmeter), Metacritic, Letterboxd, Trakt et MyAnimeList, ainsi que les notes IMDb des titres absents de ce jeu de données,
        proviennent de <A href="https://mdblist.com">MDBList</A> (datées de la dernière mise à jour du titre sur MDBList), de l’<A href="https://www.omdbapi.com">API OMDb</A> (CC BY-NC
        4.0) ou d’instantanés datés de <A href="https://www.wikidata.org">Wikidata</A> (CC0), qui fournit aussi les liens croisés ; les données des séries, de{" "}
        <A href="https://www.tvmaze.com">TVmaze</A> (CC BY-SA 4.0) ; les données des animes, d’<A href="https://anilist.co">AniList</A>. Chaque note est affichée avec sa source et
        renvoie vers elle. Les noms et logos d’IMDb, Rotten Tomatoes, Metacritic, Letterboxd, Trakt, Kinopoisk, MyAnimeList, AniList, TVmaze et TMDB sont des marques de leurs
        propriétaires, utilisées uniquement pour identifier la source ; Lumovio n’est ni affilié à eux ni approuvé par eux.
      </P>
      <P>
        Les symboles à côté de vos serveurs en indiquent le type : le logo de <A href="https://jellyfin.org">Jellyfin</A> est © les contributeurs de Jellyfin, sous licence{" "}
        <A href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</A> ; <A href="https://www.plex.tv">Plex</A> est une marque de Plex, Inc. ; l’icône de{" "}
        <A href="https://github.com/YouROK/TorrServer">TorrServer</A> appartient au projet TorrServer. Lumovio n’est ni affilié à eux ni approuvé par eux.
      </P>
      <P>
        Les symboles des sources d’import de l’historique indiquent d’où vient un fichier : Trakt, Simkl, IMDb, Letterboxd, Netflix et Stremio sont des marques de leurs propriétaires ;
        l’icône de <A href="https://github.com/yumata/lampa">Lampa</A> provient du projet Lampa, sous licence{" "}
        <A href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL-2.0</A>. Lumovio n’est ni affilié à eux ni approuvé par eux.
      </P>
      <P>
        Les marques de la fenêtre de partage indiquent où va un lien : Telegram, WhatsApp, X, Facebook et Reddit sont des marques de leurs propriétaires, dessinées d’après <A href="https://simpleicons.org">Simple Icons</A> (CC0). Lumovio n’est ni affilié à ces services ni approuvé par eux.
      </P>
      <P>
        Le Lumovio Score est le score dérivé propre à Lumovio, calculé à partir des notes IMDb, TMDB, Rotten Tomatoes, Metacritic, Letterboxd, Trakt et MyAnimeList ci-dessus (TVmaze et
        AniList n’en font pas partie). Aucun de ces services ne le publie ni ne l’approuve ; son fonctionnement est décrit ci-dessous.
      </P>
      <ScoreMethodology locale="fr" />
      <H>Logiciels libres</H>
      <L
        items={[
          "Video.js 10 (Apache-2.0)",
          "Next.js, React (MIT)",
          "Fastify, Drizzle ORM, BullMQ (MIT)",
          "Better Auth (MIT)",
          "hls.js (Apache-2.0)",
          "Mediabunny (MPL-2.0) avec les décodeurs AC-3/E-AC-3 et DTS et l’encodeur AAC de FFmpeg (LGPL-2.1 ou ultérieure ; source sur ffmpeg.org) : dans votre navigateur, il réempaquette les fichiers que le navigateur ne sait pas ouvrir lui-même",
          <>
            FFmpeg (LGPL-2.1 ou ultérieure) : les décodeurs audio (Dolby TrueHD, MP3, FLAC, Vorbis, AC-3, MP2) et vidéo (MPEG-4 Part 2 – Xvid et DivX, MPEG-1/2, H.263) du lecteur de
            Lumovio sont compilés en WebAssembly à partir de la version 8.0.3, sans parties GPL –{" "}
            <A href="https://github.com/FFmpeg/FFmpeg/tree/n8.0.3">source de cette version</A> ; le script de compilation est scripts/player-codecs dans le code source de Lumovio, et
            /codecs/audio.* et /codecs/video.* peuvent être remplacés par votre propre compilation
          </>,
          <>
            <A href="https://github.com/ThaUnknown/jassub">JASSUB</A> (MIT) avec libass (ISC), FreeType (FTL), HarfBuzz (MIT) et FriBidi (LGPL-2.1 ou ultérieure ;{" "}
            <A href="https://github.com/fribidi/fribidi">source</A>) – sous-titres ASS/SSA avec leur mise en forme ; police Liberation Sans (SIL OFL 1.1)
          </>,
          "Préparation des flux sur le serveur de Lumovio (quand elle est activée) : FFmpeg avec x264 (GPL-2.0 ou ultérieure) dans une image Alpine Linux",
          "Radix UI, Lucide (MIT / ISC)",
          "Police Manrope (SIL OFL 1.1)",
        ]}
      />
      <P>Le client web de Lumovio est open source, sous licence Apache License 2.0.</P>
    </>
  ),
  copyright: () => (
    <>
      <P>
        Lumovio n’héberge ni films ni séries. La lecture se fait depuis des serveurs que les utilisateurs connectent eux-mêmes. Si vous estimez qu’un contenu rendu accessible via Lumovio
        (par exemple dans une liste publique ou un profil public) porte atteinte à vos droits, envoyez un signalement ci-dessous. Nous examinons chaque signalement et y répondons.
      </P>
      <RightsNoticeForm />
    </>
  ),
};
