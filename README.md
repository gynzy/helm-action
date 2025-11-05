# Gynzy additions
Fork from https://github.com/deliverybot/helm

- stripped features we don't use.
- releasing: The `v4` tag gets updated on **master merge**!


# Helm Action

Deploys a helm chart using GitHub actions. Provides a built in helm chart for
apps that listen over http to get you ramped up quickly.

View an example repository using this action at
[github.com/deliverybot/example-helm](https://github.com/deliverybot/example-helm).

## Parameters

### Inputs

Inputs below are additionally loaded from the payload of the deployment event
payload if the action was triggered by a deployment.

#### Cluster authentication
- `clusterProject`: The project in which the GKE cluster resides (required)
- `clusterLocation`: The location(zone) in which the GKE cluster resides (required)
- `clusterName`:  The cluster name (required)
- `clusterSaJson`: The service account json secret to be used (required)

#### Helm params
- `release`: Helm release name. Will be combined with track if set. (required)
- `namespace`: Kubernetes namespace name. (required)
- `chart`: Helm chart path. If set to "app" this will use the built in helm
  chart found in this repository. (required)
- `chart_version`: The version of the helm chart you want to deploy (distinct from app version)
- `values`: Helm chart values, expected to be a YAML or JSON string.
- `track`: Track for the deployment (e.g., stable, staging).
- `task`: Task name. If the task is "remove" it will remove the configured helm
  release.
- `dry-run`: Helm dry-run option.
- `token`: Github repository token. If included and the event is a deployment
  then the deployment_status event will be fired.
- `value-files`: Additional value files to apply to the helm chart. Expects a
  JSON encoded array or a string.
- `secrets`: Secret variables to include in value file interpolation. Expects a
  JSON encoded map.
- `helm`: Helm binary to execute (defaults to `helm`, which uses Helm 3. Currently only supported version).
- `version`: Version of the app, usually commit sha works here.
- `wait`: Time to wait for any individual Kubernetes operation like deployment pods. To be used in conjunction with wait (defaults to false. i.e. 5m)
- `timeout`: specify a timeout for helm deployment
- `repository`: specify the URL for a helm repo to come from
- `atomic`: If true, upgrade process rolls back changes made in case of failed upgrade. Defaults to true.
- `ttl`: Optional ttl which can be set until the deployment will be deleted. For example `7 days`. The `release` *must* contain the string `-pr-`

Additional parameters: If the action is being triggered by a deployment event
and the `task` parameter in the deployment event is set to `"remove"` then this
action will execute a `helm delete $service`

#### Versions

- `helm`: v3.19.0 (Helm 3)

### Environment

- `KUBECONFIG_FILE`: Kubeconfig file for Kubernetes cluster access.

### Value file interpolation

The following syntax allows variables to be used in value files:

- `${{ secrets.KEY }}`: References secret variables passed in the secrets input.
- `${{ deployment }}`: References the deployment event that triggered this
  action.

## Example

```yaml
# .github/workflows/deploy.yml
name: Deploy
on: ['deployment']

jobs:
  deployment:
    runs-on: 'ubuntu-latest'
    steps:
    - uses: actions/checkout@v1

    - name: 'Deploy'
      uses: 'deliverybot/helm@v1'
      with:
        release: 'nginx'
        namespace: 'default'
        chart: 'app'
        token: '${{ github.token }}'
        values: |
          name: foobar
        value-files: >-
        [
          "values.yaml",
          "values.production.yaml"
        ]
      env:
        KUBECONFIG_FILE: '${{ secrets.KUBECONFIG }}'
```

## Example pr cleanup

If you are creating an environment per pull request with Helm you may have the
issue where pull request environments like `pr123` sit around in your cluster.
By using GitHub actions we can clean those up by listening for pull request
close events.

```yaml
# .github/workflows/pr-cleanup.yml
name: PRCleanup
on:
  pull_request:
    types: [closed]

jobs:
  deployment:
    runs-on: 'ubuntu-latest'
    steps:
    - name: 'Deploy'
      uses: 'deliverybot/helm@v1'
      with:
        # Task remove means to remove the helm release.
        task: 'remove'
        release: 'review-myapp-${{ github.event.pull_request.number }}'
        version: '${{ github.sha }}'
        track: 'stable'
        chart: 'app'
        namespace: 'example-helm'
        token: '${{ github.token }}'
      env:
        KUBECONFIG_FILE: '${{ secrets.KUBECONFIG }}'
```
