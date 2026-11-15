import { useState } from "react";
import { z } from "zod";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/VStack";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { Link } from "@astryxdesign/core/Link";
import { supabase } from "../lib/supabase";

const schema = z.object({
  email: z.string().trim().email("Введите почту полностью, например name@mail.ru"),
  password: z.string().min(6, "Пароль — не короче 6 символов"),
});

export function LoginPage({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const r = schema.safeParse({ email, password });
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(r.data);
    setBusy(false);
    if (error) setFailure(error.message.includes("Invalid") ? "Неверная почта или пароль" : error.message);
  }

  return (
    <Center height="100dvh">
      <div style={{ width: "100%", maxWidth: 400, padding: 16 }}>
        <Card padding={6}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={1}>Кабинет владельца</Heading>
                <Text type="supporting">Вход по почте и паролю</Text>
              </VStack>
              {failure && <Banner status="error" title={failure} collapsible={false} />}
              <TextInput label="Почта" type="email" value={email} onChange={setEmail} autoComplete="username" inputMode="email"
                status={errors.email ? { type: "error", message: errors.email } : undefined} statusVariant="detached" />
              <TextInput label="Пароль" type="password" value={password} onChange={setPassword} autoComplete="current-password"
                status={errors.password ? { type: "error", message: errors.password } : undefined} statusVariant="detached" />
              <Button label="Войти" type="submit" variant="primary" size="lg" width="100%" isLoading={busy} />
              <Link href={`/s/${slug}/`}>Вернуться на сайт</Link>
            </VStack>
          </form>
        </Card>
      </div>
    </Center>
  );
}
