import { execFileSync } from "node:child_process";

const version = process.argv[2];
const repository = process.env.GITHUB_REPOSITORY;

if (!version) {
  throw new Error("Missing release version argument.");
}

if (!repository) {
  throw new Error("GITHUB_REPOSITORY is required.");
}

const [major, minor] = version.split(".");

if (!major || !minor) {
  throw new Error(`Unexpected semantic version: ${version}`);
}

const image = `ghcr.io/${repository.toLowerCase()}`;
const tags = [`${image}:${version}`, `${image}:${major}.${minor}`, `${image}:${major}`, `${image}:latest`];
const labels = [
  "org.opencontainers.image.source=https://github.com/" + repository,
  "org.opencontainers.image.revision=" + (process.env.GITHUB_SHA || ""),
  "org.opencontainers.image.version=" + version,
];

const args = [
  "buildx",
  "build",
  "--push",
  ...tags.flatMap((tag) => ["--tag", tag]),
  ...labels.flatMap((label) => ["--label", label]),
  ".",
];

console.log(`Publishing ${image} for release ${version}`);
execFileSync("docker", args, { stdio: "inherit", env: process.env });
