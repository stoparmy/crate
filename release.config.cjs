module.exports = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/exec",
      {
        publishCmd: "node ./scripts/release-docker.mjs ${nextRelease.version}",
      },
    ],
    "@semantic-release/github",
  ],
};
