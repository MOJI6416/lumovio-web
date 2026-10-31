"use client";

import {
  ArrowLeft,
  Bookmark,
  CircleCheck,
  Ellipsis,
  Heart,
  type LucideIcon,
  Play,
  Search,
  Star,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { IconButton, type IconButtonSize, type IconButtonVariant } from "@/components/ui/IconButton";
import { Link } from "@/components/ui/Link";
import { Art, Cell, Demo, ShowcaseSection } from "./parts";

const SIZES: ButtonSize[] = ["sm", "md", "lg"];

function useSamples() {
  const t = useTranslations();
  return {
    primary: { icon: Play as LucideIcon | undefined, label: t("title.play") },
    secondary: { icon: Bookmark as LucideIcon | undefined, label: t("title.watchlistAdd") },
    tertiary: { icon: undefined, label: t("devUi.showAll") },
    danger: { icon: Trash2 as LucideIcon | undefined, label: t("library.deleteList") },
    "danger-tertiary": { icon: Trash2 as LucideIcon | undefined, label: t("settings.deleteAccount") },
  } satisfies Record<ButtonVariant, { icon: LucideIcon | undefined; label: string }>;
}

function Buttons() {
  const t = useTranslations("devUi");
  const samples = useSamples();
  const variants = Object.keys(samples) as ButtonVariant[];
  return (
    <ShowcaseSection id="button" title={t("button")} source="ui/Button.tsx · buttonClass() · 7.1">
      {variants.map((v) => (
        <Demo key={v} title={v} className="items-start">
          {SIZES.map((s) => (
            <Cell key={s} label={s}>
              <Button variant={v} size={s} icon={samples[v].icon}>
                {samples[v].label}
              </Button>
            </Cell>
          ))}
          <Cell label={t("stateDisabled")}>
            <Button variant={v} icon={samples[v].icon} disabled>
              {samples[v].label}
            </Button>
          </Cell>
          <Cell label={t("stateLoading")}>
            <Button variant={v} icon={samples[v].icon} loading>
              {samples[v].label}
            </Button>
          </Cell>
          <Cell label={t("stateLoadingNoIcon")}>
            <Button variant={v} loading>
              {samples[v].label}
            </Button>
          </Cell>
        </Demo>
      ))}
      <p className="max-w-measure text-body-s text-text-2">{t("statesNote")}</p>
      <Demo title={t("onStage")} note={t("onStageNote")} className="block">
        <Art>
          <Button variant="primary" size="lg" icon={Play}>
            {samples.primary.label}
          </Button>
          <Button variant="secondary" size="lg" icon={Bookmark}>
            {samples.secondary.label}
          </Button>
          <IconButton variant="stage" size="lg" icon={Ellipsis} label={t("more")} />
        </Art>
      </Demo>
      <StackedDemo />
    </ShowcaseSection>
  );
}

/** `layout="stacked"`: the title hero's row of labelled actions on a phone (10.1, X-44); resize to see it below md. */
function StackedDemo() {
  const t = useTranslations();
  return (
    <Demo title={'layout="stacked"'} note={t("devUi.stackedNote")} className="block">
      <div className="flex max-w-md gap-2">
        <Button variant="secondary" size="lg" layout="stacked" icon={Bookmark}>
          {t("title.watchlistAdd")}
        </Button>
        <Button variant="secondary" size="lg" layout="stacked" icon={Star}>
          {t("titlePage.rate")}
        </Button>
        <Button variant="secondary" size="lg" layout="stacked" icon={Ellipsis}>
          {t("devUi.more")}
        </Button>
      </div>
    </Demo>
  );
}

const ICON_SIZES: IconButtonSize[] = ["sm", "md", "lg"];

function IconButtons() {
  const t = useTranslations();
  const icons: { icon: LucideIcon; label: string }[] = [
    { icon: X, label: t("common.close") },
    { icon: ArrowLeft, label: t("common.back") },
    { icon: Search, label: t("common.search") },
    { icon: Ellipsis, label: t("devUi.more") },
  ];
  const plain: IconButtonVariant[] = ["ghost", "secondary"];
  return (
    <ShowcaseSection id="icon-button" title={t("devUi.iconButton")} source="ui/IconButton.tsx · 7.2">
      {plain.map((v) => (
        <Demo key={v} title={v} className="items-start">
          {ICON_SIZES.map((s) => (
            <Cell key={s} label={s}>
              <div className="flex gap-2">
                {icons.map((i) => (
                  <IconButton key={i.label} variant={v} size={s} icon={i.icon} label={i.label} />
                ))}
              </div>
            </Cell>
          ))}
          <Cell label={t("devUi.stateDisabled")}>
            <IconButton variant={v} icon={X} label={t("common.close")} disabled />
          </Cell>
        </Demo>
      ))}
      <Demo title="stage" note={t("devUi.iconStageNote")} className="block">
        <Art>
          {ICON_SIZES.map((s) => (
            <IconButton key={s} variant="stage" size={s} icon={ArrowLeft} label={t("common.back")} />
          ))}
          <IconButton variant="stage" icon={X} label={t("common.close")} disabled />
        </Art>
      </Demo>
      <PressedDemo />
      <p className="max-w-measure text-body-s text-text-2">{t("devUi.iconNote")}</p>
    </ShowcaseSection>
  );
}

/** `pressed`: a toggle with its state; the label names the action in both states. */
function PressedDemo() {
  const t = useTranslations();
  const [on, setOn] = useState<Record<string, boolean>>({ watched: true, like: false, fav: false });
  const toggles: { id: string; icon: LucideIcon; label: string }[] = [
    { id: "watched", icon: CircleCheck, label: t("title.watched") },
    { id: "like", icon: ThumbsUp, label: t("devUi.iconLike") },
    { id: "fav", icon: Heart, label: t("library.favorites") },
  ];
  const row = (variant: IconButtonVariant) =>
    toggles.map((x) => (
      <IconButton
        key={x.id}
        variant={variant}
        icon={x.icon}
        label={x.label}
        pressed={on[x.id]}
        onClick={() => setOn((s) => ({ ...s, [x.id]: !s[x.id] }))}
      />
    ));
  return (
    <Demo title={t("devUi.iconPressed")} note={t("devUi.iconPressedNote")} className="block">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Cell label="ghost">
            <div className="flex gap-2">{row("ghost")}</div>
          </Cell>
          <Cell label="secondary">
            <div className="flex gap-2">{row("secondary")}</div>
          </Cell>
        </div>
        <Art>{row("stage")}</Art>
      </div>
    </Demo>
  );
}

function Links() {
  const t = useTranslations();
  return (
    <ShowcaseSection id="link" title={t("devUi.link")} source="ui/Link.tsx · linkClass() · 7.3">
      <Demo title="inline">
        <p className="max-w-measure text-body text-text-2">
          {t.rich("devUi.linkInline", {
            link: (chunks) => <Link href="/legal/credits">{chunks}</Link>,
          })}
        </p>
      </Demo>
      <Demo title="action">
        <Link variant="action" arrow href="/browse/movie">
          {t("devUi.allMovies")}
        </Link>
        <Link variant="action" href="/browse/movie">
          {t("devUi.showAll")}
        </Link>
      </Demo>
    </ShowcaseSection>
  );
}

export function ControlsActions() {
  return (
    <>
      <Buttons />
      <IconButtons />
      <Links />
    </>
  );
}
