import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { BookPage } from "../pages/Book";

export function BookingModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const backdropDown = useRef(false);
  const close = () => {
    if (closing) return;
    setClosing(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => { dialog.current?.close(); onClose(); }, reduce ? 0 : 240);
  };
  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer.current);
      element.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog ref={dialog} className="booking-modal" data-closing={closing} aria-label="Запись в студию"
      onCancel={event => { event.preventDefault(); close(); }}
      onPointerDown={event => { backdropDown.current = event.target === event.currentTarget; }}
      onClick={event => { if (backdropDown.current && event.target === event.currentTarget) close(); backdropDown.current = false; }}>
      <section className="booking-modal__panel">
        <button className="booking-modal__close" type="button" aria-label="Закрыть форму записи" onClick={close} autoFocus><X size={22} aria-hidden /></button>
        <BookPage embedded />
      </section>
    </dialog>
  );
}
