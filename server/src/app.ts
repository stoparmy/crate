import path from "path";
import fs from "fs";
import express from "express";
import { requireDashboardActor } from "./auth";
import { errorHandler } from "./errors";
import { embeddedRouter } from "./routes/embedded";
import { buildRuntimeConfigScript } from "./runtimeConfig";

function normalizeMountedRequestUrl(url: string) {
  if (url === "/" || url === "") {
    return url;
  }

  const [pathname, search = ""] = url.split("?");

  if (
    pathname === "/" ||
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/assets/") ||
    pathname === "/assets"
  ) {
    return url;
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 1) {
    return `/${search ? `?${search}` : ""}`;
  }

  const [mountSegment, nextSegment] = segments;

  if (!mountSegment || (nextSegment !== "api" && nextSegment !== "assets")) {
    return url;
  }

  const normalizedPath = `/${segments.slice(1).join("/")}`;
  return `${normalizedPath}${search ? `?${search}` : ""}`;
}

export function createApp() {
  const app = express();
  const publicDir = path.resolve(__dirname, "..", "public");
  const indexHtmlPath = path.join(publicDir, "index.html");
  const indexHtmlTemplate = fs.readFileSync(indexHtmlPath, "utf8");

  app.set("trust proxy", 1);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.url = normalizeMountedRequestUrl(req.url);
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "crate" });
  });

  app.use("/api/embedded", requireDashboardActor, embeddedRouter);

  app.use(express.static(publicDir, { index: false }));
  app.get("*", (_req, res) => {
    res.type("html").send(
      indexHtmlTemplate.replace("</head>", `${buildRuntimeConfigScript()}</head>`),
    );
  });

  app.use(errorHandler);

  return app;
}
