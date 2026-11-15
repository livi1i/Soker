import { Center } from "@astryxdesign/core/Center";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Button } from "@astryxdesign/core/Button";

export function NotFound() {
  return (
    <Center height="70dvh">
      <EmptyState title="Страница не найдена" description="Возможно, ссылка устарела." actions={<Button label="На главную" variant="primary" href="/" />} />
    </Center>
  );
}
