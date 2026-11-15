// Подключается к сервис-воркеру Workbox. Показывает напоминание о записи и открывает её по нажатию.
self.addEventListener("push", (event) => {
  let data = { title: "Напоминание о записи", body: "", url: self.registration.scope };
  try {
    data = Object.assign(data, event.data ? event.data.json() : {});
  } catch (e) {
    data.body = event.data ? event.data.text() : "";
  }
  const target = new URL(data.url, self.location.origin);
  const appBase = new URL(self.registration.scope).pathname;
  if (target.origin === self.location.origin && !target.pathname.startsWith(appBase)) target.pathname = appBase + target.pathname.replace(/^\//, "");
  data.url = target.href;
  const tenant = target.pathname.match(/\/s\/[a-z0-9-]+\//);
  const scope = tenant ? target.pathname.slice(0, tenant.index + tenant[0].length) : appBase;
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: scope + "icon-192.png",
      badge: scope + "icon-192.png",
      data: { url: data.url },
      tag: "booking-reminder",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c && c.url.includes(url.split("?")[0])) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
