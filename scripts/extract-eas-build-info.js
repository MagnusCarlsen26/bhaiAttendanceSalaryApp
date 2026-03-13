const fs = require('fs');

function setGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `${name}=${value}\n`);
  } else {
    console.log(`${name}=${value}`);
  }
}

function normalizeBuild(data) {
  if (Array.isArray(data)) {
    return data[0];
  }
  return data;
}

function firstString(values) {
  return values.find((value) => typeof value === 'string' && value.length > 0) || '';
}

function extractArtifactUrl(build) {
  const artifacts = build?.artifacts || {};
  return firstString([
    artifacts.applicationArchiveUrl,
    artifacts.buildUrl,
    artifacts.url,
    build?.applicationArchiveUrl,
    build?.buildArtifactUrl,
    build?.artifactUrl
  ]);
}

function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error('Usage: node scripts/extract-eas-build-info.js <build-json-file>');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const build = normalizeBuild(JSON.parse(raw));

  if (!build || typeof build !== 'object') {
    throw new Error('Unexpected EAS build JSON format.');
  }

  const buildId = firstString([build.id]);
  const buildDetailsUrl = firstString([build.buildDetailsPageUrl, build.logsUrl, build.detailsUrl]);
  const apkUrl = extractArtifactUrl(build);

  if (!buildId && !buildDetailsUrl && !apkUrl) {
    throw new Error('Could not extract build metadata from EAS JSON output.');
  }

  if (buildId) {
    setGithubOutput('build_id', buildId);
  }

  if (buildDetailsUrl) {
    setGithubOutput('build_details_url', buildDetailsUrl);
  }

  if (apkUrl) {
    setGithubOutput('apk_url', apkUrl);
  }
}

main();
