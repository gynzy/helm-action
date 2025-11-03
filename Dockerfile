FROM alpine:3.22.2

ENV BASE_URL="https://get.helm.sh"

ENV HELM_3_FILE="helm-v3.19.0-linux-amd64.tar.gz"

# coreutils is needed for helm ttl plugin
# git is needed to install helm plugins
# python3 needed by gcloud
RUN apk add --no-cache ca-certificates \
    --repository http://dl-3.alpinelinux.org/alpine/edge/community/ \
    jq curl bash nodejs python3 git coreutils && \
    # Install Helm 3
    curl -L ${BASE_URL}/${HELM_3_FILE} |tar xvz && \
    mv linux-amd64/helm /usr/bin/helm && \
    rm -rf linux-amd64 && \
    # Install helm ttl plugin for temporary pr deploys
    helm plugin install https://github.com/gynzy/helm-release-plugin --version 438a761e7ec825ead9d181e81ade9a2650b7d5c4

# Install google gcloud sdk.
RUN curl -sSL https://dl.google.com/dl/cloudsdk/channels/rapid/install_google_cloud_sdk.bash | PREFIX=/opt/ bash && \
    # Install new kubernetes authentication method and kubectl \
    /opt/google-cloud-sdk/bin/gcloud components install gke-gcloud-auth-plugin kubectl && \
    # Symlink default location to actually installed location \
    mkdir -p  /usr/lib/google-cloud-sdk/bin && \
    /opt/google-cloud-sdk/bin/gcloud components remove bq gsutil && \
    ln -s /opt/google-cloud-sdk/bin/gcloud /usr/lib/google-cloud-sdk/bin/gcloud && \
    ln -s /opt/google-cloud-sdk/bin/kubectl /usr/lib/google-cloud-sdk/bin/kubectl

ENV PATH=$PATH:/opt/google-cloud-sdk/bin

COPY . /usr/src/
ENTRYPOINT ["node", "/usr/src/index.js"]
