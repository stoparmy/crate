import type { PagedMeta } from "./types";

export const defaultMeta: PagedMeta = {
  total: 0,
  page: 1,
  pageSize: 20,
};

export const embeddedApiBase = new URL("./api/embedded", getMountedAppUrl()).pathname;

function getMountedAppUrl() {
  const url = new URL(window.location.href);

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  url.search = "";
  url.hash = "";
  return url;
}
