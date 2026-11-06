"use client";

import { Ellipsis, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, useConfirm, usePrompt } from "@/components/ui/ConfirmDialog";
import { Facts } from "@/components/sources/Facts";
import { Dialog, DialogActions, type DialogSize, Sheet } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { ApiRequestError } from "@/lib/api";
import { Art, Demo, ShowcaseSection } from "./parts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A form dialog: "Cancel" + the main action; the field gets the focus. */
function CreateListDemo({ size, width }: { size: DialogSize; width: number }) {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setOpen(false);
    toast.success(t("listCreated", { name: name.trim() || t("listName") }));
    setName("");
  };
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("openDialog", { width })}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("dialogTitle")}
        description={t("dialogDesc")}
        size={size}
      >
        <form onSubmit={submit}>
          <Field label={t("renameLabel")}>
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("listName")}
              />
            )}
          </Field>
          <DialogActions>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit">{t("dialogCreate")}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function LayerKindsDemo() {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  const [hidden, setHidden] = useState(false);
  return (
    <>
      <Demo title={t("dialogSizes")} note={t("dialogNote")}>
        <CreateListDemo size="md" width={480} />
        <CreateListDemo size="lg" width={640} />
        <CreateListDemo size="xl" width={880} />
      </Demo>
      <Demo title={t("sheetAndDetails")} note={t("sheetNote")}>
        <Sheet title={t("sheetTitle")} trigger={<Button variant="secondary">{t("openSheet")}</Button>}>
          <p className="text-body text-text-2">{t("sheetText")}</p>
        </Sheet>
        <Dialog
          size="lg"
          title={t("detailsTitle")}
          description={t("detailsDesc")}
          trigger={<Button variant="secondary">{t("openDetails")}</Button>}
        >
          <Facts
            rows={[
              [t("detailsQuality"), t("detailsLine1")],
              [t("detailsSource"), t("detailsLine2")],
            ]}
          />
          <ToastInLayer />
        </Dialog>
        <Button variant="secondary" onClick={() => setHidden(true)}>
          {t("openHidden")}
        </Button>
        <Dialog open={hidden} onOpenChange={setHidden} title={t("hiddenTitle")} hideTitle size="lg">
          <div className="grid aspect-video place-items-center rounded-sm bg-stage text-body text-text-2">
            {t("hiddenText")}
          </div>
          <DialogActions>
            <Button variant="secondary" onClick={() => setHidden(false)}>
              {tc("close")}
            </Button>
          </DialogActions>
        </Dialog>
      </Demo>
    </>
  );
}

/** A toast's "Undo" pressed while a modal layer is open keeps the layer open (bug found in H2). */
function ToastInLayer() {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  return (
    <div className="mt-6 flex flex-col items-start gap-2">
      <p className="text-body-s text-text-2">{t("toastInLayerNote")}</p>
      <Button
        variant="secondary"
        onClick={() =>
          toast.info(t("toastInLayerMsg"), {
            action: { label: tc("undo"), onClick: () => toast.success(t("undone")) },
          })
        }
      >
        {t("toastInLayer")}
      </Button>
    </div>
  );
}

function ConfirmDemo() {
  const t = useTranslations("devUi");
  const tr = useTranslations();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [declarative, setDeclarative] = useState(false);
  const attempts = useRef(0);
  const server = t("serverName");
  return (
    <>
      <Demo title={t("confirmDemo")} note={t("confirmNote")}>
        <Button variant="danger-tertiary" onClick={() => setDeclarative(true)}>
          {t("menuDeleteList")}
        </Button>
        <ConfirmDialog
          open={declarative}
          onOpenChange={setDeclarative}
          title={t("deleteListTitle", { name: t("listName") })}
          text={t("deleteListText")}
          confirmLabel={t("menuDeleteList")}
          onConfirm={async () => {
            await wait(600);
            toast.success(t("listDeleted", { name: t("listName") }));
          }}
        />
        <Button
          variant="danger-tertiary"
          onClick={async () => {
            const ok = await confirm({
              title: t("deleteServerTitle", { name: server }),
              text: t("deleteServerText"),
              confirmLabel: t("deleteServer"),
              // The first press fails as if offline: the error stays in the dialog, the second press goes through.
              action: async () => {
                await wait(500);
                attempts.current += 1;
                if (attempts.current % 2 === 1) throw new ApiRequestError(0, "network", "Network error");
              },
            });
            if (ok) toast.success(t("serverDeleted", { name: server }));
          }}
        >
          {t("deleteServerFailing")}
        </Button>
        <Button
          variant="danger-tertiary"
          onClick={async () => {
            const ok = await confirm({
              title: t("deleteListTitle", { name: t("listName") }),
              text: t("deleteListText"),
              confirmLabel: t("menuDeleteList"),
              // The screen's own words for a failure instead of the API's general ones (`error`).
              action: async () => {
                await wait(500);
                attempts.current += 1;
                if (attempts.current % 2 === 1) throw new ApiRequestError(500, "internal", "Server error");
              },
              error: tr("library.deleteListFailed"),
            });
            if (ok) toast.success(t("listDeleted", { name: t("listName") }));
          }}
        >
          {t("deleteListFailing")}
        </Button>
      </Demo>
      <Demo title={t("confirmTyped")} note={t("confirmTypedNote")}>
        <Button
          variant="danger-tertiary"
          onClick={async () => {
            if (
              await confirm({
                title: t("deleteAccountTitle"),
                text: t("deleteAccountText"),
                confirmLabel: t("deleteAccount"),
                confirmWord: t("deleteWord"),
              })
            )
              toast.info(t("nothingDeleted"));
          }}
        >
          {t("deleteAccount")}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const reason = await prompt({
              title: t("banTitle", { name: t("userName") }),
              text: t("banText"),
              label: t("banLabel"),
              placeholder: t("banPlaceholder"),
              multiline: true,
              maxLength: 500,
              confirmLabel: t("ban"),
              tone: "danger",
            });
            if (reason !== null) toast.success(t("banned", { reason }));
          }}
        >
          {t("ban")}
        </Button>
      </Demo>
    </>
  );
}

/**
 * Layers opened from a stage take its dark values in either theme (3.5): a confirmation, a menu and a select list
 * opened from the artwork. In the light theme they stay dark, like the sign-in wall's and the player's.
 */
function StageLayersDemo() {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const confirm = useConfirm();
  const [q, setQ] = useState("auto");
  return (
    <Demo title={t("stageLayers")} note={t("stageLayersNote")} className="block">
      <Art>
        <Button
          variant="secondary"
          onClick={async () => {
            if (
              await confirm({
                title: t("deleteListTitle", { name: t("listName") }),
                text: t("deleteListText"),
                confirmLabel: t("menuDeleteList"),
              })
            )
              toast.info(t("nothingDeleted"));
          }}
        >
          {t("menuDeleteList")}
        </Button>
        <Menu
          label={t("menuListLabel")}
          trigger={<IconButton icon={Ellipsis} label={t("menuMore")} variant="stage" />}
        >
          <MenuItem icon={Share2} onSelect={() => toast.success(tc("copied"))}>
            {tc("share")}
          </MenuItem>
        </Menu>
        <Select
          aria-label={t("selectQuality")}
          className="w-48"
          value={q}
          onValueChange={setQ}
          options={[
            { value: "auto", label: tr("title.tsQuality_auto") },
            { value: "best", label: tr("title.tsQuality_best") },
          ]}
        />
      </Art>
    </Demo>
  );
}

export function LayersDialogs() {
  const t = useTranslations("devUi");
  return (
    <>
      <ShowcaseSection id="dialog" title={t("dialogs")} source="ui/Dialog.tsx · 7.9">
        <LayerKindsDemo />
      </ShowcaseSection>
      <ShowcaseSection id="confirm" title={t("confirm")} source="ui/ConfirmDialog.tsx · 7.9, 8.3">
        <ConfirmDemo />
      </ShowcaseSection>
      <ShowcaseSection id="stage-layers" title={t("stageLayers")} source="ui/portal.ts · 3.5">
        <StageLayersDemo />
      </ShowcaseSection>
    </>
  );
}
