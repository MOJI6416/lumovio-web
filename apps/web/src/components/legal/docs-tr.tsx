import type { ReactNode } from "react";
import { A, H, L, LEGAL_CONTACT, type LegalDoc, P, ScoreMethodology, TmdbMark } from "./parts";
import { RightsNoticeForm } from "./RightsNoticeForm";

/**
 * The legal pages in Turkish — a translation (owner's decision 1.3, L10N-01): the English version has legal force, and the
 * page says so with a link to it. "siz" as everywhere in the Turkish interface (glossary-tr.md); names of services, licences
 * and IMDb's required attribution stay as they are.
 */
export const DOCS_TR: Record<LegalDoc, () => ReactNode> = {
  terms: () => (
    <>
      <P>Lumovio ücretsiz bir katalog, kişisel kitaplık ve medya merkezidir. Hesap oluşturarak bu koşulları kabul etmiş olursunuz.</P>
      <H>Lumovio nedir, ne değildir</H>
      <P>
        Lumovio filmler ve diziler hakkında bilgi gösterir (TMDB’den), listelerinizi ve geçmişinizi saklar ve kendi bağladığınız sunuculardan (Jellyfin, Plex, TorrServer) video
        oynatmanızı sağlar. Lumovio film barındırmaz, satmaz veya dağıtmaz; sunucuları da video akışlarınızı aktarmaz.
      </P>
      <H>Sorumluluklarınız</H>
      <L
        items={[
          "Yalnızca kullanma hakkınız olan sunucuları ve içerikleri bağlayabilirsiniz. Kendi medya sunucularınıza ve torrent istemcilerinize eklediklerinizden siz sorumlusunuz.",
          "Lumovio’yu telif haklarını ihlal etmek, başkalarını taciz etmek, spam göndermek, hizmetten otomatik veri toplamak (scraping) veya altyapısına saldırmak için kullanmayın.",
          "Herkese açık profiller ve herkese açık listeler yasa dışı, nefret içeren veya yanıltıcı içerik barındıramaz.",
          "Giriş bilgilerinizi güvende tutun. İki adımlı doğrulamayı öneririz.",
        ]}
      />
      <H>Hesaplar ve profiller</H>
      <P>
        Bir hesabın birden fazla profili olabilir. Çocuk profilleri içerikleri yaş sınıflandırmasına göre kısıtlar; sınıflandırmalar üçüncü taraf verilerinden gelir ve eksik olabilir,
        bu yüzden küçük çocuklara göz kulak olun.
      </P>
      <H>Ücretsiz hizmet, garanti yok</H>
      <P>
        Lumovio ücretsiz ve “olduğu gibi” sunulur. Özellikler değişebilir. Bu koşulları ihlal eden hesapları askıya alabiliriz. Yüksek erişilebilirlik hedefliyoruz, ancak bunu garanti
        etmiyoruz.
      </P>
      <H>Üçüncü taraf hizmetler</H>
      <P>
        Meta veriler TMDB’den, yayın platformlarındaki erişilebilirlik bilgileri TMDB üzerinden JustWatch’tan gelir; oturum açmak için Google, Apple veya Discord kullanılabilir. Bu
        hizmetler için kendi koşulları geçerlidir.
      </P>
      <H>Sona erdirme</H>
      <P>Verilerinizi istediğiniz zaman Ayarlar → Gizlilik ve veriler bölümünden dışa aktarabilir ve hesabınızı silebilirsiniz.</P>
      <H>İletişim</H>
      <P>{LEGAL_CONTACT}</P>
    </>
  ),
  privacy: () => (
    <>
      <P>Lumovio’yu çalıştırmak için gereken en az veriyi toplarız ve kişisel verileri asla satmayız. Reklam ve üçüncü taraf izleyici yoktur.</P>
      <H>Neleri saklıyoruz</H>
      <L
        items={[
          "Hesap: e-posta adresi, görünen ad, şifre özeti (hash) (veya Google/Apple/Discord ile oturum açmadan gelen kimlik), iki adımlı doğrulama anahtarı.",
          "Profiller: adlar, avatarlar, dil ve bölge tercihleri (ses ve altyazı dilleri, tercih edilen dublaj stüdyoları), PIN özetleri.",
          "Kitaplığınız: listeler, İzlenecekler, Favoriler, puanlar, izleme geçmişi ve oynatma konumları – her profil için ayrı.",
          "Öneriler: bir profilin onlara bildirdikleri (beğeniler, nedeniyle birlikte “İlgilenmiyorum”, “Dikkate alma”, dışarıda bırakılacak türler ve kişiler, ayarlar) ve “Açılan sayfaları kullan” açıkken profilin hangi içerik sayfalarında birkaç saniye kaldığı (içerik ve gün, 180 gün saklanır). Ayarlar → Öneriler bunları gösterir ve tek tek ya da hepsini birden kaldırmanıza olanak tanır; veri dışa aktarımınızda yer alırlar ve profille birlikte silinirler.",
          "Sunucu bağlantıları: sunucu adresi ve bir erişim token’ı, şifrelenmiş olarak saklanır (AES-256-GCM). Video asla sunucularımızdan geçmez. Bağladığınız bir TorrServer’da kendi cihazınızdan sürüm araması yapılabilir (bunu her sunucu için kapatabilirsiniz); sunucularımız aramaları veya sürüm listesini asla görmez. İzlenecekler listenizdeki bir içerik için cihazınız profilinizde yalnızca en iyi sürümün ses dilini, çeviri türünü, dublaj stüdyosunu ve görüntü kalitesini saklar (bağlantılar, dosya özetleri veya tracker’lar olmadan), böylece diğer cihazlarınız da bunu gösterir; bu bilgiler veri dışa aktarımınızda yer alır ve profille birlikte silinir.",
          "Güvenlik verileri: tarayıcının kullanıcı aracısı (user-agent), IP adresi ve cihaz türüyle (site, yüklü uygulama veya TV) etkin oturumlar, istek sınırlama sayaçları, yönetici işlemlerinin denetim günlüğü.",
          "Destek talepleri: konu, mesajlarınız ve destek yanıtları, yanıt için e-posta ve — yalnızca “Teknik özet ekle” kutusunu işaretlerseniz — tarayıcınız (user-agent), ekran boyutu, dil, yüklü uygulamanın açık olup olmadığı ve oynatıcının bu tarayıcıdaki son hatası (sunucu adresleri, şifreler ve adlar olmadan; gönderene kadar yalnızca tarayıcınızda kalır). Yanıtlar Resend üzerinden e-postayla gelir; giriş yapmadan kullanılan form Cloudflare Turnstile ile korunabilir. Kapatılan talepler kapatıldıktan 12 ay sonra, bir hesabın talepleri hesapla birlikte silinir.",
          "İçe aktarmalar: yüklediğiniz dosyalar işlenir ve eşleşen satırlar saklanır; bir içe aktarmayı geri alabilirsiniz.",
          "Sıraların anonim sayımları: bir sayfanın sıralarındaki kartların ne sıklıkla görüntülendiği ve açıldığı, ardından İzleneceklere ekleme veya oynatma olup olmadığı – gün, sayfa, sıra ve konuma göre ve ziyaretçinin oturum açmış olup olmadığına göre sayılır. Hesap, profil, içerik, çerez veya cihaz depolaması kullanılmaz; tarayıcınız Do Not Track veya Global Privacy Control gönderdiğinde hiçbir şey sayılmaz.",
          "Hizmetin işlemesi için kullanım sayıları: her gün kaç hesabın etkin olduğu, bunların kaçının TV’de ve yüklü uygulamada olduğu ve her kayıt haftası için o hesaplardan kaçının sonraki her haftada geri döndüğü (kimin olduğu çıkarılamayan HyperLogLog taslaklarıyla sayılır); sunucumuza kaç aramanın ulaştığı ve kaçının sonuç bulamadığı; oynatma yöntemine göre oynatıcının başlatmaları ve hataları, ilk kareye kadar geçen süreyle birlikte; sunucunun istek ve hata sayıları, saat bazında da. Sonuç bulamayan bir aramanın kelimeleri yalnızca aynı gün en az beş farklı kişi tarafından arandıysa saklanır, Do Not Track veya Global Privacy Control sinyali varken asla; o zamana kadar sunucumuzda en fazla 35 gün kalır. Yalnızca toplamlar 13 ay saklanır; bunlara hiçbir başlık ya da geçmiş bağlanmaz.",
          "Trakt veya Simkl, birini bir profile bağlarsanız: hesap adı ve oradaki oturum (erişim ve yenileme token’ları, AES-256-GCM ile şifrelenmiş olarak saklanır), senkronizasyon için seçtikleriniz, hizmetteki son etkinlik zaman damgaları ve Lumovio’nun oraya zaten gönderdiklerinin kaydı.",
          "Discord, Ayarlar → Bildirimler’de bir kanal bağlarsanız: kanalın webhook URL’si (AES-256-GCM ile şifrelenerek saklanır) ve adı.",
        ]}
      />
      <H>Varsayılan olarak gizli olanlar</H>
      <P>
        İzleme geçmişi, oynatma ilerlemesi, bağlı sunucular ve kişisel veriler asla herkese açık değildir. Herkese açık profiller yalnızca sizin paylaşmayı seçtiklerinizi gösterir
        (Favoriler, seçilen listeler, puanlar).
      </P>
      <H>Veri işleyenler</H>
      <L
        items={[
          "Cloudflare – DNS, TLS ve isteklerin aktarılması (proxy).",
          "Resend – işlemsel e-postalar (doğrulama, şifre sıfırlama, isteğe bağlı bildirimler).",
          "TMDB – katalog verileri; istekleri sunucumuz yapar ve kişisel veri içermez.",
          "MDBList, OMDb, Wikidata, TVmaze ve AniList – içerikler için puanlar ve çapraz bağlantılar ile bölüm yayın saatleri (TVmaze); sunucumuz yalnızca içerik kimliğiyle sorar, kişisel veri göndermez.",
          "fanart.tv – logolar ve arka planlar: sunucumuz içerik kimliğiyle sorar; ardından tarayıcınız görselleri TMDB’de olduğu gibi fanart.tv’nin CDN’inden yükler.",
          "MusicBrainz ve Wikidata – sunucumuzun içerik kimliğiyle sorduğu film müziği albümleri; albüm kapaklarını tarayıcınız Cover Art Archive’dan (archive.org) yükler.",
          "Spotify – yalnızca bir içerik sayfasında “Spotify’da dinle” düğmesine basarsanız: o zaman Spotify’ın kendi oynatıcısı Spotify’ın koşulları ve gizlilik politikası çerçevesinde Spotify’dan yüklenir. Bundan önce Spotify’dan hiçbir şey yüklenmez.",
          "MDBList – takip ettiğiniz listeler için sunucumuz bu herkese açık listeyi günde bir kez adresinden alır; sizinle ilgili hiçbir şey gönderilmez. Takibi listenin sayfasından bırakabilirsiniz; içerikleri kalır.",
          "Trakt ve Simkl – yalnızca Ayarlar → Trakt ve Simkl bölümünden bağladığınız profil için. Lumovio’yu kullandığınız sırada sunucumuz bu hesabın izleme geçmişini, puanlarını ve izleme listesini (seçiminize göre) okur. Hizmete yalnızca açtıklarınızı yazar: bundan sonra Lumovio’da yapılan izlemeler, puanlar ve izleme listesine eklemeler, daha eskileri yalnızca “Mevcut olanları gönder…” düğmesine bastığınızda ve – scrobble açıkken – Lumovio oynatıcısında başlattığınız, duraklattığınız ve bitirdiğiniz şeyler (içerik, bölüm, ilerleme). Hizmette asla hiçbir şey silinmez. Bağlantıyı kesmek (veya hesabınızı ya da profili silmek) hizmetten Lumovio’nun oturumunu iptal etmesini ister ve oturumu bizde siler; içe aktarılanlar, içe aktarmayı geri alana kadar kalır.",
          "Discord – yalnızca Ayarlar → Bildirimler’de bir kanal bağlarsanız: sunucumuz takip ettiğiniz dizilerin yeni bölümlerini oraya gönderir (dizi, sezon ve bölüm, bölümün adı). Bağlantıyı kestiğinizde adres burada silinir.",
          "OpenAI – yalnızca yapay zekâ aramasını kullandığınızda: sorgunuzun metni (ve izin verirseniz geçmişinizdeki içerik adları/türler). Asla e-postanız veya sunucularınız değil.",
          "Barındırma sağlayıcımız (bir sanal sunucu) – hizmeti ve veritabanını çalıştırır; yedekler şifrelenmiş nesne depolamasına (Cloudflare R2) gider.",
        ]}
      />
      <H>Çerezler</H>
      <P>Yalnızca zorunlu çerezler: oturumunuz, seçtiğiniz dil, tema ve TV modu. Reklam veya analiz çerezi yoktur.</P>
      <H>Saklama süresi</H>
      <P>
        Veriler hesabınız var olduğu sürece saklanır. Hesabınızı silmek tüm profilleri, geçmişi ve bağlantıları kaldırır; şifrelenmiş yedekler 30 gün içinde yenileriyle
        değiştirilir.
      </P>
      <H>Haklarınız</H>
      <P>Verilerinize Ayarlar’dan kendiniz erişebilir, onları dışa aktarabilir (JSON), düzeltebilir ve silebilirsiniz. Diğer her şey için {LEGAL_CONTACT} adresine yazın.</P>
    </>
  ),
  credits: () => (
    <>
      <H>Veriler</H>
      <TmdbMark />
      <P>
        Bu ürün TMDB API’sini kullanır ancak TMDB tarafından onaylanmış veya sertifikalandırılmış değildir. Film ve dizi meta verileri, görseller ve kişi verileri © ilgili hak
        sahipleri, sağlayan: <A href="https://www.themoviedb.org">The Movie Database (TMDB)</A>.
      </P>
      <P>
        Bazı içerik logoları ve arka planlar <A href="https://fanart.tv">fanart.tv</A> sitesinden gelir ve topluluğu tarafından hazırlanmıştır; fanart.tv bir hak sahibi kaydetmişse
        bu, içeriğin “Ayrıntılar” bölümünde belirtilir. Lumovio bunları, TMDB’de sizin dilinizde logo veya arka plan görseli olmadığında kullanır.
      </P>
      <P>
        Film müziği albümleri <A href="https://musicbrainz.org">MusicBrainz</A> (temel veriler CC0) ve Wikidata’dan, yalnızca bunlardan biri albümü içerikle ilişkilendirdiğinde
        gelir; kapaklar <A href="https://coverartarchive.org">Cover Art Archive</A> kaynağındandır. Oynatıcı, Spotify’ın resmî gömülü oynatıcısıdır.
      </P>
      <P>Lumovio Trakt’ı kullanır ancak Trakt tarafından onaylanmış veya sertifikalandırılmış değildir. Simkl bağlantısı Simkl API’sini kullanır; Lumovio’nun Simkl ile bir bağı yoktur.</P>
      <P>
        Yayın platformlarındaki erişilebilirlik bilgilerini TMDB üzerinden <A href="https://www.justwatch.com">JustWatch</A> sağlar.
      </P>
      <P>
        IMDb puanları:{" "}
        <span lang="en">
          Information courtesy of IMDb (<A href="https://www.imdb.com">https://www.imdb.com</A>). Used with permission.
        </span>{" "}
        Bu puanlar her gün yüklenen IMDb puan veri setinden gelir ve onun tarihiyle gösterilir.
      </P>
      <P>
        Rotten Tomatoes (Tomatometer ve Popcornmeter), Metacritic, Letterboxd, Trakt ve MyAnimeList puanları ile bu veri setinde olmayan içeriklerin IMDb puanları{" "}
        <A href="https://mdblist.com">MDBList</A> (içeriğin MDBList’teki son güncelleme tarihiyle), <A href="https://www.omdbapi.com">OMDb API</A> (CC BY-NC 4.0) veya{" "}
        <A href="https://www.wikidata.org">Wikidata</A> (CC0) üzerindeki tarihli kayıtlardan gelir; çapraz bağlantılar da Wikidata’dandır. Dizi verileri{" "}
        <A href="https://www.tvmaze.com">TVmaze</A> (CC BY-SA 4.0), anime verileri <A href="https://anilist.co">AniList</A> kaynaklıdır. Her puan kaynağıyla birlikte gösterilir ve
        ona bağlantı verir. IMDb, Rotten Tomatoes, Metacritic, Letterboxd, Trakt, Kinopoisk, MyAnimeList, AniList, TVmaze ve TMDB adları ve logoları ilgili sahiplerinin ticari
        markalarıdır ve yalnızca kaynağı belirtmek için kullanılır; Lumovio’nun bunlarla bir bağı yoktur ve bunlar tarafından onaylanmamıştır.
      </P>
      <P>
        Sunucularınızın yanındaki simgeler türlerini gösterir: <A href="https://jellyfin.org">Jellyfin</A> logosu © Jellyfin katkıcılarına aittir ve{" "}
        <A href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</A> lisansıyla sunulur; <A href="https://www.plex.tv">Plex</A>, Plex, Inc. şirketinin ticari
        markasıdır; <A href="https://github.com/YouROK/TorrServer">TorrServer</A> simgesi TorrServer projesine aittir. Lumovio’nun bunlarla bir bağı yoktur ve bunlar tarafından
        onaylanmamıştır.
      </P>
      <P>
        Geçmiş içe aktarma kaynaklarının simgeleri bir dosyanın nereden geldiğini gösterir: Trakt, Simkl, IMDb, Letterboxd, Netflix ve Stremio ilgili sahiplerinin ticari
        markalarıdır; <A href="https://github.com/yumata/lampa">Lampa</A> simgesi Lampa projesinden gelir ve{" "}
        <A href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GPL-2.0</A> lisansıyla sunulur. Lumovio’nun bunlarla bir bağı yoktur ve bunlar tarafından onaylanmamıştır.
      </P>
      <P>
        Lumovio Score, Lumovio’nun yukarıdaki IMDb, TMDB, Rotten Tomatoes, Metacritic, Letterboxd, Trakt ve MyAnimeList puanlarından hesaplanan kendi türetilmiş puanıdır (TVmaze ve
        AniList dahil edilmez). Bu hizmetlerin hiçbiri onu yayınlamaz veya onaylamaz; nasıl çalıştığı aşağıda açıklanmıştır.
      </P>
      <ScoreMethodology locale="tr" />
      <H>Açık kaynak yazılımlar</H>
      <L
        items={[
          "Video.js 10 (Apache-2.0)",
          "Next.js, React (MIT)",
          "Fastify, Drizzle ORM, BullMQ (MIT)",
          "Better Auth (MIT)",
          "hls.js (Apache-2.0)",
          "Mediabunny (MPL-2.0), FFmpeg’in AC-3/E-AC-3 ve DTS kod çözücüleri ve AAC kodlayıcısıyla (LGPL-2.1 veya sonrası; kaynak kodu ffmpeg.org’da): tarayıcınızda, tarayıcının kendisinin açamadığı dosyaları yeniden paketler",
          <>
            FFmpeg (LGPL-2.1 veya sonrası): Lumovio oynatıcısının ses kod çözücüleri (Dolby TrueHD, MP3, FLAC, Vorbis, AC-3, MP2) ve video kod çözücüleri (MPEG-4 Part 2 – Xvid ve
            DivX, MPEG-1/2, H.263), GPL bileşenleri olmadan 8.0.3 sürümünden WebAssembly’ye derlenir –{" "}
            <A href="https://github.com/FFmpeg/FFmpeg/tree/n8.0.3">bu sürümün kaynak kodu</A>; derleme betiği Lumovio kaynak kodundaki scripts/player-codecs’tir ve /codecs/audio.*
            ile /codecs/video.* kendi derlemenizle değiştirilebilir
          </>,
          <>
            <A href="https://github.com/ThaUnknown/jassub">JASSUB</A> (MIT), libass (ISC), FreeType (FTL), HarfBuzz (MIT) ve FriBidi (LGPL-2.1 veya sonrası;{" "}
            <A href="https://github.com/fribidi/fribidi">kaynak kodu</A>) ile – biçimlendirmeleriyle ASS/SSA altyazıları; Liberation Sans yazı tipi (SIL OFL 1.1)
          </>,
          "Lumovio sunucusunda akış hazırlama (açıksa): Alpine Linux imajında x264 (GPL-2.0 veya sonrası) ile FFmpeg",
          "Radix UI, Lucide (MIT / ISC)",
          "Manrope yazı tipi (SIL OFL 1.1)",
        ]}
      />
      <P>Lumovio web istemcisi, Apache License 2.0 altında açık kaynaktır.</P>
    </>
  ),
  copyright: () => (
    <>
      <P>
        Lumovio film veya dizi barındırmaz. Oynatma, kullanıcıların kendi bağladıkları sunuculardan yapılır. Lumovio üzerinden erişilebilen içeriklerin (örneğin herkese açık bir
        listede veya profilde) haklarınızı ihlal ettiğini düşünüyorsanız aşağıdan bir bildirim gönderin. Her bildirimi inceler ve yanıtlarız.
      </P>
      <RightsNoticeForm />
    </>
  ),
};
