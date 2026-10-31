"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ToastCard, toast } from "@/components/ui/Toast";
import { Demo, ShowcaseSection } from "./parts";

function ToastDemo() {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const undo = { label: tc("undo"), onClick: () => toast.success(t("undone")) };
  // The static cards only say what their buttons would do.
  const pressed = (label: string) => () => toast.info(t("demoPressed", { label }));
  return (
    <>
      <Demo title={t("toastStatic")} note={t("toastNote")} className="flex-col items-stretch">
        <ToastCard
          item={{ tone: "success", message: t("toastSuccessMsg") }}
          onDismiss={pressed(tc("dismiss"))}
        />
        <ToastCard
          item={{ tone: "info", message: t("toastActionMsg"), action: undo }}
          onAction={pressed(tc("undo"))}
          onDismiss={pressed(tc("dismiss"))}
        />
        <ToastCard
          item={{ tone: "error", message: te("network"), action: { label: tc("retry"), onClick: () => {} } }}
          onAction={pressed(tc("retry"))}
          onDismiss={pressed(tc("dismiss"))}
        />
      </Demo>
      <Demo title={t("toastLive")} note={t("toastLiveNote")}>
        <Button variant="secondary" onClick={() => toast.success(t("toastSuccessMsg"))}>
          {t("toastSuccess")}
        </Button>
        <Button variant="secondary" onClick={() => toast.info(t("toastInfoMsg"))}>
          {t("toastInfo")}
        </Button>
        <Button variant="secondary" onClick={() => toast.error(te("network"))}>
          {t("toastError")}
        </Button>
        <Button variant="secondary" onClick={() => toast.info(t("toastActionMsg"), { action: undo })}>
          {t("toastWithAction")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            for (let n = 1; n <= 4; n++) toast.info(t("toastN", { n }));
          }}
        >
          {t("toastFour")}
        </Button>
      </Demo>
    </>
  );
}

function AlertDemo() {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  const pressed = (label: string) => () => toast.info(t("demoPressed", { label }));
  return (
    <Demo title={t("alertTones")} note={t("alertNote")} className="max-w-3xl flex-col items-stretch">
      <InlineAlert tone="info" title={t("alertInfoTitle")}>
        {t("alertInfoText")}
      </InlineAlert>
      <InlineAlert
        tone="success"
        title={t("alertSuccessTitle")}
        action={
          <Button variant="tertiary" size="sm" onClick={pressed(t("alertOpen"))}>
            {t("alertOpen")}
          </Button>
        }
      >
        {t("alertSuccessText")}
      </InlineAlert>
      <InlineAlert
        tone="warning"
        title={t("alertWarningTitle")}
        action={
          <Button variant="tertiary" size="sm" onClick={pressed(t("alertCheck"))}>
            {t("alertCheck")}
          </Button>
        }
      >
        {t("alertWarningText")}
      </InlineAlert>
      <InlineAlert
        tone="danger"
        title={t("alertDangerTitle", { name: t("serverName") })}
        action={
          <Button variant="tertiary" size="sm" onClick={pressed(tc("retry"))}>
            {tc("retry")}
          </Button>
        }
      >
        {t("alertDangerText")}
      </InlineAlert>
      <InlineAlert tone="danger">{t("alertTextOnly")}</InlineAlert>
    </Demo>
  );
}

export function LayersFeedback() {
  const t = useTranslations("devUi");
  return (
    <>
      <ShowcaseSection id="toast" title={t("toasts")} source="ui/Toast.tsx, ui/toast-store.ts · 7.10">
        <ToastDemo />
      </ShowcaseSection>
      <ShowcaseSection id="inline-alert" title={t("inlineAlert")} source="ui/InlineAlert.tsx · 7.10">
        <AlertDemo />
      </ShowcaseSection>
    </>
  );
}
