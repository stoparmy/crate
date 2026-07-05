import { execFileSync } from "node:child_process";

const version = process.argv[2];
const repository = process.env.GITHUB_REPOSITORY;
const branch = process.env.GITHUB_REF_NAME;

if (!version) {
  throw new Error("Missing release version argument.");
}

if (!repository) {
  throw new Error("GITHUB_REPOSITORY is required.");
}

const versionMatch = version.match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
if (!versionMatch) {
  throw new Error(`Unexpected semantic version: ${version}`);
}

const [, major, minor, patch, prereleaseSuffix] = versionMatch;
const image = `ghcr.io/${repository.toLowerCase()}`;
const isPrerelease = Boolean(prereleaseSuffix);
const tags = isPrerelease
  ? [`${image}:${version}`, `${image}:${branch || "beta"}`]
  : [`${image}:${version}`, `${image}:${major}.${minor}`, `${image}:${major}`, `${image}:latest`];
const platforms = (process.env.DOCKER_PLATFORMS || "linux/amd64,linux/arm64")
  .split(",")
  .map((platform) => platform.trim())
  .filter(Boolean);
const labels = [
  "org.opencontainers.image.source=https://github.com/" + repository,
  "org.opencontainers.image.revision=" + (process.env.GITHUB_SHA || ""),
  "org.opencontainers.image.version=" + version,
  "org.opencontainers.image.ref.name=" + (branch || ""),
];

const args = [
  "buildx",
  "build",
  "--push",
  "--platform",
  platforms.join(","),
  ...tags.flatMap((tag) => ["--tag", tag]),
  ...labels.flatMap((label) => ["--label", label]),
  ".",
];

console.log(`Publishing ${image} for release ${version} on ${platforms.join(", ")}`);
execFileSync("docker", args, { stdio: "inherit", env: process.env });
