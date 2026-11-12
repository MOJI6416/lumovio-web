"use client";

import { Server } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BRAND_NAMES, BrandMark } from "@/components/media/BrandMark";
import { ScoreMark } from "@/components/media/ScoreBadge";
import { AccentBadge, AgeRating, MediaBadge, RatingChip, StatusBadge, Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilterChip, InputChip } from "@/components/ui/Chip";
import { Art, Cell, Demo, ShowcaseSection } from "./parts";

// Studio names are names, the same in every language.
const STUDIOS = ["A24", "Studio Ghibli", "HBO", "Kyoto Animation", "Warner Bros."];

function Chips() {
  const t = useTranslations("devUi");
  const genres = [
    { id: "drama", label: t("genreDrama"), count: 128 },
    { id: "comedy", label: t("genreComedy"), count: 96 },
    { id: "scifi", label: t("genreScifi"), count: 1250 },
    { id: "horror", label: t("genreHorror") },
  ];
  const [on, setOn] = useState<Set<string>>(new Set(["drama"]));
  const [onServer, setOnServer] = useState(false);
  const [studios, setStudios] = useState(STUDIOS);
  const toggle = (id: string) =>
    setOn((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <ShowcaseSection id="chips" title={t("chips")} source="ui/Chip.tsx">
      <Demo title="FilterChip" note={t("filterChipNote")} className="gap-2">
        {genres.map((g) => (
          <FilterChip key={g.id} selected={on.has(g.id)} count={g.count} onClick={() => toggle(g.id)}>
            {g.label}
          </FilterChip>
        ))}
        <FilterChip selected={onServer} icon={Server} onClick={() => setOnServer(!onServer)}>
          {t("onServer")}
        </FilterChip>
        <FilterChip selected={false} disabled>
          {t("genreHorror")}
        </FilterChip>
        <FilterChip selected disabled>
          {t("genreDrama")}
        </FilterChip>
      </Demo>
      <Demo title="InputChip" note={t("inputChipNote")} className="gap-2">
        {studios.map((s) => (
          <InputChip key={s} label={s} onRemove={() => setStudios(studios.filter((x) => x !== s))} />
        ))}
        <InputChip label={STUDIOS[0]!} onRemove={() => {}} disabled />
        {studios.length < STUDIOS.length && (
          <Button variant="tertiary" size="sm" onClick={() => setStudios(STUDIOS)}>
            {t("restoreAll")}
          </Button>
        )}
      </Demo>
    </ShowcaseSection>
  );
}

function Badges() {
  const t = useTranslations();
  return (
    <ShowcaseSection id="badges" title={t("devUi.badges")} source="ui/Badge.tsx">
      <Demo title="Tag">
        <Tag>{t("devUi.tagKids")}</Tag>
        <Tag>{t("devUi.tagYourLanguage")}</Tag>
      </Demo>
      <Demo title="StatusBadge" note={t("devUi.statusNote")}>
        <StatusBadge status="success">{t("connections.status_ok")}</StatusBadge>
        <StatusBadge status="warning">{t("connections.status_unknown")}</StatusBadge>
        <StatusBadge status="danger">{t("connections.status_unreachable")}</StatusBadge>
        <StatusBadge status="neutral">{t("devUi.statusQueued")}</StatusBadge>
      </Demo>
      <Demo title="AccentBadge" note={t("devUi.accentNote")}>
        <AccentBadge>{t("title.tsRecommended")}</AccentBadge>
        <AccentBadge>{t("devUi.badgeNew")}</AccentBadge>
      </Demo>
      <Demo title="MediaBadge · AgeRating · RatingChip" className="block">
        <Art>
          <MediaBadge>4K</MediaBadge>
          <MediaBadge>{t("devUi.badgeNewEpisode")}</MediaBadge>
          <MediaBadge>{t("devUi.onServer")}</MediaBadge>
          <AgeRating rating="16+" />
          <AgeRating rating="PG-13" />
          <RatingChip logo={<ScoreMark onDark />} source="Lumovio Score" value="87" />
          <RatingChip logo={<BrandMark brand="imdb" />} source={BRAND_NAMES.imdb} value={8} />
        </Art>
      </Demo>
      <Demo title={t("devUi.badgeWrap")} note={t("devUi.badgeWrapNote")} className="block">
        <Art className="w-40">
          <MediaBadge className="max-w-full">{t("devUi.badgeLong")}</MediaBadge>
        </Art>
      </Demo>
      <Demo title="AgeRating · RatingChip">
        <AgeRating rating="16+" />
        <RatingChip logo={<ScoreMark />} source="Lumovio Score" value="87" />
        <RatingChip logo={<BrandMark brand="imdb" />} source={BRAND_NAMES.imdb} value={7.85} />
        <Cell label={t("devUi.ratingString")}>
          <RatingChip logo={<BrandMark brand="rotten_tomatoes" />} source={BRAND_NAMES.rotten_tomatoes} value="92%" />
        </Cell>
      </Demo>
    </ShowcaseSection>
  );
}

export function ControlsChips() {
  return (
    <>
      <Chips />
      <Badges />
    </>
  );
}
