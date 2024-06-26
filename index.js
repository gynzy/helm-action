const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const fs = require("fs");
const util = require("util");
const Mustache = require("mustache");

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const deleteFile = util.promisify(fs.rm);
const required = { required: true };

const GCLOUD_BINARY = "/opt/google-cloud-sdk/bin/gcloud";

/**
 * Status marks the deployment status. Only activates if token is set as an
 * input to the job.
 *
 * @param {string} state
 */
async function status(state) {
  try {
    const context = github.context;
    const deployment = context.payload.deployment;
    const token = core.getInput("token");
    if (!token || !deployment) {
      core.debug("not setting deployment status");
      return;
    }

    const client = new github.GitHub(token);
    const url = `https://github.com/${context.repo.owner}/${context.repo.repo}/commit/${context.sha}/checks`;

    await client.repos.createDeploymentStatus({
      ...context.repo,
      deployment_id: deployment.id,
      state,
      log_url: url,
      target_url: url,
      headers: {
        accept: "application/vnd.github.ant-man-preview+json",
      },
    });
  } catch (error) {
    core.warning(`Failed to set deployment status: ${error.message}`);
  }
}

function releaseName(name, track) {
  if (track !== "stable") {
    return `${name}-${track}`;
  }
  return name;
}

function chartName(name) {
  if (name === "app") {
    return "/usr/src/charts/app";
  }
  return name;
}

function getValues(values) {
  if (!values) {
    return "{}";
  }
  if (typeof values === "object") {
    return JSON.stringify(values);
  }
  return values;
}

function getSecrets(secrets) {
  if (typeof secrets === "string") {
    try {
      return JSON.parse(secrets);
    } catch (err) {
      return secrets;
    }
  }
  return secrets;
}

function getValueFiles(files) {
  let fileList;
  if (typeof files === "string") {
    try {
      fileList = JSON.parse(files);
    } catch (err) {
      // Assume it's a single string.
      fileList = [files];
    }
  } else {
    fileList = files;
  }
  if (!Array.isArray(fileList)) {
    return [];
  }
  return fileList.filter((f) => !!f);
}

function getInput(name, options) {
  const context = github.context;
  const deployment = context.payload.deployment;
  let val = core.getInput(name.replace("_", "-"), {
    ...options,
    required: false,
  });
  if (deployment) {
    if (deployment[name]) val = deployment[name];
    if (deployment.payload[name]) val = deployment.payload[name];
  }
  if (options && options.required && !val) {
    throw new Error(`Input required and not supplied: ${name}`);
  }
  return val;
}

/**
 * Render files renders data into the list of provided files.
 * @param {Array<string>} files
 * @param {any} data
 */
function renderFiles(files, data) {
  core.debug(
    `rendering value files [${files.join(",")}] with: ${JSON.stringify(data)}`
  );
  const tags = ["${{", "}}"];
  const promises = files.map(async (file) => {
    const content = await readFile(file, { encoding: "utf8" });
    const rendered = Mustache.render(content, data, {}, tags);
    await writeFile(file, rendered);
  });
  return Promise.all(promises);
}

/**
 * Makes a delete command for compatibility between helm 2 and 3.
 *
 * @param {string} helm
 * @param {string} namespace
 * @param {string} release
 */
function deleteCmd(helm, namespace, release) {
  if (helm === "helm3") {
    return ["delete", "-n", namespace, release];
  }
  return ["delete", "--purge", release];
}

async function setupClusterAuthentication(project, location, name, sa_json) {
  core.info("Setting up GKE authentication");
  await writeFile("sa.json", sa_json);
  const account = JSON.parse(sa_json).client_email; // get the account passed in. this will prevent issues when multiple accounts have been activated
  await exec.exec(GCLOUD_BINARY, [
    "auth",
    "activate-service-account",
    "--key-file=sa.json",
  ]);
  await exec.exec(GCLOUD_BINARY, [
    "container",
    "clusters",
    "get-credentials",
    name,
    "--zone",
    location,
    "--project",
    project,
    "--account",
    account,
  ]);
  await deleteFile("sa.json");
}

function unsetGcloudVariables() {
  delete process.env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_GHA_CREDS_PATH;
  delete process.env.CLOUDSDK_CORE_PROJECT;
  delete process.env.CLOUDSDK_PROJECT;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.GCP_PROJECT;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.CLOUDSDK_METRICS_ENVIRONMENT;
  delete process.env.CLOUDSDK_METRICS_ENVIRONMENT_VERSION;
}

/**
 * Run executes the helm deployment.
 */
async function run() {
  try {
    const context = github.context;
    await status("pending");

    unsetGcloudVariables();

    const cluster_project = getInput("clusterproject", required);
    const cluster_location = getInput("clusterlocation", required);
    const cluster_name = getInput("clustername", required);
    const cluster_sajson = getInput("clustersajson", required);

    const track = getInput("track") || "stable";
    const appName = getInput("release", required);
    const release = releaseName(appName, track);
    const namespace = getInput("namespace", required);
    const chart = chartName(getInput("chart", required));
    const chartVersion = getInput("chart_version");
    const values = getValues(getInput("values"));
    const task = getInput("task");
    const version = getInput("version");
    const valueFiles = getValueFiles(getInput("value_files"));
    const removeCanary = getInput("remove_canary");
    const helm = getInput("helm") || "helm";
    const timeout = getInput("timeout");
    const repository = getInput("repository");
    const dryRun = core.getInput("dry-run");
    const secrets = getSecrets(core.getInput("secrets"));
    const atomic = getInput("atomic") || true;
    const ttl = getInput("ttl") || "false";
    // only needed when ttl is specified
    // this service account is used when ttl has expired inside the cronjob context.
    const service_account = getInput("service_account") || "helm-ttl-plugin";

    core.debug(`param: cluster_project = "${cluster_project}"`);
    core.debug(`param: cluster_location = "${cluster_location}"`);
    core.debug(`param: cluster_name = "${cluster_name}"`);
    core.debug(`param: cluster_sajson = "${cluster_sajson}"`);
    core.debug(`param: track = "${track}"`);
    core.debug(`param: release = "${release}"`);
    core.debug(`param: appName = "${appName}"`);
    core.debug(`param: namespace = "${namespace}"`);
    core.debug(`param: chart = "${chart}"`);
    core.debug(`param: chart_version = "${chartVersion}"`);
    core.debug(`param: values = "${values}"`);
    core.debug(`param: dryRun = "${dryRun}"`);
    core.debug(`param: task = "${task}"`);
    core.debug(`param: version = "${version}"`);
    core.debug(`param: secrets = "${JSON.stringify(secrets)}"`);
    core.debug(`param: valueFiles = "${JSON.stringify(valueFiles)}"`);
    core.debug(`param: removeCanary = ${removeCanary}`);
    core.debug(`param: timeout = "${timeout}"`);
    core.debug(`param: repository = "${repository}"`);
    core.debug(`param: atomic = "${atomic}"`);
    core.debug(`param: ttl = "${ttl}"`);
    core.debug(`param: service_account = "${service_account}"`);

    // Assert that if ttl is set that release contains '-pr-'
    if (helm === "helm3" && ttl !== "false") {
      if (!release.includes("-pr-")) {
        core.error(
          "ttl is set but release name does not contain '-pr-'. Aborting!"
        );
        process.exit(1);
      }
    }

    // Setup GKE cluster authentication
    await setupClusterAuthentication(
      cluster_project,
      cluster_location,
      cluster_name,
      cluster_sajson
    );

    // Setup command options and arguments.
    const args = [
      "upgrade",
      release,
      chart,
      "--install",
      `--namespace=${namespace}`,
    ];

    // Per https://helm.sh/docs/faq/#xdg-base-directory-support
    if (helm === "helm3") {
      process.env.XDG_DATA_HOME = "/root/.helm/";
      process.env.XDG_CACHE_HOME = "/root/.helm/";
      process.env.XDG_CONFIG_HOME = "/root/.helm/";
      process.env.HELM_PLUGINS = "/root/.local/share/helm/plugins";
      process.env.HELM_DATA_HOME = "/root/.local/share/helm";
      process.env.HELM_CACHE_HOME = "/root/.cache/helm";
      process.env.HELM_CONFIG_HOME = "/root/.config/helm";
    } else {
      process.env.HELM_HOME = "/root/.helm/";
    }

    if (dryRun) args.push("--dry-run");
    if (appName) args.push(`--set=app.name=${appName}`);
    if (version) args.push(`--set=app.version=${version}`);
    if (chartVersion) args.push(`--version=${chartVersion}`);
    if (timeout) args.push(`--timeout=${timeout}`);
    if (repository) args.push(`--repo=${repository}`);
    valueFiles.forEach((f) => args.push(`--values=${f}`));
    args.push("--values=./values.yml");

    // Special behaviour is triggered if the track is labelled 'canary'. The
    // service and ingress resources are disabled. Access to the canary
    // deployments can be routed via the main stable service resource.
    if (track === "canary") {
      args.push("--set=service.enabled=false", "--set=ingress.enabled=false");
    }

    // If true upgrade process rolls back changes made in case of failed upgrade.
    if (atomic === true) {
      args.push("--atomic");
    }

    // Setup necessary files.
    if (process.env.KUBECONFIG_FILE) {
      process.env.KUBECONFIG = "./kubeconfig.yml";
      await writeFile(process.env.KUBECONFIG, process.env.KUBECONFIG_FILE);
    }
    await writeFile("./values.yml", values);

    core.debug(`env: KUBECONFIG="${process.env.KUBECONFIG}"`);

    // Render value files using github variables.
    await renderFiles(valueFiles.concat(["./values.yml"]), {
      secrets,
      deployment: context.payload.deployment,
    });

    // Remove the canary deployment before continuing.
    if (removeCanary) {
      core.debug(`removing canary ${appName}-canary`);
      await exec.exec(helm, deleteCmd(helm, namespace, `${appName}-canary`), {
        ignoreReturnCode: true,
      });
    }

    // Actually execute the deployment here.
    if (task === "remove") {
      if (helm === "helm3") {
        // delete ttl cronjob in case it was set (it is not required).
        await exec.exec(
          helm,
          [`--namespace=${namespace}`, "release", "ttl", release, `--unset`],
          { env: process.env, ignoreReturnCode: true }
        );
      }

      await exec.exec(helm, deleteCmd(helm, namespace, release), {
        ignoreReturnCode: true,
      });
    } else {
      await exec.exec(helm, args);
    }

    // Set ttl if set
    if (helm === "helm3" && ttl !== "false") {
      core.info("Setting ttl: " + ttl);
      await exec.exec(
        helm,
        [
          `--namespace=${namespace}`,
          "release",
          "ttl",
          release,
          `--service-account=${service_account}`,
          `--set=${ttl}`,
        ],
        { env: process.env }
      );
    }

    await status(task === "remove" ? "inactive" : "success");
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
    await status("failure");
  }
}

run();
