"use client";

import { Ellipsis, Globe, Info, Pencil, Search, Share2, Star, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm, usePrompt } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuCheckboxItem, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { Popover } from "@/components/ui/Popover";
import { toast } from "@/components/ui/Toast";
import { Demo, ShowcaseSection } from "./parts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function MenuDemo() {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [name, setName] = useState(() => t("listName"));
  const [isPublic, setPublic] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const items = (
    <>
      <MenuLabel>{name}</MenuLabel>
      <MenuItem
        icon={Pencil}
        onSelect={async () => {
          const next = await prompt({
            title: t("renameTitle"),
            label: t("renameLabel"),
            defaultValue: name,
            confirmLabel: tc("save"),
            maxLength: 60,
          });
          if (next) {
            setName(next);
            toast.success(t("renamed", { name: next }));
          }
        }}
      >
        {t("menuRename")}
      </MenuItem>
      <MenuItem icon={Share2} onSelect={() => toast.success(tc("copied"))}>
        {tc("share")}
      </MenuItem>
      <MenuCheckboxItem icon={Globe} checked={isPublic} onCheckedChange={setPublic}>
        {t("menuPublic")}
      </MenuCheckboxItem>
      <MenuSeparator />
      <MenuItem
        icon={Trash2}
        tone="danger"
        onSelect={async () => {
          const ok = await confirm({
            title: t("deleteListTitle", { name }),
            text: t("deleteListText"),
            confirmLabel: t("menuDeleteList"),
            action: () => wait(600),
          });
          if (ok) {
            setDeleted(true);
            toast.success(t("listDeleted", { name }));
          }
        }}
      >
        {t("menuDeleteList")}
      </MenuItem>
    </>
  );
  return (
    <Demo title={t("menuDemo")} note={t("menuNote")}>
      <Menu
        label={t("menuListLabel")}
        trigger={<IconButton icon={Ellipsis} label={t("menuMore")} variant="secondary" />}
      >
        {items}
      </Menu>
      <Menu
        label={t("menuListLabel")}
        align="start"
        trigger={<Button variant="secondary">{t("menuListLabel")}</Button>}
      >
        {items}
      </Menu>
      <p className="text-body-s text-text-2" aria-live="polite">
        {deleted ? t("listDeletedState") : isPublic ? t("menuPublicOn") : t("menuPublicOff")}
      </p>
    </Demo>
  );
}

function PopoverDemo() {
  const t = useTranslations("devUi");
  const [rating, setRating] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <Demo title={t("popoverDemo")} note={t("popoverNote")}>
      <div className="flex items-center gap-1">
        <span className="text-h3">{t("popoverShelf")}</span>
        <Popover
          title={t("popoverInfo")}
          align="start"
          trigger={<IconButton icon={Info} label={t("popoverInfo")} size="sm" />}
        >
          <p className="text-body-s text-text-2">{t("popoverInfoText")}</p>
        </Popover>
      </div>
      <Popover
        title={t("popoverRateTitle")}
        showTitle
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button
            variant="secondary"
            icon={Star}
            aria-label={rating ? t("popoverRated", { n: rating }) : undefined}
          >
            {rating ?? t("popoverRate")}
          </Button>
        }
      >
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              size="sm"
              variant={rating === n ? "primary" : "secondary"}
              aria-pressed={rating === n}
              onClick={() => {
                setRating(n);
                setOpen(false);
              }}
            >
              {n}
            </Button>
          ))}
        </div>
        {rating !== null && (
          <Button
            variant="tertiary"
            size="sm"
            className="mt-3"
            onClick={() => {
              setRating(null);
              setOpen(false);
            }}
          >
            {t("popoverClear")}
          </Button>
        )}
      </Popover>
    </Demo>
  );
}

function TooltipDemo() {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  return (
    <Demo title={t("tooltipDemo")} note={t("tooltipNote")}>
      {[
        [Search, tc("search")],
        [Share2, tc("share")],
        [X, tc("close")],
      ].map(([icon, label]) => (
        // IconButton carries its Tooltip itself (its label).
        <IconButton
          key={label as string}
          icon={icon as typeof Search}
          label={label as string}
          variant="secondary"
        />
      ))}
    </Demo>
  );
}

export function LayersOverlays() {
  const t = useTranslations("devUi");
  return (
    <>
      <ShowcaseSection id="menu" title={t("menu")} source="ui/Menu.tsx · 7.8">
        <MenuDemo />
      </ShowcaseSection>
      <ShowcaseSection id="popover" title={t("popover")} source="ui/Popover.tsx · 7.8">
        <PopoverDemo />
      </ShowcaseSection>
      <ShowcaseSection id="tooltip" title={t("tooltip")} source="ui/Tooltip.tsx · 7.8">
        <TooltipDemo />
      </ShowcaseSection>
    </>
  );
}
