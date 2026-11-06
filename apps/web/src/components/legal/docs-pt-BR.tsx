import type { ReactNode } from "react";
import { A, H, L, LEGAL_CONTACT, type LegalDoc, P, ScoreMethodology, TmdbMark } from "./parts";
import { RightsNoticeForm } from "./RightsNoticeForm";

/**
 * The legal pages in Brazilian Portuguese — a translation (owner's decision 1.3, L10N-01): the English version has legal force,
 * and the page says so with a link to it. "você" as everywhere in the Brazilian interface (glossary-pt-BR.md); names of
 * services, licences and IMDb's required attribution stay as they are.
 */
export const DOCS_PT_BR: Record<LegalDoc, () => ReactNode> = {
  terms: () => (
    <>
      <P>O Lumovio é um catálogo gratuito, uma biblioteca pessoal e uma central de mídia. Ao criar uma conta, você concorda com estes termos.</P>
      <H>O que o Lumovio é — e o que não é</H>
      <P>
        O Lumovio mostra informações sobre filmes e séries (do TMDB), guarda suas listas e seu histórico e permite assistir a vídeos de servidores que você mesmo conecta (Jellyfin,
        Plex, TorrServer). O Lumovio não hospeda, vende nem distribui filmes, e os servidores dele não retransmitem seus streams de vídeo.
      </P>
      <H>Suas responsabilidades</H>
      <L
        items={[
          "Você só pode conectar servidores e conteúdos que tem o direito de usar. Você é responsável pelo que adiciona aos seus próprios servidores de mídia e clientes de torrent.",
          "Não use o Lumovio para violar direitos autorais, assediar outras pessoas, enviar spam, coletar dados do serviço de forma automatizada (scraping) ou atacar a infraestrutura dele.",
          "Perfis públicos e listas públicas não podem conter conteúdo ilegal, de ódio ou enganoso.",
          "Guarde suas credenciais em segurança. Recomendamos a verificação em duas etapas.",
        ]}
      />
      <H>Contas e perfis</H>
      <P>
        Uma conta pode ter vários perfis. Perfis infantis restringem o conteúdo pela classificação indicativa; as classificações vêm de dados de terceiros e podem estar incompletas,
        então supervisione as crianças pequenas.
      </P>
      <H>Serviço gratuito, sem garantias</H>
      <P>
        O Lumovio é oferecido gratuitamente, “no estado em que se encontra”. Os recursos podem mudar. Podemos suspender contas que descumpram estes termos. Buscamos alta
        disponibilidade, mas não a garantimos.
      </P>
      <H>Serviços de terceiros</H>
      <P>
        Os metadados vêm do TMDB; a disponibilidade em streaming, do JustWatch por meio do TMDB; o login pode usar Google, Apple ou Discord. Os termos próprios desses serviços se
        aplicam a eles.
      </P>
      <H>Encerramento</H>
      <P>Você pode exportar seus dados e excluir sua conta a qualquer momento em Configurações → Privacidade e dados.</P>
      <H>Contato</H>
      <P>{LEGAL_CONTACT}</P>
    </>
  ),
  privacy: () => (
    <>
      <P>Coletamos o mínimo necessário para o Lumovio funcionar e nunca vendemos dados pessoais. Não há anúncios nem rastreadores de terceiros.</P>
      <H>O que guardamos</H>
      <L
        items={[
          "Conta: endereço de e-mail, nome de exibição, hash da senha (ou o identificador do login com Google, Apple ou Discord) e o segredo da verificação em duas etapas.",
          "Perfis: nomes, avatares, preferências de idioma e região (idiomas de áudio e de legendas, estúdios de dublagem preferidos) e hashes dos PINs.",
          "Sua biblioteca: listas, Quero assistir, Favoritos, avaliações, histórico e posições de reprodução, por perfil.",
          "Recomendações: o que um perfil informa a elas (Gostei, “Não tenho interesse” com o motivo, “Não considerar”, gêneros e pessoas a deixar de fora, as configurações) e, enquanto “Usar páginas abertas” estiver ativado, em quais páginas de títulos ele ficou por alguns segundos (o título e o dia, guardados por 180 dias). Configurações → Recomendações mostra esses dados e permite remover um ou todos; eles estão na exportação dos seus dados e são excluídos com o perfil.",
          "Conexões com servidores de mídia: endereço do servidor e um token de acesso, criptografados em repouso (AES-256-GCM). O vídeo nunca passa pelos nossos servidores. Um TorrServer que você conectar pode ser usado para buscar releases a partir do seu próprio dispositivo (você pode desativar isso por servidor); nossos servidores nunca veem as buscas nem a lista de releases. Para um título em Quero assistir, seu dispositivo guarda com o seu perfil apenas o idioma do áudio, o tipo de tradução, o estúdio de dublagem e a qualidade de imagem do melhor release (sem links, hashes de arquivos ou trackers), para que seus outros dispositivos também o mostrem; isso está na exportação dos seus dados e é excluído com o perfil.",
          "Dados de segurança: sessões ativas com o user-agent do navegador, o endereço IP e o tipo de dispositivo (o site, o app instalado ou uma TV), contadores de limite de solicitações e um registro de auditoria das ações dos administradores.",
          "Solicitações ao suporte: o assunto, suas mensagens e as respostas do suporte, o e-mail para a resposta e — só se você marcar “Anexar um resumo técnico” — seu navegador (user-agent), o tamanho da tela, o idioma, se o app instalado está aberto e a última falha do player neste navegador (sem endereços de servidores, senhas ou títulos; até o envio, ela fica apenas no seu navegador). As respostas chegam por e-mail via Resend; sem login, o formulário pode ser protegido pelo Cloudflare Turnstile. Solicitações encerradas são excluídas 12 meses após o encerramento, e as de uma conta, junto com a conta.",
          "Importações: os arquivos que você envia são analisados e as linhas associadas são guardadas; você pode desfazer uma importação.",
          "Contagens anônimas das fileiras: com que frequência os cards das fileiras de uma página são vistos e abertos, e se depois o título foi adicionado a Quero assistir ou reproduzido — contadas por dia, página, fileira e posição, e se o visitante tinha entrado na conta. Nenhuma conta, perfil, título, cookie ou armazenamento do dispositivo é usado, e nada é contado quando seu navegador envia Do Not Track ou Global Privacy Control.",
          "Contagens de uso para manter o serviço: quantas contas estiveram ativas em cada dia, quantas numa TV e no app instalado e, para cada semana de cadastro, quantas dessas contas voltaram em cada semana seguinte (contadas com sketches HyperLogLog, dos quais não dá para listar ninguém); quantas buscas chegaram ao nosso servidor e quantas não encontraram nada; os inícios e falhas do player por método de reprodução, com o tempo até o primeiro quadro; e as requisições e erros do servidor, também por hora. As palavras de uma busca que não encontrou nada só são guardadas se pelo menos cinco pessoas diferentes as buscaram no mesmo dia, e nunca com Do Not Track ou Global Privacy Control; até lá ficam no nosso servidor por no máximo 35 dias. Só os totais são guardados, por 13 meses; nenhum título ou histórico fica ligado a eles.",
          "Velocidade das páginas: em quanto tempo uma página mostrou o conteúdo principal, quão rápido respondeu a um toque ou tecla e quanto se deslocou ao carregar (LCP, INP, CLS) — contado por dia, tipo de página (início, página de um título, busca…) e tipo de dispositivo (computador, celular, TV), sem sua conta, cookie ou endereço. Nada é enviado com Do Not Track ou Global Privacy Control. Guardado como totais diários por 13 meses.",
          "As imagens que você escolhe para a página de um título (um fundo e um logotipo, por perfil) e — só se você a adicionar — sua própria chave do fanart.tv, criptografada em repouso (AES-256-GCM); com ela nosso servidor pede ao fanart.tv as imagens desse título quando você abre a escolha.",
          "Trakt ou Simkl, se você vincular um deles a um perfil: o nome da conta e o login dela (tokens de acesso e de atualização, criptografados em repouso com AES-256-GCM), o que você escolheu sincronizar, os registros de data e hora da última atividade no serviço e um registro do que o Lumovio já enviou para lá.",
          "Discord, se você conectar um canal em Configurações → Notificações: a URL do webhook do canal (criptografada em repouso com AES-256-GCM) e o nome dele.",
        ]}
      />
      <H>O que é privado por padrão</H>
      <P>
        Histórico, progresso de reprodução, servidores conectados e dados pessoais nunca são públicos. Perfis públicos mostram apenas o que você escolher (Favoritos, listas
        escolhidas, avaliações).
      </P>
      <H>Operadores</H>
      <L
        items={[
          "Cloudflare — DNS, TLS e proxy das solicitações.",
          "Resend — e-mail transacional (verificação, redefinição de senha, notificações opcionais).",
          "TMDB — dados do catálogo; as solicitações são feitas pelo nosso servidor e não contêm dados pessoais.",
          "MDBList, OMDb, Wikidata, TVmaze e AniList — notas e links cruzados dos títulos e horários de exibição dos episódios (TVmaze); nosso servidor consulta apenas pelo identificador do título, sem dados pessoais.",
          "fanart.tv — logos e fundos: nosso servidor consulta pelo identificador do título; depois seu navegador carrega as imagens da CDN do fanart.tv, assim como as do TMDB.",
          "MusicBrainz e Wikidata — álbuns de trilhas sonoras, consultados pelo nosso servidor pelo identificador do título; as capas dos álbuns são carregadas no seu navegador a partir do Cover Art Archive (archive.org).",
          "Spotify — somente se você tocar em “Ouvir no Spotify” na página de um título: então o player do próprio Spotify é carregado do Spotify, sob os termos e a política de privacidade do Spotify. Antes disso, nada é carregado do Spotify.",
          "MDBList — para as listas que você segue, nosso servidor busca essa lista pública pelo endereço dela uma vez por dia; nada sobre você é enviado. Deixe de seguir na página da lista; os títulos dela continuam.",
          "Trakt e Simkl — somente para um perfil que você vincular em Configurações → Trakt e Simkl. Nosso servidor lê o histórico, as avaliações e a lista Quero assistir dessa conta (conforme sua escolha) enquanto você usa o Lumovio. No serviço, ele grava apenas o que você ativar: reproduções, avaliações e adições a Quero assistir feitas no Lumovio a partir de então, as anteriores somente quando você toca em “Enviar existentes” e — com o scrobbling ativado — o que você inicia, pausa e termina no player do Lumovio (título, episódio, progresso). Nada é excluído no serviço. Ao desconectar (ou ao excluir sua conta ou o perfil), pedimos ao serviço que revogue o acesso do Lumovio e o apagamos aqui; o que foi importado continua até você desfazer a importação.",
          "Discord — só se você conectar um canal em Configurações → Notificações: nosso servidor publica lá os novos episódios das séries que você segue (a série, a temporada e o episódio, o título do episódio). Ao desconectar, o endereço é apagado aqui.",
          "OpenAI — somente quando você usa a busca com IA: o texto da sua busca (e, se você permitir, títulos e gêneros do seu histórico). Nunca seu e-mail ou seus servidores.",
          "Nosso provedor de hospedagem (um servidor virtual) — executa o serviço e o banco de dados; os backups vão para um armazenamento de objetos criptografado (Cloudflare R2).",
        ]}
      />
      <H>Cookies</H>
      <P>Somente cookies essenciais: sua sessão, o idioma escolhido, o tema e o modo TV. Nenhum cookie de publicidade ou de análise.</P>
      <H>Retenção</H>
      <P>
        Os dados são mantidos enquanto sua conta existir. Excluir sua conta remove todos os perfis, o histórico e as conexões; os backups criptografados são substituídos em até 30
        dias.
      </P>
      <H>Seus direitos</H>
      <P>Você mesmo pode acessar, exportar (JSON), corrigir e excluir seus dados em Configurações. Para qualquer outra coisa, escreva para {LEGAL_CONTACT}.</P>
    </>
  ),
  credits: () => (
    <>
      <H>Dados</H>
      <TmdbMark />
      <P>
        Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB. Metadados, imagens e dados de pessoas de filmes e séries © de seus respectivos titulares,
        fornecidos por <A href="https://www.themoviedb.org">The Movie Database (TMDB)</A>.
      </P>
      <P>
        Alguns logos e fundos de títulos vêm do <A href="https://fanart.tv">fanart.tv</A> e foram criados pela comunidade dele; quando o fanart.tv registra um titular de direitos,
        ele é indicado nos Detalhes do título. O Lumovio os usa quando o TMDB não tem logo no seu idioma ou não tem imagem de fundo.
      </P>
      <P>
        Os álbuns de trilhas sonoras vêm do <A href="https://musicbrainz.org">MusicBrainz</A> (dados principais CC0) e do Wikidata, somente quando um deles vincula o álbum ao
        título; as capas, do <A href="https://coverartarchive.org">Cover Art Archive</A>. O player é o player incorporado oficial do Spotify.
      </P>
      <P>O Lumovio usa o Trakt, mas não é endossado nem certificado pelo Trakt. A vinculação com o Simkl usa a API do Simkl; o Lumovio não é afiliado ao Simkl.</P>
      <P>
        A disponibilidade em streaming é fornecida pelo <A href="https://www.justwatch.com">JustWatch</A> por meio do TMDB.
      </P>
      <P>
        Notas do IMDb:{" "}
        <span lang="en">
          Information courtesy of IMDb (<A href="https://www.imdb.com">https://www.imdb.com</A>). Used with permission.
        </span>{" "}
        Elas vêm do conjunto de dados de avaliações do IMDb, carregado diariamente, e são exibidas com a data dele.
      </P>
      <P>
        As notas de Rotten Tomatoes (Tomatometer e Popcornmeter), Metacritic, Letterboxd, Trakt e MyAnimeList, e as notas do IMDb dos títulos que faltam nesse conjunto de dados,
        vêm do <A href="https://mdblist.com">MDBList</A> (com a data da última atualização do título no MDBList), da <A href="https://www.omdbapi.com">API do OMDb</A> (CC BY-NC
        4.0) ou de instantâneos datados do <A href="https://www.wikidata.org">Wikidata</A> (CC0), que também fornece os links cruzados; os dados de TV, do{" "}
        <A href="https://www.tvmaze.com">TVmaze</A> (CC BY-SA 4.0); os dados de anime, do <A href="https://anilist.co">AniList</A>. Cada nota é exibida com sua fonte e leva a ela.
        Os nomes e logos de IMDb, Rotten Tomatoes, Metacritic, Letterboxd, Trakt, Kinopoisk, MyAnimeList, AniList, TVmaze e TMDB são marcas de seus titulares, usadas apenas para
        identificar a fonte; o Lumovio não é afiliado a eles nem endossado por eles.
      </P>
      <P>
        Os logos ao lado dos seus servidores indicam o tipo deles: o logo do <A href="https://jellyfin.org">Jellyfin</A> é © dos colaboradores do Jellyfin sob{" "}
        <A href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</A>; <A href="https://www.plex.tv">Plex</A> é uma marca da Plex, Inc.; o ícone do{" "}
        <A href="https://github.com/YouROK/TorrServer">TorrServer</A> pertence ao projeto TorrServer. O Lumovio não é afiliado a eles nem endossado por eles.
      </P>
      <P>
        Os logos das origens de importação do histórico indicam de onde vem um arquivo: Trakt, Simkl, IMDb, Letterboxd, Netflix e Stremio são marcas de seus titulares; o ícone do{" "}
        <A href="https://github.com/yumata/lampa">Lampa</A> vem do projeto Lampa sob <A href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL-2.0</A>. O Lumovio não é
        afiliado a eles nem endossado por eles.
      </P>
      <P>
        As marcas da janela de compartilhar indicam para onde vai um link: Telegram, WhatsApp, X, Facebook e Reddit são marcas registradas de seus donos, desenhadas a partir do <A href="https://simpleicons.org">Simple Icons</A> (CC0). O Lumovio não é afiliado a eles nem endossado por eles.
      </P>
      <P>
        O Lumovio Score é a nota derivada do próprio Lumovio, calculada a partir das notas de IMDb, TMDB, Rotten Tomatoes, Metacritic, Letterboxd, Trakt e MyAnimeList citadas acima
        (TVmaze e AniList não fazem parte dela). Nenhum desses serviços a publica ou a endossa; o funcionamento está explicado abaixo.
      </P>
      <ScoreMethodology locale="pt-BR" />
      <H>Software de código aberto</H>
      <L
        items={[
          "Video.js 10 (Apache-2.0)",
          "Next.js, React (MIT)",
          "Fastify, Drizzle ORM, BullMQ (MIT)",
          "Better Auth (MIT)",
          "hls.js (Apache-2.0)",
          "Mediabunny (MPL-2.0) com os decodificadores AC-3/E-AC-3 e DTS e o codificador AAC do FFmpeg (LGPL-2.1 ou posterior; código-fonte em ffmpeg.org): no seu navegador, ele reempacota arquivos que o navegador não consegue abrir sozinho",
          <>
            FFmpeg (LGPL-2.1 ou posterior): os decodificadores de áudio (Dolby TrueHD, MP3, FLAC, Vorbis, AC-3, MP2) e de vídeo (MPEG-4 Part 2 — Xvid e DivX, MPEG-1/2, H.263) do
            player do Lumovio são compilados para WebAssembly a partir da versão 8.0.3 sem partes GPL —{" "}
            <A href="https://github.com/FFmpeg/FFmpeg/tree/n8.0.3">código-fonte dessa versão</A>; o script de compilação é scripts/player-codecs no código-fonte do Lumovio, e
            /codecs/audio.* e /codecs/video.* podem ser substituídos pela sua própria compilação
          </>,
          <>
            <A href="https://github.com/ThaUnknown/jassub">JASSUB</A> (MIT) com libass (ISC), FreeType (FTL), HarfBuzz (MIT) e FriBidi (LGPL-2.1 ou posterior;{" "}
            <A href="https://github.com/fribidi/fribidi">código-fonte</A>) — legendas ASS/SSA com seu estilo; fonte Liberation Sans (SIL OFL 1.1)
          </>,
          "Preparação de streams no servidor do Lumovio (quando ativada): FFmpeg com x264 (GPL-2.0 ou posterior) em uma imagem Alpine Linux",
          "Radix UI, Lucide (MIT / ISC)",
          "Fonte Onest (SIL OFL 1.1)",
        ]}
      />
      <P>O cliente web do Lumovio é de código aberto sob a Licença Apache 2.0.</P>
    </>
  ),
  copyright: () => (
    <>
      <P>
        O Lumovio não hospeda filmes nem séries. A reprodução vem de servidores que os próprios usuários conectam. Se você acredita que um conteúdo disponibilizado por meio do Lumovio
        (por exemplo, em uma lista pública ou um perfil público) viola seus direitos, envie uma notificação abaixo. Analisamos cada notificação e respondemos.
      </P>
      <RightsNoticeForm />
    </>
  ),
};
