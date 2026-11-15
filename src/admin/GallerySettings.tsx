import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { FileInput } from "@astryxdesign/core/FileInput";
import { Banner } from "@astryxdesign/core/Banner";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Plus, Trash } from "@phosphor-icons/react";
import { mediaUrl, supabase } from "../lib/supabase";
import type { GalleryItem, StudioBundle } from "../lib/types";
import { dbMessage, removeImage, uploadImage } from "./owner";
import { Block, useSaver } from "./Settings";

const errText = (e: unknown) => (e instanceof Error && !("code" in e) ? e.message : dbMessage(e));

/**
 * Три отдельных действия:
 * 1) «Добавить карточку» — новое фото с подписью, остальные работы не трогаются;
 * 2) «Заменить фото» у конкретной карточки — меняется только её снимок, подпись остаётся;
 * 3) «Сохранить подпись» у конкретной карточки — меняется только текст.
 */
export function GallerySettings({ bundle }: { bundle: StudioBundle }) {
  const sid = bundle.studio.id;
  const refresh = useSaver(bundle.studio.slug);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Выберите фото");
      if (caption.length > 120) throw new Error("Подпись — не длиннее 120 символов");
      const path = await uploadImage(sid, "gallery", file);
      const sort = Math.max(-1, ...bundle.gallery.map((g) => g.sort)) + 1;
      const { error } = await supabase.from("gallery_items").insert({ studio_id: sid, image_path: path, caption: caption.trim(), sort });
      if (error) {
        await removeImage(sid, path);
        throw error;
      }
      setFile(null);
      setCaption("");
    },
    onSuccess: refresh,
  });

  return (
    <Block id="gallery" title="Фото работ" description="Каждую карточку можно менять отдельно: другие работы останутся на месте.">
      <div className="booking-item">
        <VStack gap={3}>
          <Text weight="semibold">Добавить новую карточку</Text>
          <FileInput label="Фото" accept="image/jpeg,image/png,image/webp" value={file} maxSize={8_000_000}
            onChange={(f) => setFile(f && !Array.isArray(f) ? f : null)} />
          <TextInput label="Подпись" value={caption} onChange={setCaption} placeholder="Например, полировка и керамика, Camry" />
          {add.isError && <Banner status="error" title={errText(add.error)} collapsible={false} />}
          <div><Button label="Добавить карточку" variant="primary" icon={<Plus size={16} />} isDisabled={!file} isLoading={add.isPending} onClick={() => add.mutate()} /></div>
        </VStack>
      </div>
      <div className="admin-gallery">
        {bundle.gallery.map((g, i) => <GalleryCard key={g.id} item={g} index={i} studioId={sid} onChanged={refresh} />)}
      </div>
    </Block>
  );
}

function GalleryCard({ item, index, studioId, onChanged }: { item: GalleryItem; index: number; studioId: string; onChanged: () => void }) {
  const [caption, setCaption] = useState(item.caption);
  const [confirm, setConfirm] = useState(false);

  const replacePhoto = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadImage(studioId, "gallery", file);
      // Обновляем только эту карточку — по её id.
      const { error } = await supabase.from("gallery_items").update({ image_path: path }).eq("id", item.id).eq("studio_id", studioId);
      if (error) {
        await removeImage(studioId, path);
        throw error;
      }
      await removeImage(studioId, item.image_path);
    },
    onSuccess: onChanged,
  });

  const saveCaption = useMutation({
    mutationFn: async () => {
      if (caption.length > 120) throw new Error("Подпись — не длиннее 120 символов");
      const { error } = await supabase.from("gallery_items").update({ caption: caption.trim() }).eq("id", item.id).eq("studio_id", studioId);
      if (error) throw error;
    },
    onSuccess: onChanged,
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("gallery_items").delete().eq("id", item.id).eq("studio_id", studioId);
      if (error) throw error;
      await removeImage(studioId, item.image_path);
    },
    onSuccess: () => { setConfirm(false); onChanged(); },
  });

  return (
    <div className="booking-item" data-testid="gallery-card">
      <VStack gap={3}>
        <img src={mediaUrl(item.image_path)} alt={item.caption || `Работа ${index + 1}`} loading="lazy" />
        <FileInput label={`Заменить фото ${index + 1}`} accept="image/jpeg,image/png,image/webp" value={null} maxSize={8_000_000}
          isLoading={replacePhoto.isPending} placeholder="Выбрать новое фото"
          onChange={(f) => f && !Array.isArray(f) && replacePhoto.mutate(f)} />
        {replacePhoto.isError && <Banner status="error" title={errText(replacePhoto.error)} collapsible={false} />}
        <TextInput label={`Подпись к фото ${index + 1}`} value={caption} onChange={setCaption} />
        {saveCaption.isError && <Banner status="error" title={errText(saveCaption.error)} collapsible={false} />}
        <HStack gap={2} justify="between">
          <Button label="Сохранить подпись" size="sm" isDisabled={caption === item.caption} isLoading={saveCaption.isPending} onClick={() => saveCaption.mutate()} />
          <Button label="Удалить карточку" size="sm" variant="ghost" isIconOnly icon={<Trash size={16} />} onClick={() => setConfirm(true)} />
        </HStack>
      </VStack>
      <AlertDialog isOpen={confirm} onOpenChange={setConfirm} title="Удалить карточку?" description="Фото и подпись исчезнут с сайта."
        actionLabel="Удалить" cancelLabel="Оставить" isActionLoading={remove.isPending} onAction={() => remove.mutate()} />
    </div>
  );
}
