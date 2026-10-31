"use client";

import { CloudOff, Eye, ListVideo, Server } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ActionMark, BrandIntro, BrandLoader, SavedCheck } from "@/components/ui/BrandMotion";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Link as ActionLink } from "@/components/ui/Link";
import { Artwork } from "@/components/media/Artwork";
import { Progress, type Step, Steps } from "@/components/ui/Progress";
import { type QueryLike, QueryState } from "@/components/ui/QueryState";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Spoiler } from "@/components/ui/Spoiler";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { Cell, Demo, ShowcaseSection } from "./parts";

function SkeletonDemo() {
  const t = useTranslations("devUi");
  return (
    <Demo title={t("skeletonDemo")} note={t("skeletonNote")} className="items-start gap-6">
      <Cell label={t("skeletonCards")}>
        <div className="flex gap-2 md:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex w-28 flex-col gap-2 md:w-36">
              <Skeleton className="aspect-2/3 w-full" />
              <Skeleton shape="xs" className="h-4 w-4/5" />
              <Skeleton shape="xs" className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </Cell>
      <Cell label={t("skeletonRows")}>
        <div className="flex w-72 max-w-full flex-col gap-4">
          <div className="flex items-center gap-3">
            <Skeleton shape="full" className="size-10" />
            <SkeletonText lines={2} className="flex-1" />
          </div>
          <SkeletonText lines={3} />
        </div>
      </Cell>
    </Demo>
  );
}

/** The Light motion kit as the site draws it (6.3.1): "Replay" remounts a one-shot animation. */
function BrandMotionDemo() {
  const t = useTranslations("devUi");
  const [intro, setIntro] = useState(0);
  const [tick, setTick] = useState(0);
  const [act, setAct] = useState(0);
  return (
    <>
      <Demo title={t("brandLoaderDemo")} note={t("brandLoaderNote")} className="items-start gap-6">
        <Cell label={t("brandOnPage")}>
          <div
            role="status"
            aria-label={t("brandLoaderDemo")}
            className="grid size-32 place-items-center rounded-md border border-line"
          >
            <BrandLoader />
          </div>
        </Cell>
        <Cell label={t("brandOnStage")}>
          <div
            role="status"
            aria-label={t("brandLoaderDemo")}
            className="stage grid size-32 place-items-center rounded-md bg-stage"
          >
            <BrandLoader size="lg" />
          </div>
        </Cell>
      </Demo>
      <Demo title={t("brandIntroDemo")} note={t("brandIntroNote")} className="items-start gap-6">
        <div className="stage grid h-56 w-full max-w-xl place-items-center rounded-md bg-stage">
          <BrandIntro key={intro} className="w-4/5" />
        </div>
        <Button variant="secondary" onClick={() => setIntro((n) => n + 1)}>
          {t("brandReplay")}
        </Button>
      </Demo>
      <Demo title={t("brandCheckDemo")} note={t("brandCheckNote")} className="gap-6">
        <span key={tick} className="inline-flex items-center gap-4">
          <SavedCheck size="sm" />
          <SavedCheck />
        </span>
        <Button variant="secondary" onClick={() => setTick((n) => n + 1)}>
          {t("brandReplay")}
        </Button>
      </Demo>
      <Demo title={t("brandActionsDemo")} note={t("brandActionsNote")} className="gap-6">
        <span key={act} className="inline-flex items-center gap-4">
          <ActionMark kind="favourite" />
          <ActionMark kind="like" />
          <ActionMark kind="rating" />
          <span className="stage inline-flex items-center gap-3 rounded-full bg-stage px-3 py-2">
            <ActionMark kind="rating" drawn className="text-current" />
            <ActionMark kind="like" drawn className="text-current" />
          </span>
        </span>
        <Button variant="secondary" onClick={() => setAct((n) => n + 1)}>
          {t("brandReplay")}
        </Button>
      </Demo>
    </>
  );
}

function ProgressDemo() {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  const [cancelled, setCancelled] = useState(false);
  const running: Step[] = [
    { id: "add", label: t("step1"), state: "done" },
    { id: "load", label: t("step2"), state: "current", detail: t("step2detail") },
    { id: "check", label: t("step3"), state: "pending" },
  ];
  const failed: Step[] = [
    { id: "add", label: t("step1"), state: "done" },
    { id: "load", label: t("step2"), state: "done" },
    { id: "check", label: t("step3"), state: "error", detail: t("step3error") },
  ];
  return (
    <>
      <Demo
        title={t("progressBars")}
        note={t("progressNote")}
        className="max-w-md flex-col items-stretch gap-6"
      >
        <Cell label="40 %">
          <Progress value={40} label={t("progressImport")} />
        </Cell>
        <Cell label={t("progressUnknown")}>
          <Progress value={null} label={t("progressImport")} />
        </Cell>
      </Demo>
      <Demo title={t("stepsDemo")} className="items-start gap-10">
        <Cell label={t("stepsRunning")}>
          <Steps
            className="w-80 max-w-full"
            label={t("stepsLabel")}
            steps={
              cancelled
                ? running.map((s) => ({
                    ...s,
                    state: s.state === "done" ? "done" : "pending",
                    detail: undefined,
                  }))
                : running
            }
            action={
              cancelled ? (
                <Button variant="secondary" onClick={() => setCancelled(false)}>
                  {t("stepsRestart")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setCancelled(true)}>
                  {tc("cancel")}
                </Button>
              )
            }
          />
        </Cell>
        <Cell label={t("stepsError")}>
          <Steps
            className="w-80 max-w-full"
            label={t("stepsLabel")}
            steps={failed}
            progress={66}
            action={
              <>
                <Button onClick={() => toast.info(t("demoPressed", { label: tc("retry") }))}>
                  {tc("retry")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => toast.info(t("demoPressed", { label: t("otherSource") }))}
                >
                  {t("otherSource")}
                </Button>
              </>
            }
          />
        </Cell>
      </Demo>
    </>
  );
}

function EmptyDemo() {
  const t = useTranslations("devUi");
  return (
    <Demo title={t("emptyDemo")} note={t("emptyNote")} className="grid items-stretch gap-6 md:grid-cols-2">
      <Cell label={t("variantSection")}>
        <div className="w-full rounded-md border border-line bg-surface-1">
          <EmptyState
            icon={ListVideo}
            headingLevel={3}
            title={t("emptyListTitle")}
            text={t("emptyListText")}
            action={
              <Link href="/browse/movie" className={buttonClass("secondary")}>
                {t("emptyListAction")}
              </Link>
            }
          />
        </div>
      </Cell>
      <Cell label={t("variantPage")}>
        <div className="w-full rounded-md border border-line">
          <EmptyState
            icon={Server}
            variant="page"
            headingLevel={3}
            title={t("emptyTitle")}
            text={t("emptyText")}
            action={
              <Button onClick={() => toast.info(t("demoPressed", { label: t("emptyAction") }))}>
                {t("emptyAction")}
              </Button>
            }
            secondaryAction={
              <ActionLink variant="action" href="/dev/ui#empty-state">
                {t("emptyLink")}
              </ActionLink>
            }
          />
        </div>
      </Cell>
    </Demo>
  );
}

function ErrorDemo() {
  const t = useTranslations("devUi");
  const te = useTranslations("errors");
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    setRetrying(true);
    setTimeout(() => setRetrying(false), 1200);
  };
  const cell = "w-full rounded-md border border-line";
  return (
    <Demo title={t("errorDemo")} note={t("errorNote")} className="grid items-stretch gap-6 md:grid-cols-2">
      <Cell label={t("errorNetwork")}>
        <div className={cell}>
          <ErrorState
            headingLevel={3}
            error={new ApiRequestError(0, "network", "Network error")}
            onRetry={retry}
            retrying={retrying}
          />
        </div>
      </Cell>
      <Cell label={t("errorServer")}>
        <div className={cell}>
          <ErrorState
            headingLevel={3}
            error={Object.assign(new ApiRequestError(502, "upstream_unavailable", "Bad gateway"), {
              requestId: "req-7f3a9c",
            })}
            onRetry={retry}
            retrying={retrying}
          />
        </div>
      </Cell>
      <Cell label={t("errorKids")}>
        <div className={cell}>
          <ErrorState
            headingLevel={3}
            error={new ApiRequestError(403, "kids_restricted", "Kids profile")}
            onRetry={retry}
            action={
              <Link href="/profiles" className={buttonClass("secondary")}>
                {t("switchProfile")}
              </Link>
            }
          />
        </div>
      </Cell>
      <Cell label={t("errorUnavailable")}>
        <div className={cell}>
          <ErrorState
            variant="page"
            headingLevel={3}
            icon={CloudOff}
            title={te("unavailableTitle")}
            text={te("unavailableText")}
            onRetry={retry}
            retrying={retrying}
          />
        </div>
      </Cell>
    </Demo>
  );
}

type Shown = "loading" | "empty" | "error" | "data" | "refreshError";
const SHOWN: Shown[] = ["loading", "empty", "error", "data", "refreshError"];

function QueryDemo() {
  const t = useTranslations("devUi");
  const [shown, setShown] = useState<Shown>("loading");
  const [fetching, setFetching] = useState(false);
  const servers = [t("queryRow1"), t("queryRow2"), t("queryRow3")];
  const query: QueryLike<string[]> = {
    data: shown === "data" || shown === "refreshError" ? servers : shown === "empty" ? [] : undefined,
    error:
      shown === "error" || shown === "refreshError"
        ? new ApiRequestError(500, "internal", "Internal error")
        : null,
    isPending: shown === "loading",
    isError: shown === "error" || shown === "refreshError",
    isFetching: shown === "loading" || fetching,
    fetchStatus: shown === "loading" || fetching ? "fetching" : "idle",
    refetch: () => {
      setFetching(true);
      setTimeout(() => {
        setFetching(false);
        setShown("data");
      }, 1200);
    },
  };
  return (
    <Demo title={t("queryDemo")} note={t("queryNote")} className="flex-col items-stretch">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{t("queryShow")}</legend>
        {SHOWN.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={shown === s ? "primary" : "secondary"}
            aria-pressed={shown === s}
            onClick={() => {
              setFetching(false);
              setShown(s);
            }}
          >
            {t(`q_${s}`)}
          </Button>
        ))}
      </fieldset>
      <div className="max-w-xl rounded-md border border-line bg-surface-1 p-4">
        <QueryState
          query={query}
          loading={
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          }
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={Server} headingLevel={3} title={t("emptyTitle")} text={t("emptyText")} />}
        >
          {(list) => (
            <ul className="flex flex-col divide-y divide-line">
              {list.map((s) => (
                <li key={s} className="flex h-12 items-center text-body">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </div>
    </Demo>
  );
}

/** Spoiler (7.21): a still and a description, hidden and shown; "Hide spoilers" puts both back. */
function SpoilerDemo() {
  const t = useTranslations("devUi");
  const ts = useTranslations("spoilers");
  const [shown, setShown] = useState({ still: false, text: false });
  const still = "/brand/og.png";
  return (
    <Demo title={t("spoilerDemo")} note={t("spoilerNote")} className="items-start gap-6">
      <Cell label={t("spoilerImage")}>
        <Spoiler variant="image" hidden={!shown.still} onReveal={() => setShown((s) => ({ ...s, still: true }))} label={ts("showStill", { episode: t("spoilerEpisode") })} className="w-56">
          <Artwork shape="landscape" src={still} placeholder="tv" progress={0.4} blurred={!shown.still} />
        </Spoiler>
      </Cell>
      <Cell label={t("spoilerText")}>
        <Spoiler hidden={!shown.text} onReveal={() => setShown((s) => ({ ...s, text: true }))} label={ts("showOverview", { episode: t("spoilerEpisode") })} className="w-72 max-w-full">
          <p className="line-clamp-2 text-body-s text-text-2">{t("spoilerSample")}</p>
        </Spoiler>
      </Cell>
      <Cell label={t("spoilerAll")}>
        <Button variant="tertiary" size="sm" icon={Eye} onClick={() => setShown(shown.still && shown.text ? { still: false, text: false } : { still: true, text: true })}>
          {shown.still && shown.text ? ts("hideAll") : ts("showAll")}
        </Button>
      </Cell>
    </Demo>
  );
}

export function LayersStates() {
  const t = useTranslations("devUi");
  return (
    <>
      <ShowcaseSection id="skeleton" title={t("skeleton")} source="ui/Skeleton.tsx · 7.11">
        <SkeletonDemo />
      </ShowcaseSection>
      <ShowcaseSection
        id="brand-motion"
        title={t("brandMotion")}
        source="ui/BrandMotion.tsx, shell/RouteLoading.tsx · 6.3.1"
      >
        <BrandMotionDemo />
      </ShowcaseSection>
      <ShowcaseSection id="progress" title={t("progressSteps")} source="ui/Progress.tsx · 7.11">
        <ProgressDemo />
      </ShowcaseSection>
      <ShowcaseSection id="empty-state" title={t("emptyState")} source="ui/EmptyState.tsx · 7.11">
        <EmptyDemo />
      </ShowcaseSection>
      <ShowcaseSection
        id="error-state"
        title={t("errorState")}
        source="ui/ErrorState.tsx, lib/api-errors.ts · 7.11, 8.5"
      >
        <ErrorDemo />
      </ShowcaseSection>
      <ShowcaseSection id="query-state" title={t("queryState")} source="ui/QueryState.tsx · 8.4">
        <QueryDemo />
      </ShowcaseSection>
      <ShowcaseSection id="spoiler" title={t("spoiler")} source="ui/Spoiler.tsx, media/Artwork.tsx · 7.21, 8.12">
        <SpoilerDemo />
      </ShowcaseSection>
    </>
  );
}
